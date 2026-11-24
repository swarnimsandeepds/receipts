import { fail, ok } from "@/lib/api";
import { meter } from "@/lib/billing";
import { audit, getState, mutate } from "@/lib/store";
export const dynamic = "force-dynamic";

// Mandatory human review. Approve queues the message. Nothing is sent.
export async function POST(req: Request) {
  const b = (await req.json()) as { leadId: string; messageId: string; action: "approve" | "edit" | "reject"; body?: string; subject?: string };
  const lead = getState().leads.find((l) => l.id === b.leadId);
  const msg = lead?.messages.find((m) => m.id === b.messageId);
  if (!lead || !msg) return fail("Message not found", 404);
  if (b.action === "edit") {
    mutate(() => { msg.body = b.body ?? msg.body; if (b.subject !== undefined) msg.subject = b.subject; msg.edited = true; msg.status = "draft"; lead.lastActor = "Rep"; lead.lastAction = `Edited ${msg.label}`; });
    audit("Rep", "Message edited", `${lead.company}: ${msg.label}`, lead.id);
  } else if (b.action === "reject") {
    mutate(() => { msg.status = "rejected"; lead.lastActor = "Rep"; lead.lastAction = `Rejected ${msg.label}`; });
    audit("Rep", "Message rejected", `${lead.company}: ${msg.label}`, lead.id);
  } else {
    if (msg.status === "approved") return ok();
    const moved = lead.stage === "Matched";
    mutate(() => { msg.status = "approved"; msg.approvedAt = new Date().toISOString(); if (moved) lead.stage = "Contacted"; lead.lastActor = "Rep"; lead.lastAction = `Approved ${msg.label}`; });
    audit("Rep", "Message approved", `${lead.company}: ${msg.label} added to the send queue (not sent).`, lead.id);
    if (moved) audit("AI", "Stage changed", `${lead.company}: Matched -> Contacted after approval.`, lead.id);
    await meter("outreach_sent", lead.id, `${lead.company}, queued`);
  }
  return ok();
}
