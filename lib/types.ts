export type Mode = "live" | "mock";
export type Tier = "A" | "B" | "C";
export type Stage = "Matched" | "Contacted" | "Replied" | "Meeting Booked" | "Closed/Lost";
export const STAGES: Stage[] = ["Matched", "Contacted", "Replied", "Meeting Booked", "Closed/Lost"];
export type Actor = "AI" | "Rep";

export interface Intake { name: string; product: string; customers: string; pricing: string }

export interface Icp {
  industries: { name: string; naics: string; confidence: number }[];
  companySize: { min: number; max: number; confidence: number };
  personas: { title: string; why: string; tone: string; confidence: number }[];
  triggers: { event: string; confidence: number }[];
  negativeSignals: { signal: string; confidence: number }[];
  adjacentSegments: { id: string; name: string; rationale: string; confidence: number; status: "proposed" | "accepted" | "dismissed" }[];
}

export type SignalType = "funding" | "hiring" | "launch" | "job_post" | "news";
export interface Signal { id: string; company: string; type: SignalType; text: string; sourceUrl: string; sourceTitle: string; date: string }

export interface Receipt { ok: boolean; summary: string; sourceUrl?: string; sourceTitle?: string; confidence: number }
export interface Contact { name: string; title: string; email?: string; emailVerified?: boolean; emailConfidence?: number; linkedin?: string; previousEmployers: string[] }
export interface Message { id: string; step: 1 | 2 | 3; channel: "email" | "linkedin"; label: string; subject?: string; body: string; status: "draft" | "approved" | "rejected"; edited: boolean; approvedAt?: string }

export interface RawCompany {
  name: string; domain: string; industry: string; employees: number; description: string;
  sourceUrl: string; sourceTitle: string; fitConfidence: number; fitReason: string;
  negativeSignalMatched?: string | null; usesCompetitor?: string | null;
  signals: Omit<Signal, "id" | "company">[];
  contact?: { name: string; title: string; previousEmployers?: string[] } | null;
}

export interface Lead {
  id: string; company: string; domain: string; industry: string; employees: number; description: string;
  sourceUrl: string; sourceTitle: string; usesCompetitor?: string | null;
  signals: Signal[]; contact: Contact;
  receipts: { fit: Receipt; person: Receipt; timing: Receipt };
  fitScore: number; intentScore: number; score: number; tier: Tier;
  stage: Stage; warmPath?: string; warmPathIds?: string[];
  enriched: boolean; enrichMode?: Mode; outreachMode?: Mode; template: "A" | "B";
  messages: Message[]; costCredits: number;
  moss?: { ms: number; mode: Mode; hits: { text: string; sourceUrl: string; score: number }[] };
  lastActor: Actor; lastAction: string;
}

export interface HeldBack { id: string; company: string; domain: string; missing: "FIT" | "PERSON" | "TIMING" | "NEGATIVE"; reason: string; sourceUrl: string; sourceTitle: string }
export interface Competitor { name: string; positioning: string; pricingTier: string; differentiators: string[]; sourceUrl: string }

export type FeedKind = "search" | "llm" | "moss" | "graph" | "held" | "credit" | "enrich" | "info";
export interface FeedEvent { id: string; ts: string; kind: FeedKind; text: string; mode?: Mode; ms?: number }
export interface AuditEntry { id: string; ts: string; actor: Actor; action: string; detail: string; leadId?: string }
export interface LedgerEntry { id: string; ts: string; event: string; credits: number; leadId?: string; mode: Mode }

export interface GraphNode { id: string; type: "Company" | "Person" | "Product" | "Competitor" | "Signal"; label: string; customer?: boolean; target?: boolean }
export type EdgeType = "works_at" | "competes_with" | "matched_to" | "contacted_via" | "replied_to" | "previously_employed_at" | "uses";
export interface GraphEdge { from: string; to: string; type: EdgeType }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

export interface State {
  version: number;
  intake: Intake | null;
  icp: Icp | null;
  modes: { icp?: Mode; search?: Mode; extract?: Mode; moss?: Mode; billing?: Mode };
  leads: Lead[];
  heldBack: HeldBack[];
  competitors: Competitor[];
  people: { name: string; title: string; company: string; previousEmployers: string[] }[];
  displacement: { company: string; competitor: string }[];
  feed: FeedEvent[];
  audit: AuditEntry[];
  credits: { balance: number; ledger: LedgerEntry[] };
  running: string | null;
}
export interface ClientState extends State { graph: Graph; integrations: Record<string, Mode> }
