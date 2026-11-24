// Flexprice usage metering with a local credit ledger as the source of truth for the UI.
import { getState, mutate, uid, feed } from "./store";
import type { Mode } from "./types";

import { COSTS } from "./costs";
export { COSTS };
export type MeterEvent = keyof typeof COSTS;
export const TOP_UP = 50;
const CUSTOMER = process.env.FLEXPRICE_CUSTOMER_ID || "receipts-demo";

export const canAfford = (event: MeterEvent) => getState().credits.balance >= COSTS[event];

async function sendToFlexprice(event: MeterEvent, leadId?: string): Promise<Mode> {
  if (!process.env.FLEXPRICE_API_KEY) return "mock";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("@flexprice/sdk");
    const Cls = mod.FlexPrice ?? mod.Flexprice;
    const client = new Cls({ apiKeyAuth: process.env.FLEXPRICE_API_KEY, ...(process.env.FLEXPRICE_API_HOST ? { serverURL: process.env.FLEXPRICE_API_HOST } : {}) });
    await Promise.race([
      client.events.ingestEvent({ eventName: event, externalCustomerId: CUSTOMER, properties: { credits: String(COSTS[event]), lead_id: leadId ?? "" }, source: "receipts" }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("flexprice timeout")), 6000)),
    ]);
    return "live";
  } catch {
    return "mock";
  }
}

/** Deduct credits locally and send the usage event to Flexprice when configured. */
export async function meter(event: MeterEvent, leadId?: string, note?: string): Promise<Mode> {
  const mode = await sendToFlexprice(event, leadId);
  mutate((s) => {
    s.credits.balance = Math.max(0, s.credits.balance - COSTS[event]);
    s.credits.ledger.push({ id: uid("l"), ts: new Date().toISOString(), event, credits: -COSTS[event], leadId, mode });
    s.modes.billing = mode;
    if (leadId) {
      const l = s.leads.find((x) => x.id === leadId);
      if (l) l.costCredits += COSTS[event];
    }
  });
  feed("credit", `${event}: ${COSTS[event]} credit${COSTS[event] > 1 ? "s" : ""} spent${note ? ` (${note})` : ""}. Balance ${getState().credits.balance}.`, { mode });
  return mode;
}

export function topUp() {
  mutate((s) => {
    s.credits.balance += TOP_UP;
    s.credits.ledger.push({ id: uid("l"), ts: new Date().toISOString(), event: "top_up", credits: TOP_UP, mode: "mock" });
  });
  feed("credit", `Top up: ${TOP_UP} credits added. Balance ${getState().credits.balance}.`);
}
