import { fail, ok } from "@/lib/api";
import { meter } from "@/lib/billing";
import { buildGraph, customersOf, displacementTargets, warmIntroPath } from "@/lib/graph";
import { feed, getState, mutate } from "@/lib/store";
export const dynamic = "force-dynamic";

// On demand graph queries. Each one is metered as graph_query.
export async function POST(req: Request) {
  const b = (await req.json()) as { query: "warm_intro" | "displacement"; leadId?: string };
  const s = getState();
  const graph = buildGraph(s);
  const t0 = performance.now();
  if (b.query === "displacement") {
    const result = displacementTargets(graph);
    mutate((st) => { st.displacement = result; });
    feed("graph", `Graph query: displacement targets. ${result.length} found.`, { ms: Math.round((performance.now() - t0) * 100) / 100 });
    await meter("graph_query", undefined, "displacement");
    return ok({ result });
  }
  const lead = s.leads.find((l) => l.id === b.leadId);
  if (!lead) return fail("Lead not found", 404);
  const path = warmIntroPath(graph, customersOf(s), lead.contact.name);
  mutate(() => { lead.warmPath = path?.text; lead.warmPathIds = path?.ids; });
  feed("graph", `Graph query: warm intro to ${lead.contact.name} at ${lead.company}. ${path ? `${path.hops} hop path found.` : "No path."}`, { ms: Math.round((performance.now() - t0) * 100) / 100 });
  await meter("graph_query", lead.id, "warm intro");
  return ok({ result: path });
}
