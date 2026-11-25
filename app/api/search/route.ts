import { ok } from "@/lib/api";
import { searchAll, type MossDoc } from "@/lib/moss";
import { feed, getState } from "@/lib/store";
export const dynamic = "force-dynamic";

// Semantic search over all indexed signals (Moss). Only explicit searches are written to the agent feed.
export async function POST(req: Request) {
  const b = (await req.json()) as { query?: string; topK?: number; log?: boolean };
  const query = (b.query ?? "").trim();
  if (query.length < 2) return ok({ result: { hits: [], ms: 0, mode: "mock" } });
  const docs: MossDoc[] = getState().leads.flatMap((l) => l.signals.map((s) => ({ id: s.id, text: `${l.company}: ${s.text}`, metadata: { company: l.company, sourceUrl: s.sourceUrl, type: s.type } })));
  const result = await searchAll(query, b.topK ?? 8, docs);
  if (b.log) feed("moss", `Moss search: "${query.slice(0, 60)}" returned ${result.hits.length} signals.`, { mode: result.mode, ms: result.ms });
  return ok({ result });
}
