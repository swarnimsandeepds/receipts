import { ok } from "@/lib/api";
import { topUp } from "@/lib/billing";
import { audit } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function POST() { topUp(); audit("Rep", "Credits topped up", "50 credits added"); return ok(); }
