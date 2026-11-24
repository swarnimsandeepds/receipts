// Discovery: Tavily search -> LLM extraction -> receipt gate -> Moss index -> graph queries -> scoring.
import { z } from "zod";
import { llmJson } from "./llm";
import { MOCK_COMPANIES, MOCK_COMPETITORS, MOCK_CUSTOMER_PEOPLE, MOCK_QUERIES } from "./mock";
import { audit, feed, getState, mutate, sleep, uid } from "./store";
import { indexSignals, queryCompany, type MossDoc } from "./moss";
import { buildGraph, customersOf, displacementTargets, warmIntroPath } from "./graph";
import { composite, intentScore } from "./scoring";
import { meter } from "./billing";
import type { Competitor, HeldBack, Icp, Intake, Lead, Mode, RawCompany, Signal } from "./types";

const RANK: Record<string, number> = { funding: 4, launch: 3, hiring: 2, job_post: 2, news: 1 };
interface Snippet { title: string; url: string; content: string; date?: string; query: string }

function buildQueries(intake: Intake, icp: Icp): string[] {
  const ind = icp.industries.slice(0, 2).map((i) => i.name);
  const segs = icp.adjacentSegments.filter((s) => s.status === "accepted").map((s) => s.name);
  return [
    `${ind[0]} startups raised funding round`,
    `${ind[1] ?? ind[0]} companies hiring ${icp.personas[0]?.title ?? "engineers"}`,
    `${icp.triggers[0]?.event ?? "product launch"} ${ind[0]}`,
    ...(segs[0] ? [`${segs[0]} company launch OR funding`] : []),
    `${intake.name} competitors alternatives pricing`,
  ];
}

async function search(queries: string[]): Promise<{ snippets: Snippet[]; mode: Mode }> {
  if (!process.env.TAVILY_API_KEY) return { snippets: [], mode: "mock" };
  try {
    const { tavily } = await import("@tavily/core");
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const snippets: Snippet[] = [];
    for (const q of queries) {
      const t0 = performance.now();
      const res = await client.search(q, { maxResults: 6, searchDepth: "basic", timeout: 20 });
      for (const r of res.results) snippets.push({ title: r.title, url: r.url, content: (r.content ?? "").slice(0, 700), date: r.publishedDate, query: q });
      feed("search", `Tavily: "${q}" returned ${res.results.length} results`, { mode: "live", ms: Math.round(performance.now() - t0) });
    }
    if (!snippets.length) throw new Error("no results");
    return { snippets, mode: "live" };
  } catch (e) {
    feed("info", `Tavily failed (${e instanceof Error ? e.message.slice(0, 80) : "error"}). Using cached results.`, { mode: "mock" });
    return { snippets: [], mode: "mock" };
  }
}

const RawSchema = z.object({
  companies: z.array(z.object({
    name: z.string(), domain: z.string(), industry: z.string(), employees: z.coerce.number().catch(0), description: z.string(),
    sourceUrl: z.string(), sourceTitle: z.string(), fitConfidence: z.coerce.number().min(0).max(1), fitReason: z.string(),
    negativeSignalMatched: z.string().nullable().optional(), usesCompetitor: z.string().nullable().optional(),
    signals: z.array(z.object({ type: z.enum(["funding", "hiring", "launch", "job_post", "news"]).catch("news"), text: z.string(), sourceUrl: z.string(), sourceTitle: z.string(), date: z.string().catch("") })),
    contact: z.object({ name: z.string(), title: z.string() }).nullable().optional(),
  })).min(3),
  competitors: z.array(z.object({ name: z.string(), positioning: z.string(), pricingTier: z.string(), differentiators: z.array(z.string()), sourceUrl: z.string() })).min(1),
});

async function extract(intake: Intake, icp: Icp, snippets: Snippet[]): Promise<{ companies: RawCompany[]; competitors: Competitor[]; mode: Mode; error?: string }> {
  const mock = () => ({ companies: MOCK_COMPANIES, competitors: MOCK_COMPETITORS });
  if (!snippets.length) return { ...mock(), mode: "mock" };
  const urls = new Set(snippets.map((s) => s.url));
  const r = await llmJson({
    schema: RawSchema,
    system: "You extract target accounts from web search results for a B2B sales team. Use only facts in the snippets. Every sourceUrl must be copied exactly from a snippet URL. Never invent a URL, person or signal.",
    prompt: `Seller: ${intake.name}. ${intake.product}\nICP: ${JSON.stringify({ industries: icp.industries, companySize: icp.companySize, personas: icp.personas.map((p) => p.title), triggers: icp.triggers.map((t) => t.event), negativeSignals: icp.negativeSignals.map((n) => n.signal) })}\n\nSearch results:\n${snippets.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\nDate: ${s.date ?? "unknown"}\n${s.content}`).join("\n\n")}\n\nReturn JSON: { "companies": [10 to 15 distinct companies that could buy from the seller, not the seller itself and not news publishers. Each: name, domain, industry, employees (number, 0 if unknown), description, sourceUrl, sourceTitle, fitConfidence 0 to 1, fitReason, negativeSignalMatched (exact text of an ICP negative signal the company matches, or null), usesCompetitor (name or null), signals (trigger signals found in snippets: type one of funding|hiring|launch|job_post|news, text, sourceUrl, sourceTitle, date as YYYY-MM-DD or empty), contact (name and title of a person named in the snippets who fits a persona, or null)], "competitors": [exactly 3 competitors of the seller: name, positioning, pricingTier, differentiators (3 strings), sourceUrl (a snippet URL, or empty string if none)] }`,
    mock: () => ({ companies: [], competitors: [] }) as never,
  });
  if (r.mode === "mock" || !r.data.companies?.length) return { ...mock(), mode: "mock", error: r.error };
  // Drop any citation the model did not copy from a real search result.
  const companies: RawCompany[] = r.data.companies.map((c) => ({
    ...c, sourceUrl: urls.has(c.sourceUrl) ? c.sourceUrl : "",
    signals: c.signals.filter((s) => urls.has(s.sourceUrl)).map((s) => ({ ...s, date: s.date || new Date().toISOString().slice(0, 10) })),
    contact: c.contact ? { ...c.contact, previousEmployers: [] } : null,
  }));
  return { companies, competitors: r.data.competitors.slice(0, 3), mode: "live" };
}

function personaMatch(title: string, icp: Icp): number {
  const t = title.toLowerCase();
  const keys = ["ai", "ml", "cto", "engineering", "product", "founder", "technology", "platform", "data", "ceo", "technical"];
  const personaWords = icp.personas.flatMap((p) => p.title.toLowerCase().match(/[a-z]+/g) ?? []);
  const hit = [...new Set([...keys, ...personaWords])].filter((k) => k.length > 1 && new RegExp(`\\b${k}\\b`).test(t)).length;
  return Math.min(0.95, 0.45 + hit * 0.15);
}

export async function runDiscovery(): Promise<void> {
  const s0 = getState();
  if (!s0.intake || !s0.icp) throw new Error("Generate an ICP first");
  const intake = s0.intake, icp = s0.icp;
  const mockPace = async () => { if (!process.env.TAVILY_API_KEY) await sleep(350); };
  mutate((s) => { s.running = "discovery"; s.leads = []; s.heldBack = []; s.competitors = []; s.displacement = []; });
  try {
    // 1. Search
    const queries = process.env.TAVILY_API_KEY ? buildQueries(intake, icp) : MOCK_QUERIES;
    feed("info", `Discovery started for ${intake.name}: ${queries.length} searches planned.`);
    const { snippets, mode: searchMode } = await search(queries);
    if (searchMode === "mock") for (const q of MOCK_QUERIES) { feed("search", `Search (cached): "${q}"`, { mode: "mock" }); await mockPace(); }

    // 2. Extract companies and competitor map
    const ex = await extract(intake, icp, snippets);
    if (ex.error) feed("info", `LLM extraction fell back to cached data: ${ex.error}`, { mode: "mock" });
    feed("llm", `Extracted ${ex.companies.length} companies and ${ex.competitors.length} competitors with structured output.`, { mode: ex.mode });
    const demoData = ex.companies === MOCK_COMPANIES;
    mutate((s) => { s.modes.search = demoData ? "mock" : searchMode; s.modes.extract = ex.mode; s.competitors = ex.competitors; s.people = demoData ? MOCK_CUSTOMER_PEOPLE : []; });
    await mockPace();

    // 3. Receipt gate: no receipt, no outreach
    const leads: Lead[] = [];
    const held: HeldBack[] = [];
    ex.companies.forEach((c, i) => {
      const hold = (missing: HeldBack["missing"], reason: string) => {
        held.push({ id: uid("h"), company: c.name, domain: c.domain, missing, reason, sourceUrl: c.sourceUrl || c.signals[0]?.sourceUrl || "", sourceTitle: c.sourceTitle });
        feed("held", `Held back ${c.name}: ${reason}`);
      };
      const signals: Signal[] = c.signals.filter((x) => x.sourceUrl).map((x, j) => ({ ...x, id: `${i}-${j}-${uid("s")}`, company: c.name }))
        .sort((a, b) => (RANK[b.type] ?? 0) - (RANK[a.type] ?? 0) || b.date.localeCompare(a.date));
      if (c.negativeSignalMatched) return hold("NEGATIVE", `Negative signal: ${c.negativeSignalMatched}`);
      if (c.employees > 0 && c.employees > icp.companySize.max * 5) return hold("NEGATIVE", `Negative signal: ${c.employees.toLocaleString()} employees, far outside the ${icp.companySize.min} to ${icp.companySize.max} range`);
      if (c.fitConfidence < 0.5 || !c.sourceUrl) return hold("FIT", !c.sourceUrl ? "FIT receipt missing: no source found for the company match" : `FIT receipt missing: confidence ${c.fitConfidence.toFixed(2)} is below the 0.50 bar. ${c.fitReason}`);
      if (!signals.length) return hold("TIMING", "TIMING receipt missing: no sourced trigger signal, so there is no reason to reach out today");
      if (!c.contact?.name) return hold("PERSON", "PERSON receipt missing: no contact matching a buyer persona was found");
      const pm = personaMatch(c.contact.title, icp);
      if (pm < 0.5) return hold("PERSON", `PERSON receipt missing: ${c.contact.title} does not match any buyer persona`);
      const top = signals[0];
      leads.push({
        id: uid("lead"), company: c.name, domain: c.domain, industry: c.industry, employees: c.employees, description: c.description,
        sourceUrl: c.sourceUrl, sourceTitle: c.sourceTitle, usesCompetitor: c.usesCompetitor || null, signals,
        contact: { name: c.contact.name, title: c.contact.title, previousEmployers: c.contact.previousEmployers ?? [] },
        receipts: {
          fit: { ok: true, summary: c.fitReason, sourceUrl: c.sourceUrl, sourceTitle: c.sourceTitle, confidence: c.fitConfidence },
          person: { ok: true, summary: `${c.contact.name}, ${c.contact.title}: role matches a buyer persona`, sourceUrl: c.sourceUrl, sourceTitle: c.sourceTitle, confidence: pm },
          timing: { ok: true, summary: top.text, sourceUrl: top.sourceUrl, sourceTitle: top.sourceTitle, confidence: Math.min(0.97, 0.6 + signals.length * 0.15) },
        },
        fitScore: 0, intentScore: 0, score: 0, tier: "C", stage: "Matched", enriched: false, template: leads.length % 2 === 0 ? "A" : "B",
        messages: [], costCredits: 0, lastActor: "AI", lastAction: "Matched to ICP",
      });
    });
    mutate((s) => { s.leads = leads; s.heldBack = held; });
    feed("info", `Receipt gate: ${leads.length} leads have all three receipts, ${held.length} held back.`);
    await mockPace();

    // 4. Moss: index every signal and company snippet
    const docs: MossDoc[] = ex.companies.flatMap((c, i) => [
      ...(c.sourceUrl ? [{ id: `c${i}`, text: `${c.name}: ${c.description}`, metadata: { company: c.name, sourceUrl: c.sourceUrl, type: "profile" } }] : []),
      ...c.signals.filter((x) => x.sourceUrl).map((x, j) => ({ id: `c${i}s${j}`, text: `${c.name}: ${x.text}`, metadata: { company: c.name, sourceUrl: x.sourceUrl, type: x.type } })),
    ]);
    const idx = await indexSignals(docs);
    mutate((s) => { s.modes.moss = idx.mode; });
    feed("moss", `Moss: indexed ${idx.count} snippets and signals into index "signals"${idx.error ? ` (local fallback: ${idx.error})` : ""}`, { mode: idx.mode, ms: idx.ms });

    // 5. Graph queries
    let graph = buildGraph(getState());
    const customers = customersOf(getState());
    let warm = 0;
    const t0 = performance.now();
    mutate((s) => {
      for (const l of s.leads) {
        const p = warmIntroPath(graph, customers, l.contact.name);
        if (p) {
          warm++;
          l.warmPath = p.text; l.warmPathIds = p.ids;
          l.receipts.person = { ...l.receipts.person, summary: `${l.contact.name}, ${l.contact.title}: role match plus a ${p.hops} hop warm intro path`, confidence: Math.min(0.98, l.receipts.person.confidence + 0.12) };
        }
      }
    });
    feed("graph", `Graph query: warm intro paths from ${customers.length} customers via previously_employed_at. ${warm} found.`, { ms: Math.round((performance.now() - t0) * 100) / 100 });
    await meter("graph_query", undefined, "warm intro");
    graph = buildGraph(getState());
    const disp = displacementTargets(graph);
    mutate((s) => { s.displacement = disp; });
    feed("graph", `Graph query: displacement targets (companies using a competitor). ${disp.length} found${disp.length ? ": " + disp.map((d) => `${d.company} uses ${d.competitor}`).join(", ") : ""}.`);
    await meter("graph_query", undefined, "displacement");

    // 6. Retrieve top signals from Moss per lead, then score
    for (const lead of getState().leads) {
      const q = await queryCompany(lead.company, "funding hiring launch job post trigger signal", 5);
      const intent = intentScore(lead.signals);
      const sc = composite(lead.receipts.fit.confidence, intent, !!lead.warmPath);
      mutate((s) => {
        const l = s.leads.find((x) => x.id === lead.id)!;
        l.moss = { ms: q.ms, mode: q.mode, hits: q.hits.map((h) => ({ text: h.text, sourceUrl: h.sourceUrl, score: h.score })) };
        l.intentScore = intent; l.fitScore = sc.fitScore; l.score = sc.score; l.tier = sc.tier;
      });
      feed("moss", `Moss: top ${q.hits.length} signals for ${lead.company}. Score ${sc.score}, tier ${sc.tier}.`, { mode: q.mode, ms: q.ms });
      audit("AI", "Lead matched", `${lead.company} matched with 3 receipts. Score ${sc.score}, tier ${sc.tier}.`, lead.id);
    }
    mutate((s) => { s.leads.sort((a, b) => b.score - a.score); });
    for (const h of held) audit("AI", "Lead held back", `${h.company}: ${h.reason}`);
    feed("info", "Discovery complete.");
  } finally {
    mutate((s) => { s.running = null; });
  }
}
