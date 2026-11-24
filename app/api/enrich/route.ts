import { fail, ok } from "@/lib/api";
import { enrichAndDraft } from "@/lib/outreach";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(req: Request) {
  const { leadId } = (await req.json()) as { leadId: string };
  const r = await enrichAndDraft(leadId);
  if (!r.ok) return r.error === "no_credits" ? fail("no_credits", 402) : fail("Lead not found or missing a receipt", 404);
  return ok();
}
