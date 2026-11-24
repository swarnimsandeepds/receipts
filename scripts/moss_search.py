"""First search on Moss from Python, against the "signals" index the Receipts app builds.

Usage:
    pip install moss
    export MOSS_PROJECT_ID=... MOSS_PROJECT_KEY=...   (or keep them in .env.local)
    python scripts/moss_search.py "who just raised funding for a voice agent"
"""
import asyncio
import os
import sys
import time
from pathlib import Path

from moss import MossClient, QueryOptions

INDEX = "signals"


def load_env_local() -> None:
    """Read MOSS_* from .env.local next to package.json when not already exported."""
    env = Path(__file__).resolve().parent.parent / ".env.local"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


async def main() -> None:
    load_env_local()
    client = MossClient(os.environ["MOSS_PROJECT_ID"], os.environ["MOSS_PROJECT_KEY"])
    queries = sys.argv[1:] or [
        "who just raised a funding round for a voice agent",
        "hiring retrieval or search engineers",
        "retrieval latency causes awkward pauses on calls",
    ]
    # Load once, then query as often as you like.
    t0 = time.perf_counter()
    await client.load_index(INDEX)
    print(f'Loaded index "{INDEX}" in {(time.perf_counter() - t0) * 1000:.0f} ms\n')
    for q in queries:
        t0 = time.perf_counter()
        results = await client.query(INDEX, q, QueryOptions(top_k=3))
        ms = (time.perf_counter() - t0) * 1000
        print(f"Q: {q}   ({ms:.2f} ms)")
        for doc in results.docs:
            meta = getattr(doc, "metadata", None) or {}
            print(f"  {doc.score:.3f}  {doc.text}")
            print(f"         source: {meta.get('sourceUrl', 'n/a')}")
        print()


asyncio.run(main())
