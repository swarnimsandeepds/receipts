// Contact enrichment. There is no email provider connected, so the address is a pattern guess
// (first.last@domain) and is always marked unverified.
import type { Lead, Mode } from "./types";

export async function enrichContact(lead: Lead): Promise<{ email: string; verified: boolean; confidence: number; linkedin: string; mode: Mode }> {
  const parts = lead.contact.name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "team";
  const linkedin = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${lead.contact.name} ${lead.company}`)}`;
  return { email: `${first}.${last}@${lead.domain}`, verified: false, confidence: 0.5, linkedin, mode: "mock" };
}
