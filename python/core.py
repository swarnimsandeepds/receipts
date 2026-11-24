"""State store, billing, scoring and the knowledge graph."""
import json
import os
import re
import threading
import time
import urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STORE_FILE = ROOT / "data" / "store.json"
START_CREDITS = 40
COSTS = {"lead_enriched": 5, "outreach_sent": 2, "graph_query": 1}
TOP_UP = 50
STAGES = ["Matched", "Contacted", "Replied", "Meeting Booked", "Closed/Lost"]
LOCK = threading.RLock()


def load_env():
    """Read KEY=VALUE lines from .env.local (next to this folder or one level up)."""
    for p in (ROOT / ".env.local", ROOT.parent / ".env.local"):
        if p.exists():
            for line in p.read_text().splitlines():
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.split("=", 1)
                    if v.strip():
                        os.environ.setdefault(k.strip(), v.strip())


def env(k):
    return os.environ.get(k, "").strip()


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


_n = 0


def uid(prefix):
    global _n
    _n += 1
    return f"{prefix}_{int(time.time() * 1000):x}{_n:x}"


def fresh():
    return {"version": 1, "intake": None, "icp": None, "modes": {}, "leads": [], "heldBack": [], "competitors": [], "people": [],
            "displacement": [], "feed": [], "audit": [], "credits": {"balance": START_CREDITS, "ledger": []}, "running": None}


def _load():
    try:
        s = json.loads(STORE_FILE.read_text())
        if isinstance(s.get("version"), int) and isinstance(s.get("leads"), list):
            return {**fresh(), **s, "running": None}
    except Exception:
        pass
    return fresh()


STATE = _load()


def save():
    """Bump the version and persist. Call after every mutation, while holding LOCK."""
    STATE["version"] += 1
    try:
        STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STORE_FILE.write_text(json.dumps(STATE))
    except Exception:
        pass


def reset():
    with LOCK:
        v = STATE["version"]
        STATE.clear()
        STATE.update(fresh())
        STATE["version"] = v
        save()


def feed(kind, text, mode=None, ms=None):
    with LOCK:
        e = {"id": uid("f"), "ts": now(), "kind": kind, "text": text}
        if mode:
            e["mode"] = mode
        if ms is not None:
            e["ms"] = ms
        STATE["feed"].append(e)
        del STATE["feed"][:-400]
        save()


def audit(actor, action, detail, lead_id=None):
    with LOCK:
        STATE["audit"].append({"id": uid("a"), "ts": now(), "actor": actor, "action": action, "detail": detail, "leadId": lead_id})
        save()


def find_lead(lead_id):
    return next((l for l in STATE["leads"] if l["id"] == lead_id), None)


# ---------- billing: Flexprice usage events with a local credit ledger ----------

def can_afford(event):
    return STATE["credits"]["balance"] >= COSTS[event]


def _flexprice(event, lead_id):
    if not env("FLEXPRICE_API_KEY"):
        return "mock"
    try:
        host = (env("FLEXPRICE_API_HOST") or "https://us.api.flexprice.io/v1").rstrip("/")
        body = json.dumps({"event_name": event, "external_customer_id": env("FLEXPRICE_CUSTOMER_ID") or "receipts-demo",
                           "properties": {"credits": str(COSTS[event]), "lead_id": lead_id or ""}, "source": "receipts"}).encode()
        req = urllib.request.Request(host + "/events", data=body, headers={"Content-Type": "application/json", "x-api-key": env("FLEXPRICE_API_KEY")})
        urllib.request.urlopen(req, timeout=6).read()
        return "live"
    except Exception:
        return "mock"


def meter(event, lead_id=None, note=None):
    mode = _flexprice(event, lead_id)
    with LOCK:
        c = STATE["credits"]
        c["balance"] = max(0, c["balance"] - COSTS[event])
        c["ledger"].append({"id": uid("l"), "ts": now(), "event": event, "credits": -COSTS[event], "leadId": lead_id, "mode": mode})
        STATE["modes"]["billing"] = mode
        lead = find_lead(lead_id) if lead_id else None
        if lead:
            lead["costCredits"] += COSTS[event]
        save()
    n = COSTS[event]
    feed("credit", f"{event}: {n} credit{'s' if n > 1 else ''} spent{f' ({note})' if note else ''}. Balance {STATE['credits']['balance']}.", mode=mode)
    return mode


def top_up():
    with LOCK:
        STATE["credits"]["balance"] += TOP_UP
        STATE["credits"]["ledger"].append({"id": uid("l"), "ts": now(), "event": "top_up", "credits": TOP_UP, "mode": "mock"})
        save()
    feed("credit", f"Top up: {TOP_UP} credits added. Balance {STATE['credits']['balance']}.")


# ---------- scoring ----------

WEIGHT = {"funding": 45, "launch": 40, "hiring": 34, "job_post": 34, "news": 20}


def intent_score(signals):
    """Intent 0 to 100 from trigger signals, decayed by age."""
    total = 0.0
    for s in signals:
        try:
            age = max(0, (datetime.now() - datetime.fromisoformat(s["date"][:10])).days)
            decay = max(0.35, 1 - age / 120)
        except Exception:
            decay = 0.6
        total += WEIGHT.get(s["type"], 15) * decay
    return round(min(100, total * 1.25))


def composite(fit_confidence, intent, warm):
    """Composite 0 to 100: 55% fit, 45% intent, plus a small bonus for a warm path."""
    fit = round(fit_confidence * 100)
    score = min(100, round(0.55 * fit + 0.45 * intent + (6 if warm else 0)))
    return fit, score, "A" if score >= 75 else "B" if score >= 50 else "C"


# ---------- knowledge graph ----------

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower())


def company_id(n):
    return "co:" + slug(n)


def person_id(n):
    return "p:" + slug(n)


def customers_of():
    return [x.strip() for x in re.split(r"[,;\n]", (STATE["intake"] or {}).get("customers", "")) if x.strip()]


def build_graph():
    s = STATE
    nodes, edges, seen = {}, [], set()

    def add(nid, typ, label, **flags):
        n = nodes.setdefault(nid, {"id": nid, "type": typ, "label": label})
        for k, v in flags.items():
            if v:
                n[k] = True

    def edge(a, b, typ):
        if (a, b, typ) not in seen:
            seen.add((a, b, typ))
            edges.append({"from": a, "to": b, "type": typ})

    if not s["intake"]:
        return {"nodes": [], "edges": []}
    product = "product:" + slug(s["intake"]["name"] or "product")
    add(product, "Product", s["intake"]["name"] or "Product")
    for c in customers_of():
        add(company_id(c), "Company", c, customer=True)
        edge(company_id(c), product, "matched_to")
    for c in s["competitors"]:
        add("comp:" + slug(c["name"]), "Competitor", c["name"])
        edge("comp:" + slug(c["name"]), product, "competes_with")
    for p in s["people"]:
        add(person_id(p["name"]), "Person", p["name"])
        add(company_id(p["company"]), "Company", p["company"])
        edge(person_id(p["name"]), company_id(p["company"]), "works_at")
        for prev in p["previousEmployers"]:
            add(company_id(prev), "Company", prev)
            edge(person_id(p["name"]), company_id(prev), "previously_employed_at")
    for l in s["leads"]:
        co = company_id(l["company"])
        add(co, "Company", l["company"], target=True)
        edge(co, product, "matched_to")
        if l.get("usesCompetitor"):
            add("comp:" + slug(l["usesCompetitor"]), "Competitor", l["usesCompetitor"])
            edge(co, "comp:" + slug(l["usesCompetitor"]), "uses")
        p = person_id(l["contact"]["name"])
        add(p, "Person", l["contact"]["name"])
        edge(p, co, "works_at")
        for prev in l["contact"]["previousEmployers"]:
            add(company_id(prev), "Company", prev)
            edge(p, company_id(prev), "previously_employed_at")
        if l["signals"]:
            top = l["signals"][0]
            add("sig:" + top["id"], "Signal", f"{top['type']}: {top['sourceTitle']}"[:48])
            edge("sig:" + top["id"], co, "matched_to")
            if l["stage"] != "Matched":
                edge(p, "sig:" + top["id"], "contacted_via")
        if l["stage"] in ("Replied", "Meeting Booked"):
            edge(p, product, "replied_to")
    return {"nodes": list(nodes.values()), "edges": edges}


def warm_intro_path(graph, customer_names, contact_name):
    """Query (a): breadth first search from an existing customer to the target contact over works_at and
    previously_employed_at edges in either direction, at most 4 hops, with at least one previously_employed_at hop."""
    target = person_id(contact_name)
    labels = {n["id"]: n["label"] for n in graph["nodes"]}
    adj = {}
    for e in graph["edges"]:
        if e["type"] in ("works_at", "previously_employed_at"):
            adj.setdefault(e["from"], []).append((e["to"], e["type"], True))
            adj.setdefault(e["to"], []).append((e["from"], e["type"], False))
    best = None
    for c in customer_names:
        start = company_id(c)
        queue, seen = deque([(start, [(start, None, None)], False)]), {start}
        while queue:
            cur, path, prev = queue.popleft()
            if cur == target and prev:
                text = " ".join(f"{labels.get(i, i)} (customer)" if n == 0 else f"{f'-[{via}]->' if fwd else f'<-[{via}]-'} {labels.get(i, i)}"
                                for n, (i, via, fwd) in enumerate(path))
                if not best or len(path) - 1 < best["hops"]:
                    best = {"text": text, "ids": [p[0] for p in path], "hops": len(path) - 1}
                break
            if len(path) > 4:
                continue
            for to, typ, fwd in adj.get(cur, []):
                if to not in seen:
                    seen.add(to)
                    queue.append((to, path + [(to, typ, fwd)], prev or typ == "previously_employed_at"))
    return best


def displacement_targets(graph):
    """Query (b): target companies with a uses edge to a competitor that competes_with our product."""
    labels = {n["id"]: n["label"] for n in graph["nodes"]}
    competitors = {e["from"] for e in graph["edges"] if e["type"] == "competes_with"}
    return [{"company": labels[e["from"]], "competitor": labels[e["to"]]} for e in graph["edges"] if e["type"] == "uses" and e["to"] in competitors]
