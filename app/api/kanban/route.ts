import { fail, ok } from "@/lib/api";
import { audit, getState, mutate } from "@/lib/store";
import { STAGES, type Stage } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = (await req.json()) as { leadId: string; stage: Stage };
  const lead = getState().leads.find((l) => l.id === b.leadId);
  if (!lead || !STAGES.includes(b.stage)) return fail("Bad move", 400);
  const from = lead.stage;
  if (from !== b.stage) {
    mutate(() => { lead.stage = b.stage; lead.lastActor = "Rep"; lead.lastAction = `Moved to ${b.stage}`; });
    audit("Rep", "Stage changed", `${lead.company}: ${from} -> ${b.stage} (drag and drop).`, lead.id);
  }
  return ok();
}
