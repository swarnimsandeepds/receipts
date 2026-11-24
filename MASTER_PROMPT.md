# Master prompt for Receipts

Paste everything below into Claude along with this zip.

---

You are building "Receipts", an AI go-to-market engine. Tagline: "No receipt, no outreach."

The attached project is a working Next.js scaffold. All dependencies are already declared in package.json and verified to install. Do not add new dependencies unless something is impossible without one. Build inside this structure and give me complete files.

## Core rule

The agent may only draft outreach for a lead that has all three receipts, each with a source:

1. FIT receipt: why this account matches the ICP (confidence 0.00 to 1.00)
2. PERSON receipt: why this contact (role match, or a warm path in the graph)
3. TIMING receipt: why today (a trigger signal with a source URL)

Leads missing a receipt go to a "Held back" list showing the reason.

## Stack (already installed)

Next.js App Router, TypeScript, Tailwind, Radix UI, recharts, @hello-pangea/dnd, zod, lucide-react.
Integrations: @tavily/core, @moss-js/moss, @flexprice/sdk, @anthropic-ai/sdk or openai, Hunter via fetch.
State: a single in-memory store in lib/store.ts with JSON persistence to data/store.json. No auth.
Env keys are listed in .env.example.

HARD REQUIREMENT: every external call has a mock fallback with realistic seeded data when a key is missing or the call fails, so the full flow always works. Show a small "live" or "mock" badge per call.

## Suggested files

- lib/store.ts: state and persistence
- lib/llm.ts: one helper that returns zod validated JSON
- lib/icp.ts, lib/discovery.ts, lib/moss.ts, lib/graph.ts, lib/enrich.ts, lib/outreach.ts, lib/scoring.ts, lib/billing.ts
- lib/mock.ts: all seeded fallback data
- app/api/*/route.ts: one route per module
- components/*: IntakeForm, IcpCards, LeadTable, ReceiptChips, ReviewDrawer, Kanban, Charts, AgentFeed, CreditMeter, GraphView

## Build in this order

### 1. Intake and ICP
Form with: product description, existing customers, pricing. One LLM call returns JSON: industries with NAICS codes, company size range, buyer personas, trigger events, negative signals, each with a confidence score. Also return 2 adjacent segments the user can accept, adjust, or dismiss. Render as editable cards.

### 2. Discovery
From the ICP, run Tavily searches for target accounts and trigger signals (funding, hiring, launches, job posts). Extract 10 to 15 companies with LLM structured output. Every company and every signal must show an inline source link. Apply negative signals and move rejects to "Held back" with the reason. Also produce a competitor map: 3 competitors with positioning, pricing tier, differentiators.

### 3. Moss retrieval
Index every discovered snippet and signal into a Moss index named "signals" using @moss-js/moss, with company name and source URL as metadata. Read the type definitions in node_modules/@moss-js/moss and docs.moss.dev/docs for the exact index and query methods before coding. When scoring or drafting for a company, query Moss for its top 5 signals and log the retrieval time in ms.

### 4. Knowledge graph
In-memory graph. Nodes: Company, Person, Product, Competitor, Signal. Edges: works_at, competes_with, matched_to, contacted_via, replied_to, previously_employed_at. Implement two multi-hop queries: (a) warm intro path from an existing customer to a target contact through previously_employed_at, (b) displacement targets, meaning companies using a competitor. Show a simple graph view and the path as text on the lead card.

### 5. Enrichment and outreach
For each qualified lead, call Hunter for a verified email, plus LinkedIn URL and domain. Generate a 3 step sequence (email, LinkedIn note, follow up email) that quotes the timing receipt and matches persona tone. Mandatory human review: Approve, Edit, Reject on every message. Approved messages go to a queue. Do NOT send real emails.

### 6. Scoring
Composite 0 to 100 score from fit and intent. Tier A is 75 and up, B is 50 to 74, C is below 50. Show the score, tier, and three receipt chips on every lead row.

### 7. Dashboard
Kanban: Matched, Contacted, Replied, Meeting Booked, Closed/Lost. Approving a message moves the card to Contacted. Drag and drop for the rest. Badge each action as AI or Rep. Audit log tab with timestamps. Charts: conversion by industry and by tier, and one A/B comparison of two message templates.

### 8. Flexprice billing
Meter three events: lead_enriched, outreach_sent, graph_query. Send usage events with @flexprice/sdk (read its type definitions for the events API) and keep a local credit ledger as fallback. Show a credit balance in the header and cost per lead on each card. When credits hit zero, block enrichment with an upgrade prompt. Include a "Top up" button.

### 9. Agent Thinking feed
Collapsible right panel streaming each agent step: searches run, Moss retrieval with ms, graph queries, leads held back and why, credits spent.

## UI
Layout mixes an editorial header with a dense spreadsheet style lead table. Inline confidence indicators. Clean, light, professional.

## Demo mode
Add a "Load demo" button that prefills intake with Moss (moss.dev, real time semantic search for voice agents and copilots) and runs the full pipeline, using cached results if live calls fail.

## Output
Work module by module in the order above. After each module, the app must still run with `npm run dev`. Finish by updating README.md with an architecture section.
