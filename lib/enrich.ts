// Hunter enrichment via fetch, with a mock fallback.
import type { Lead, Mode } from "./types";

const slugName = (n: string) => n.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/);

export async function enrichContact(lead: Lead): Promise<{ email: string; verified: boolean; confidence: number; linkedin: string; mode: Mode }> {
  const [first, ...rest] = slugName(lead.contact.name);
  const last = rest[rest.length - 1] ?? "";
  const linkedinSearch = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${lead.contact.name} ${lead.company}`)}`;
  const key = process.env.HUNTER_API_KEY;
  if (key && first && last) {
    try {
      const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(lead.domain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const json = await res.json();
      const d = json?.data;
      if (res.ok && d?.email) {
        return { email: d.email, verified: d.verification?.status === "valid", confidence: (d.score ?? 0) / 100, linkedin: d.linkedin_url || linkedinSearch, mode: "live" };
      }
    } catch {}
  }
  return { email: `${first}.${last || "team"}@${lead.domain}`, verified: !key, confidence: 0.9, linkedin: linkedinSearch, mode: "mock" };
}
