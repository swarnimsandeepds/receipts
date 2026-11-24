// Moss retrieval: index "signals". Live via @moss-js/moss, with a local in-memory index as fallback.
import type { Mode } from "./types";

export const INDEX = "signals";
export interface MossDoc { id: string; text: string; metadata: { company: string; sourceUrl: string; type: string } }
export interface MossHit { text: string; sourceUrl: string; score: number; company: string }

const g = globalThis as unknown as { __mossLocal?: MossDoc[]; __mossClient?: unknown; __mossLive?: boolean };
export const mossConfigured = () => !!(process.env.MOSS_PROJECT_ID && process.env.MOSS_PROJECT_KEY);

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms))]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function client(): Promise<any> {
  if (!g.__mossClient) {
    const { MossClient } = await import("@moss-js/moss");
    g.__mossClient = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!);
  }
  return g.__mossClient;
}

export async function indexSignals(docs: MossDoc[]): Promise<{ mode: Mode; ms: number; count: number; error?: string }> {
  g.__mossLocal = docs; // always keep the local copy for fallback
  g.__mossLive = false;
  const t0 = performance.now();
  if (mossConfigured() && docs.length) {
    try {
      const c = await client();
      try { await withTimeout(c.deleteIndex(INDEX), 15000, "moss deleteIndex"); } catch {}
      await withTimeout(c.createIndex(INDEX, docs), 90000, "moss createIndex");
      await withTimeout(c.loadIndex(INDEX), 60000, "moss loadIndex");
      g.__mossLive = true;
      return { mode: "live", ms: Math.round(performance.now() - t0), count: docs.length };
    } catch (e) {
      return { mode: "mock", ms: Math.round(performance.now() - t0), count: docs.length, error: e instanceof Error ? e.message.slice(0, 160) : "moss failed" };
    }
  }
  return { mode: "mock", ms: Math.round(performance.now() - t0), count: docs.length };
}

const tokens = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

function localQuery(company: string, query: string, topK: number): MossHit[] {
  const q = new Set(tokens(query));
  return (g.__mossLocal ?? [])
    .filter((d) => d.metadata.company === company)
    .map((d) => {
      const t = tokens(d.text);
      const overlap = t.filter((w) => q.has(w)).length;
      return { text: d.text, sourceUrl: d.metadata.sourceUrl, company, score: Math.min(0.99, 0.35 + overlap / Math.max(6, t.length)) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Top signals for one company. Returns retrieval time in ms. */
export async function queryCompany(company: string, query: string, topK = 5): Promise<{ hits: MossHit[]; ms: number; mode: Mode }> {
  const t0 = performance.now();
  if (g.__mossLive) {
    try {
      const c = await client();
      const res = await withTimeout<{ docs: { text: string; score: number; metadata?: Record<string, string> }[]; timeTakenInMs?: number }>(
        c.query(INDEX, `${company} ${query}`, { topK: 25 }), 15000, "moss query");
      const hits = res.docs
        .filter((d) => d.metadata?.company === company)
        .slice(0, topK)
        .map((d) => ({ text: d.text, sourceUrl: d.metadata?.sourceUrl ?? "", company, score: d.score }));
      if (hits.length) return { hits, ms: Math.round((res.timeTakenInMs || performance.now() - t0) * 100) / 100, mode: "live" };
    } catch {}
  }
  const hits = localQuery(company, query, topK);
  return { hits, ms: Math.round((performance.now() - t0) * 100) / 100, mode: "mock" };
}
