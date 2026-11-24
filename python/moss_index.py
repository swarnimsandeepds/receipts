"""Moss retrieval through the Python SDK (pip install moss). Index name: "signals".
Falls back to a local in-memory index when keys are missing or a call fails."""
import asyncio
import re
import threading
import time

from core import env

INDEX = "signals"
_local = []
_live = False
_client = None
_loop = None


def configured():
    return bool(env("MOSS_PROJECT_ID") and env("MOSS_PROJECT_KEY"))


def _run(coro, timeout):
    """The Moss client is async. Run it on one long-lived background event loop."""
    global _loop
    if _loop is None:
        _loop = asyncio.new_event_loop()
        threading.Thread(target=_loop.run_forever, daemon=True).start()
    return asyncio.run_coroutine_threadsafe(coro, _loop).result(timeout)


def _get_client():
    global _client
    if _client is None:
        from moss import MossClient
        _client = MossClient(env("MOSS_PROJECT_ID"), env("MOSS_PROJECT_KEY"))
    return _client


def index_signals(docs):
    """docs: [{id, text, metadata: {company, sourceUrl, type}}]. Returns (mode, ms, error)."""
    global _local, _live
    _local, _live = docs, False
    t0 = time.perf_counter()
    err = None
    if configured() and docs:
        try:
            from moss import DocumentInfo
            c = _get_client()
            try:
                _run(c.delete_index(INDEX), 20)
            except Exception:
                pass
            _run(c.create_index(INDEX, [DocumentInfo(id=d["id"], text=d["text"], metadata=d["metadata"]) for d in docs]), 120)
            _run(c.load_index(INDEX), 60)
            _live = True
        except Exception as e:  # noqa: BLE001
            err = str(e)[:160] or type(e).__name__
    return ("live" if _live else "mock"), round((time.perf_counter() - t0) * 1000), err


def _tokens(s):
    return re.findall(r"[a-z0-9]+", s.lower())


def _local_query(company, query, top_k):
    q = set(_tokens(query))
    hits = []
    for d in _local:
        if d["metadata"]["company"] != company:
            continue
        t = _tokens(d["text"])
        overlap = sum(1 for w in t if w in q)
        hits.append({"text": d["text"], "sourceUrl": d["metadata"]["sourceUrl"], "score": min(0.99, 0.35 + overlap / max(6, len(t)))})
    return sorted(hits, key=lambda h: -h["score"])[:top_k]


def query_company(company, query, top_k=5):
    """Top signals for one company. Returns {hits, ms, mode}."""
    t0 = time.perf_counter()
    if _live:
        try:
            from moss import QueryOptions
            res = _run(_get_client().query(INDEX, f"{company} {query}", QueryOptions(top_k=25)), 20)
            hits = [{"text": d.text, "sourceUrl": (d.metadata or {}).get("sourceUrl", ""), "score": float(d.score)}
                    for d in res.docs if (d.metadata or {}).get("company") == company][:top_k]
            if hits:
                return {"hits": hits, "ms": round((time.perf_counter() - t0) * 1000, 2), "mode": "live"}
        except Exception:
            pass
    return {"hits": _local_query(company, query, top_k), "ms": round((time.perf_counter() - t0) * 1000, 2), "mode": "mock"}
