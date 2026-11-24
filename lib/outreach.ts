// Enrich one lead and draft its 3 step sequence. Nothing is ever sent.
import { z } from "zod";
import { llmJson } from "./llm";
import { mockSequence } from "./mock";
import { audit, feed, getState, mutate, uid } from "./store";
import { enrichContact } from "./enrich";
import { queryCompany } from "./moss";
import { canAfford, meter } from "./billing";
import type { Message } from "./types";

const SeqSchema = z.object({
  email1: z.object({ subject: z.string(), body: z.string() }),
  linkedin: z.object({ body: z.string() }),
  email2: z.object({ subject: z.string(), body: z.string() }),
});

export async function enrichAndDraft(leadId: string): Promise<{ ok: true } | { ok: false; error: "no_credits" | "not_found" }> {
  const s = getState();
  const lead = s.leads.find((l) => l.id === leadId);
  if (!lead) return { ok: false, error: "not_found" };
  if (lead.enriched) return { ok: true };
  if (!canAfford("lead_enriched")) {
    feed("credit", `Enrichment blocked for ${lead.company}: out of credits. Top up to continue.`);
    return { ok: false, error: "no_credits" };
  }
  // The core rule, enforced again at draft time.
  const r = lead.receipts;
  if (!(r.fit.ok && r.person.ok && r.timing.ok && r.fit.sourceUrl && r.timing.sourceUrl)) return { ok: false, error: "not_found" };

  const e = await enrichContact(lead);
  feed("enrich", `Hunter: ${lead.contact.name} at ${lead.domain} -> ${e.email} (${e.verified ? "verified" : "unverified"})`, { mode: e.mode });
  await meter("lead_enriched", lead.id, lead.company);

  const q = await queryCompany(lead.company, `${lead.receipts.timing.summary} why now`, 5);
  feed("moss", `Moss: retrieved top ${q.hits.length} signals for ${lead.company} to ground the draft.`, { mode: q.mode, ms: q.ms });

  const persona = s.icp?.personas.find((p) => lead.contact.title.toLowerCase().split(/\W+/).some((w) => w.length > 2 && p.title.toLowerCase().includes(w))) ?? s.icp?.personas[0];
  const tone = persona?.tone ?? "concise, professional";
  const mock = () => { const m = mockSequence(lead, s.intake, tone); return { email1: { subject: m[0].subject!, body: m[0].body }, linkedin: { body: m[1].body }, email2: { subject: m[2].subject!, body: m[2].body } }; };
  const seq = await llmJson({
    schema: SeqSchema,
    system: "You write short, specific B2B outreach. Plain language, no hype, no em dashes. Never invent facts beyond what is provided.",
    prompt: `Seller: ${s.intake?.name}. ${s.intake?.product}\nPricing: ${s.intake?.pricing}\nLead: ${lead.contact.name}, ${lead.contact.title} at ${lead.company} (${lead.description})\nTone for this persona: ${tone}\nTemplate style: ${lead.template === "A" ? "A, open with the trigger signal" : "B, open with the pain, then cite the signal"}\nTIMING receipt (must be quoted or closely paraphrased in every message): "${lead.receipts.timing.summary}"\nFIT receipt: ${lead.receipts.fit.summary}\n${lead.warmPath ? `Warm intro path: ${lead.warmPath}\n` : ""}Signals retrieved from Moss:\n${q.hits.map((h) => `- ${h.text}`).join("\n")}\n\nReturn JSON: { "email1": {"subject","body"} (under 120 words), "linkedin": {"body"} (under 300 characters), "email2": {"subject","body"} (follow up, under 80 words) }. Sign emails as "Your name".`,
    mock,
  });
  feed("llm", `Drafted 3 step sequence for ${lead.company} (template ${lead.template}, tone: ${tone}).`, { mode: seq.mode });

  const mk = (step: 1 | 2 | 3, channel: Message["channel"], label: string, body: string, subject?: string): Message => ({ id: uid("m"), step, channel, label, subject, body, status: "draft", edited: false });
  mutate((st) => {
    const l = st.leads.find((x) => x.id === leadId)!;
    l.contact = { ...l.contact, email: e.email, emailVerified: e.verified, emailConfidence: e.confidence, linkedin: e.linkedin };
    l.enriched = true; l.enrichMode = e.mode; l.outreachMode = seq.mode;
    l.moss = { ms: q.ms, mode: q.mode, hits: q.hits.map((h) => ({ text: h.text, sourceUrl: h.sourceUrl, score: h.score })) };
    l.messages = [
      mk(1, "email", "Email", seq.data.email1.body, seq.data.email1.subject),
      mk(2, "linkedin", "LinkedIn note", seq.data.linkedin.body),
      mk(3, "email", "Follow up email", seq.data.email2.body, seq.data.email2.subject),
    ];
    l.lastActor = "AI"; l.lastAction = "Drafted outreach";
  });
  audit("AI", "Lead enriched", `${lead.company}: found ${e.email}, drafted 3 messages for review.`, lead.id);
  return { ok: true };
}
