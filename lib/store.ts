import fs from "fs";
import path from "path";
import type { Actor, FeedKind, Mode, State } from "./types";

const FILE = path.join(process.cwd(), "data", "store.json");
export const START_CREDITS = 40;

function fresh(): State {
  return {
    version: 1, intake: null, icp: null, modes: {}, leads: [], heldBack: [], competitors: [], people: [], displacement: [],
    feed: [], audit: [], credits: { balance: START_CREDITS, ledger: [] }, running: null,
  };
}

const g = globalThis as unknown as { __receipts?: State };

function load(): State {
  try {
    const s = JSON.parse(fs.readFileSync(FILE, "utf8")) as State;
    if (s && typeof s.version === "number" && Array.isArray(s.leads)) return { ...fresh(), ...s, running: null };
  } catch {}
  return fresh();
}

function save(s: State) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(s));
  } catch {}
}

export function getState(): State {
  if (!g.__receipts) g.__receipts = load();
  return g.__receipts;
}

export function mutate(fn: (s: State) => void): State {
  const s = getState();
  fn(s);
  s.version++;
  save(s);
  return s;
}

export function resetState(): State {
  const keep = g.__receipts?.version ?? 0;
  g.__receipts = fresh();
  g.__receipts.version = keep + 1;
  save(g.__receipts);
  return g.__receipts;
}

let n = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(n++).toString(36)}`;

export function feed(kind: FeedKind, text: string, extra: { mode?: Mode; ms?: number } = {}) {
  mutate((s) => {
    s.feed.push({ id: uid("f"), ts: new Date().toISOString(), kind, text, ...extra });
    if (s.feed.length > 400) s.feed = s.feed.slice(-400);
  });
}

export function audit(actor: Actor, action: string, detail: string, leadId?: string) {
  mutate((s) => {
    s.audit.push({ id: uid("a"), ts: new Date().toISOString(), actor, action, detail, leadId });
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
