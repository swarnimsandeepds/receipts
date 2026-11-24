import { z } from "zod";
import { llmJson } from "./llm";
import { mockIcp } from "./mock";
import type { Icp, Intake } from "./types";

const conf = z.coerce.number().min(0).max(1);
export const IcpSchema = z.object({
  industries: z.array(z.object({ name: z.string(), naics: z.coerce.string(), confidence: conf })).min(1),
  companySize: z.object({ min: z.coerce.number(), max: z.coerce.number(), confidence: conf }),
  personas: z.array(z.object({ title: z.string(), why: z.string(), tone: z.string(), confidence: conf })).min(1),
  triggers: z.array(z.object({ event: z.string(), confidence: conf })).min(1),
  negativeSignals: z.array(z.object({ signal: z.string(), confidence: conf })),
  adjacentSegments: z.array(z.object({ name: z.string(), rationale: z.string(), confidence: conf })).max(4),
});

export async function generateIcp(intake: Intake) {
  const r = await llmJson({
    schema: IcpSchema,
    system: "You are a B2B go-to-market strategist. You define precise ideal customer profiles.",
    prompt: `Product: ${intake.name}\nDescription: ${intake.product}\nExisting customers: ${intake.customers}\nPricing: ${intake.pricing}\n\nReturn JSON with keys: industries (3 to 4 items: name, naics 6 digit code as string, confidence 0 to 1), companySize (min, max employees, confidence), personas (2 to 3: title, why, tone, confidence), triggers (3 to 4 trigger events that mean buy now: event, confidence), negativeSignals (2 to 3 disqualifiers: signal, confidence), adjacentSegments (exactly 2 adjacent segments worth testing: name, rationale, confidence).`,
    mock: () => mockIcp(intake),
  });
  const icp: Icp = {
    ...r.data,
    adjacentSegments: r.data.adjacentSegments.slice(0, 2).map((s, i) => ({ ...s, id: `seg${i + 1}`, status: "proposed" as const })),
  };
  return { icp, mode: r.mode, error: r.error };
}
