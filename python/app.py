"""Receipts, Python edition. No receipt, no outreach.

    pip install moss
    python python/app.py            # then open http://localhost:8000

Standard library HTTP server. Serves the prebuilt UI from python/static and implements the same
JSON API as the Next.js version: /api/state, /api/icp, /api/discovery, /api/enrich, /api/review,
/api/kanban, /api/graph, /api/billing, plus /mock-source/<id>.
"""
import html
import json
import mimetypes
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))

import core  # noqa: E402

core.load_env()

import mock  # noqa: E402
import moss_index  # noqa: E402
import pipeline  # noqa: E402
from core import LOCK, STATE, audit, feed, save  # noqa: E402

STATIC = Path(__file__).resolve().parent / "static"


def client_state():
    with LOCK:
        m = lambda b: "live" if b else "mock"  # noqa: E731
        snapshot = {**STATE, "graph": core.build_graph(), "integrations": {
            "LLM": m(pipeline.llm_configured()), "Tavily": m(core.env("TAVILY_API_KEY")), "Hunter": m(core.env("HUNTER_API_KEY")),
            "Moss": m(moss_index.configured()), "Flexprice": m(core.env("FLEXPRICE_API_KEY"))}}
        return json.loads(json.dumps(snapshot))  # deep copy while holding the lock


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


# ---------- route handlers: each returns extra fields to merge into {state: ...} ----------

def post_icp(b):
    if not (b.get("product") or "").strip():
        raise ApiError("Product description is required")
    product = b["product"].strip()
    intake = {"name": (b.get("name") or "").strip() or product.replace("(", " ").replace(":", " ").split()[0], "product": product,
              "customers": (b.get("customers") or "").strip(), "pricing": (b.get("pricing") or "").strip()}
    if b.get("reset"):
        core.reset()
    with LOCK:
        STATE.update(intake=intake, running="icp")
        save()
    feed("info", f"Intake received for {intake['name']}. Generating ICP.")
    try:
        icp, mode, err = pipeline.generate_icp(intake)
        with LOCK:
            STATE["icp"] = icp
            STATE["modes"]["icp"] = mode
            save()
        feed("llm", f"ICP generated: {len(icp['industries'])} industries, {len(icp['personas'])} personas, {len(icp['triggers'])} triggers, "
                    f"{len(icp['negativeSignals'])} negative signals{f'. LLM failed, used cached ICP ({err})' if err else ''}.", mode=mode)
        audit("AI", "ICP generated", ", ".join(i["name"] for i in icp["industries"]))
    finally:
        with LOCK:
            STATE["running"] = None
            save()


def put_icp(b):
    if not b.get("icp"):
        raise ApiError("icp required")
    with LOCK:
        STATE["icp"] = b["icp"]
        save()
    audit("Rep", "ICP edited", b.get("note") or "ICP cards updated")


def post_discovery(_b):
    if STATE["running"]:
        raise ApiError("A run is already in progress", 409)
    try:
        pipeline.run_discovery()
    except ValueError as e:
        raise ApiError(str(e), 500) from e


def post_enrich(b):
    err = pipeline.enrich_and_draft(b.get("leadId"))
    if err == "no_credits":
        raise ApiError("no_credits", 402)
    if err:
        raise ApiError("Lead not found or missing a receipt", 404)


def post_review(b):
    """Mandatory human review. Approve queues the message. Nothing is sent."""
    lead = core.find_lead(b.get("leadId"))
    msg = next((m for m in (lead or {}).get("messages", []) if m["id"] == b.get("messageId")), None)
    if not lead or not msg:
        raise ApiError("Message not found", 404)
    action = b.get("action")
    if action == "edit":
        with LOCK:
            msg["body"] = b.get("body") or msg["body"]
            if b.get("subject") is not None:
                msg["subject"] = b["subject"]
            msg.update(edited=True, status="draft")
            lead.update(lastActor="Rep", lastAction=f"Edited {msg['label']}")
            save()
        audit("Rep", "Message edited", f"{lead['company']}: {msg['label']}", lead["id"])
    elif action == "reject":
        with LOCK:
            msg["status"] = "rejected"
            lead.update(lastActor="Rep", lastAction=f"Rejected {msg['label']}")
            save()
        audit("Rep", "Message rejected", f"{lead['company']}: {msg['label']}", lead["id"])
    elif msg["status"] != "approved":
        moved = lead["stage"] == "Matched"
        with LOCK:
            msg.update(status="approved", approvedAt=core.now())
            if moved:
                lead["stage"] = "Contacted"
            lead.update(lastActor="Rep", lastAction=f"Approved {msg['label']}")
            save()
        audit("Rep", "Message approved", f"{lead['company']}: {msg['label']} added to the send queue (not sent).", lead["id"])
        if moved:
            audit("AI", "Stage changed", f"{lead['company']}: Matched -> Contacted after approval.", lead["id"])
        core.meter("outreach_sent", lead["id"], f"{lead['company']}, queued")


def post_kanban(b):
    lead = core.find_lead(b.get("leadId"))
    if not lead or b.get("stage") not in core.STAGES:
        raise ApiError("Bad move")
    old = lead["stage"]
    if old != b["stage"]:
        with LOCK:
            lead.update(stage=b["stage"], lastActor="Rep", lastAction=f"Moved to {b['stage']}")
            save()
        audit("Rep", "Stage changed", f"{lead['company']}: {old} -> {b['stage']} (drag and drop).", lead["id"])


def post_graph(b):
    """On demand graph queries. Each one is metered as graph_query."""
    graph, t0 = core.build_graph(), time.perf_counter()
    if b.get("query") == "displacement":
        result = core.displacement_targets(graph)
        with LOCK:
            STATE["displacement"] = result
            save()
        feed("graph", f"Graph query: displacement targets. {len(result)} found.", ms=round((time.perf_counter() - t0) * 1000, 2))
        core.meter("graph_query", None, "displacement")
        return {"result": result}
    lead = core.find_lead(b.get("leadId"))
    if not lead:
        raise ApiError("Lead not found", 404)
    path = core.warm_intro_path(graph, core.customers_of(), lead["contact"]["name"])
    with LOCK:
        lead["warmPath"], lead["warmPathIds"] = (path["text"], path["ids"]) if path else (None, None)
        save()
    feed("graph", f"Graph query: warm intro to {lead['contact']['name']} at {lead['company']}. {str(path['hops']) + ' hop path found.' if path else 'No path.'}",
         ms=round((time.perf_counter() - t0) * 1000, 2))
    core.meter("graph_query", lead["id"], "warm intro")
    return {"result": path}


def post_billing(_b):
    core.top_up()
    audit("Rep", "Credits topped up", f"{core.TOP_UP} credits added")


ROUTES = {("POST", "/api/icp"): post_icp, ("PUT", "/api/icp"): put_icp, ("POST", "/api/discovery"): post_discovery, ("POST", "/api/enrich"): post_enrich,
          ("POST", "/api/review"): post_review, ("POST", "/api/kanban"): post_kanban, ("POST", "/api/graph"): post_graph, ("POST", "/api/billing"): post_billing,
          ("GET", "/api/state"): lambda _b: None, ("DELETE", "/api/state"): lambda _b: core.reset()}

MOCK_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>
<style>body{{font-family:system-ui,sans-serif;max-width:42rem;margin:0 auto;padding:2.5rem;color:#171717}}.b{{display:inline-block;background:#fef3c7;color:#92400e;font-size:.75rem;font-weight:500;padding:.15rem .5rem;border-radius:.25rem}}
h1{{font-family:Georgia,serif;font-size:1.9rem;margin:1rem 0 .25rem}}.m{{color:#737373;font-size:.875rem}}.t{{font-size:1.125rem;line-height:1.7;margin-top:1.5rem}}</style></head>
<body><div class="b">Mock source: seeded demo data, not a real article</div><h1>{title}</h1><p class="m">{meta}</p><p class="t">{text}</p>
<p class="m" style="margin-top:2.5rem">With TAVILY_API_KEY set, citations link to the live web pages Tavily returned.</p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # quiet: the UI polls /api/state
        if "/api/state" not in (args[0] if args else ""):
            sys.stderr.write("%s\n" % (fmt % args))

    def _send(self, status, body, ctype):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status, payload):
        self._send(status, json.dumps(payload).encode(), "application/json")

    def _api(self, method, path):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
        except ValueError:
            return self._json(400, {"state": client_state(), "error": "Invalid JSON"})
        handler = ROUTES.get((method, path))
        if not handler:
            return self._json(404, {"error": "Not found"})
        try:
            extra = handler(body) or {}
            self._json(200, {"state": client_state(), **extra})
        except ApiError as e:
            self._json(e.status, {"state": client_state(), "error": str(e)})
        except Exception as e:  # noqa: BLE001
            self._json(500, {"state": client_state(), "error": str(e)[:300] or type(e).__name__})

    def _static(self, path):
        if path.startswith("/mock-source/"):
            src = mock.mock_source(unquote(path.rsplit("/", 1)[1]))
            if not src:
                return self._send(404, b"Not found", "text/plain")
            meta = src["company"] + (" · " + src["date"] if src["date"] else "")
            page = MOCK_PAGE.format(title=html.escape(src["title"]), meta=html.escape(meta), text=html.escape(src["text"]))
            return self._send(200, page.encode(), "text/html; charset=utf-8")
        rel = unquote(path).lstrip("/") or "index.html"
        f = (STATIC / rel).resolve()
        if STATIC.resolve() not in f.parents or not f.is_file():
            f = STATIC / "index.html"
        if not f.is_file():
            return self._send(500, b"UI bundle missing: python/static/index.html not found.", "text/plain")
        ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        self._send(200, f.read_bytes(), ctype + ("; charset=utf-8" if ctype.startswith("text/") or ctype.endswith("javascript") else ""))

    def do_GET(self):
        path = urlparse(self.path).path
        self._api("GET", path) if path.startswith("/api/") else self._static(path)

    def do_POST(self):
        self._api("POST", urlparse(self.path).path)

    def do_PUT(self):
        self._api("PUT", urlparse(self.path).path)

    def do_DELETE(self):
        self._api("DELETE", urlparse(self.path).path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8000))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Receipts (Python) running at http://localhost:{port}   Moss: {'live' if moss_index.configured() else 'mock'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
