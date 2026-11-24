// Quests are derived from real workspace state, so XP only moves when you actually use the product.
import type { ClientState } from "./types";

export interface Quest { id: string; title: string; hint: string; xp: number; done: boolean; progress?: string }

export function computeQuests(s: ClientState): Quest[] {
  const audit = (a: string) => s.audit.filter((x) => x.action === a).length;
  const enriched = s.leads.filter((l) => l.enriched).length;
  const approved = s.leads.reduce((n, l) => n + l.messages.filter((m) => m.status === "approved").length, 0);
  const graphRuns = s.credits.ledger.filter((e) => e.event === "graph_query").length;
  const repMoves = s.audit.filter((x) => x.action === "Stage changed" && x.actor === "Rep").length;
  return [
    { id: "icp", title: "Define your ICP", hint: "Generate an ICP from the intake form, or load the demo.", xp: 50, done: !!s.icp },
    { id: "discover", title: "Run discovery", hint: "Find accounts and trigger signals.", xp: 100, done: s.leads.length > 0, progress: s.leads.length ? `${s.leads.length} leads` : undefined },
    { id: "gate", title: "Gatekeeper", hint: "Let the receipt gate hold back a lead with missing proof.", xp: 50, done: s.heldBack.length > 0, progress: s.heldBack.length ? `${s.heldBack.length} held` : undefined },
    { id: "enrich", title: "Enrich 5 leads", hint: "Add contact details and draft sequences.", xp: 100, done: enriched >= 5, progress: `${Math.min(enriched, 5)}/5` },
    { id: "approve", title: "First approval", hint: "Open a lead and approve a drafted message.", xp: 75, done: approved >= 1 },
    { id: "editor", title: "Red pen", hint: "Edit a draft before approving it.", xp: 50, done: audit("Message edited") >= 1 },
    { id: "critic", title: "Tough critic", hint: "Reject a message that is not good enough.", xp: 50, done: audit("Message rejected") >= 1 },
    { id: "graph", title: "Networker", hint: "Run a warm intro or displacement query on the Graph tab.", xp: 75, done: graphRuns >= 3, progress: `${Math.min(graphRuns, 3)}/3 graph queries` },
    { id: "pipeline", title: "Pipeline mover", hint: "Drag a card to a new stage on the Pipeline tab.", xp: 50, done: repMoves >= 1 },
    { id: "meeting", title: "Closer", hint: "Get a lead to Meeting Booked.", xp: 150, done: s.leads.some((l) => l.stage === "Meeting Booked") },
    { id: "topup", title: "Refuel", hint: "Run out of credits, then top up.", xp: 50, done: s.credits.ledger.some((e) => e.event === "top_up") },
    { id: "queue", title: "Full sequence", hint: "Approve all three messages for one lead.", xp: 100, done: s.leads.some((l) => l.messages.length === 3 && l.messages.every((m) => m.status === "approved")) },
  ];
}

export const RANKS = ["Receipt Rookie", "Signal Scout", "Proof Collector", "Pipeline Pro", "Warm Path Finder", "Chief Receipts Officer"];
export const XP_PER_LEVEL = 150;

export function levelFor(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return { level, rank: RANKS[Math.min(level - 1, RANKS.length - 1)], into: xp % XP_PER_LEVEL, pct: Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100) };
}

// XP can be exchanged for gift cards. There is no fulfilment partner yet, so a redemption is
// recorded as a request and nothing is issued automatically.
export const REWARDS = [
  { id: "gc10", xp: 900, label: "$10 Amazon gift card" },
];
export const REDEEM_KEY = "receipts.redemptions";
export interface Redemption { id: string; rewardId: string; label: string; xp: number; ts: string }
