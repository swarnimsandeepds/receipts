import { fail, ok } from "@/lib/api";
import { generateIcp } from "@/lib/icp";
import { audit, feed, mutate, resetState } from "@/lib/store";
import type { Icp, Intake } from "@/lib/types";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST: generate an ICP from the intake form.
export async function POST(req: Request) {
  const b = (await req.json()) as Partial<Intake> & { reset?: boolean };
  if (!b.product?.trim()) return fail("Product description is required");
  const intake: Intake = { name: b.name?.trim() || b.product.trim().split(/[\s(:,.]/)[0], product: b.product.trim(), customers: b.customers?.trim() ?? "", pricing: b.pricing?.trim() ?? "" };
  if (b.reset) resetState();
  mutate((s) => { s.intake = intake; s.running = "icp"; });
  feed("info", `Intake received for ${intake.name}. Generating ICP.`);
  try {
    const r = await generateIcp(intake);
    mutate((s) => { s.icp = r.icp; s.modes.icp = r.mode; });
    feed("llm", `ICP generated: ${r.icp.industries.length} industries, ${r.icp.personas.length} personas, ${r.icp.triggers.length} triggers, ${r.icp.negativeSignals.length} negative signals.`, { mode: r.mode });
    audit("AI", "ICP generated", `${r.icp.industries.map((i) => i.name).join(", ")}`);
  } finally {
    mutate((s) => { s.running = null; });
  }
  return ok();
}

// PUT: save user edits to the ICP cards.
export async function PUT(req: Request) {
  const b = (await req.json()) as { icp: Icp; note?: string };
  if (!b.icp) return fail("icp required");
  mutate((s) => { s.icp = b.icp; });
  audit("Rep", "ICP edited", b.note || "ICP cards updated");
  return ok();
}
