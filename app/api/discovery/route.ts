import { fail, ok } from "@/lib/api";
import { runDiscovery } from "@/lib/discovery";
import { getState } from "@/lib/store";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST() {
  if (getState().running) return fail("A run is already in progress", 409);
  try { await runDiscovery(); } catch (e) { return fail(e instanceof Error ? e.message : "Discovery failed", 500); }
  return ok();
}
