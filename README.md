# Receipts

No receipt, no outreach.

An AI GTM engine that only drafts outreach when it can prove three things with sources: why this account (FIT), why this person (PERSON), why today (TIMING). Leads missing a receipt go to "Held back" with the reason.

## Run it: Python backend (recommended)

The backend is plain Python (standard library HTTP server) and uses the Moss Python SDK. No Node needed: the UI ships prebuilt in `python/static`.

```bash
pip install -r python/requirements.txt
python python/app.py
```

Open http://localhost:8000 and click **Load demo**. Put `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` in `.env.local` (project root) or export them, and Moss runs live. Everything else falls back to mock data.

| File | What it does |
|---|---|
| `python/app.py` | HTTP server, JSON API routes, static UI, `/mock-source/<id>` |
| `python/pipeline.py` | LLM helper, ICP, discovery with the receipt gate, Hunter enrichment, outreach drafts |
| `python/moss_index.py` | Moss index `signals`: create, load, per company query with ms timing, local fallback |
| `python/core.py` | State store (`python/data/store.json`), credit ledger and Flexprice events, scoring, knowledge graph and its two queries |
| `python/mock.py` | All seeded fallback data |
| `scripts/moss_search.py` | Standalone Moss search from the command line |

The UI is the same React app as the Next.js version. To rebuild it after changing `app/` or `components/`: `sh scripts/build_python_ui.sh` (needs `npm install`).

## Run it: Next.js version

The original TypeScript backend (`app/api`, `lib/`) still works and has the same features.

## Setup (Next.js)

```bash
npm install
cp .env.example .env.local   # optional: anything missing falls back to mock data
npm run dev
```

Open http://localhost:3000 and click **Load demo**. Both versions work with zero API keys.

## Demo script (2 minutes)

1. **Load demo**: prefills intake with Moss, generates the ICP, runs discovery, enriches the top 5 leads. Watch the Agent thinking panel on the right.
2. **Leads**: score, tier, three receipt chips (hover for the source), "Held back" list, competitor map.
3. Click a lead: receipts with sources, warm intro path, Moss retrieval time, 3 step sequence. **Approve / Edit / Reject**.
4. **Enrich** two or three more leads until credits hit zero: the credit wall appears. **Top up**.
5. **Pipeline**: the approved lead moved to Contacted. Drag cards. AI and Rep badges.
6. **Graph**: warm intro and displacement queries. **Charts**, **Audit log**.

## Integrations: live or mock

Each integration is live when its env keys are set, and falls back to seeded mock data when a key is missing or a call fails. Badges in the header, feed, and lead drawer show which one ran.

| Integration | Env keys | Live behavior | Mock behavior |
|---|---|---|---|
| LLM | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (optional `LLM_MODEL`) | ICP, company extraction, outreach drafts, zod validated | Seeded ICP, 17 seeded companies, templated sequences |
| Tavily | `TAVILY_API_KEY` | Web search for accounts and trigger signals | Cached search results |
| Moss | `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY` | Index `signals`, semantic query per company | Local in-memory index, same interface |
| Hunter | `HUNTER_API_KEY` | Email finder with verification status | Pattern email on the seeded domain |
| Flexprice | `FLEXPRICE_API_KEY` (optional `FLEXPRICE_API_HOST`, `FLEXPRICE_CUSTOMER_ID`) | Usage events `lead_enriched`, `outreach_sent`, `graph_query` | Local credit ledger only |

Live discovery needs both `TAVILY_API_KEY` and an LLM key. All seeded companies and people are fictional, and mock citations open a local `/mock-source/...` page that is labeled as mock.

No email or LinkedIn message is ever sent. Approved messages land in the Send queue.

## Moss from Python

The app indexes every discovered snippet and signal into the Moss index `signals` (run Load demo once). The same index can be searched from Python:

```bash
pip install moss
python scripts/moss_search.py "who just raised funding for a voice agent"
```

The script reads `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` from the environment or from `.env.local`.

## Architecture (Next.js version; the Python modules mirror it)

```
app/page.tsx                 single page client app (tabs + agent feed + review drawer)
app/api/state                GET full state, DELETE reset
app/api/icp                  POST intake -> ICP (LLM), PUT save edited ICP
app/api/discovery            POST run search -> extract -> receipt gate -> Moss -> graph -> score
app/api/enrich               POST enrich one lead + draft sequence (402 when out of credits)
app/api/review               POST approve / edit / reject a message
app/api/kanban               POST move a card
app/api/graph                POST warm_intro or displacement query (metered)
app/api/billing              POST top up
app/mock-source/[id]         local page for mock citations

lib/store.ts      one in-memory store on globalThis, persisted to data/store.json
lib/llm.ts        llmJson(): Anthropic or OpenAI -> JSON -> zod, mock on any failure
lib/icp.ts        ICP generation
lib/discovery.ts  the pipeline and the receipt gate
lib/moss.ts       Moss index "signals" + per company query with ms timing, local fallback
lib/graph.ts      graph build, warm intro BFS (multi hop), displacement query
lib/enrich.ts     Hunter via fetch
lib/outreach.ts   enrichment + 3 step sequence, re-checks the three receipts
lib/scoring.ts    intent from signals, composite = 55% fit + 45% intent (+6 warm path), tiers A/B/C
lib/billing.ts    Flexprice events + local credit ledger, costs in lib/costs.ts
lib/mock.ts       all seeded fallback data
components/*      IntakeForm, IcpCards, LeadTable, ReceiptChips, ReviewDrawer, Kanban, Charts, AgentFeed, CreditMeter, GraphView
```

Data flow: every API route mutates the store and returns the full state. The client polls `/api/state` while a run is in progress, which is how the Agent thinking feed streams.

Credits: start at 40. Enrichment costs 5, an approved message 2, a graph query 1. At zero, enrichment is blocked with an upgrade prompt.
