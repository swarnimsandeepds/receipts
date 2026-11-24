import type { Signal, Tier } from "./types";

const WEIGHT: Record<string, number> = { funding: 45, launch: 40, hiring: 34, job_post: 34, news: 20 };

/** Intent 0 to 100 from trigger signals, decayed by age. */
export function intentScore(signals: Signal[]): number {
  let total = 0;
  for (const s of signals) {
    const age = Math.max(0, (Date.now() - new Date(s.date).getTime()) / 864e5);
    const decay = Number.isFinite(age) ? Math.max(0.35, 1 - age / 120) : 0.6;
    total += (WEIGHT[s.type] ?? 15) * decay;
  }
  return Math.round(Math.min(100, total * 1.25));
}

/** Composite 0 to 100: 55% fit, 45% intent, plus a small bonus for a warm path. */
export function composite(fitConfidence: number, intent: number, warm: boolean): { fitScore: number; score: number; tier: Tier } {
  const fitScore = Math.round(fitConfidence * 100);
  const score = Math.min(100, Math.round(0.55 * fitScore + 0.45 * intent + (warm ? 6 : 0)));
  return { fitScore, score, tier: score >= 75 ? "A" : score >= 50 ? "B" : "C" };
}
