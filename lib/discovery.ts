// Discovery: seeded account dataset -> receipt gate -> Moss index -> graph queries -> scoring.
// There is no web search provider. Accounts and signals come from the seeded dataset in lib/mock.ts.
import { MOCK_COMPANIES, MOCK_COMPETITORS, MOCK_CUSTOMER_PEOPLE, MOCK_QUERIES } from "./mock";
import { audit, feed, getState, mutate, sleep, uid } from "./store";
import { indexSignals, queryCompany, type MossDoc } from "./moss";
import { buildGraph, customersOf, displacementTargets, warmIntroPath } from "./graph";
import { composite, intentScore } from "./scoring";
import { meter } from "./billing";
import type { Competitor, HeldBack, Icp, Lead, RawCompany, Signal } from "./types";

const RANK: Record<string, number> = { funding: 4, launch: 3, hiring: 2, job_post: 2, news: 1 };
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
  const pace = () => sleep(350);
  mutate((s) => { s.running = "discovery"; s.leads = []; s.heldBack = []; s.competitors = []; s.displacement = []; });
  try {
    // 1. Scan the seeded account dataset
    feed("info", `Discovery started for ${intake.name}: scanning the account dataset with ${MOCK_QUERIES.length} queries.`);
    for (const q of MOCK_QUERIES) { feed("search", `Dataset query: "${q}"`, { mode: "mock" }); await pace(); }

    // 2. Load companies and the competitor map
    const ex: { companies: RawCompany[]; competitors: Competitor[] } = { companies: MOCK_COMPANIES, competitors: MOCK_COMPETITORS };
    feed("info", `Loaded ${ex.companies.length} companies and ${ex.competitors.length} competitors from the seeded dataset.`, { mode: "mock" });
    mutate((s) => { s.modes.search = "mock"; s.modes.extract = undefined; s.competitors = ex.competitors; s.people = MOCK_CUSTOMER_PEOPLE; });
    await pace();

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
    await pace();

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
