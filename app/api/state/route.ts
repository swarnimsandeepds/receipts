import { ok } from "@/lib/api";
import { resetState } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() { return ok(); }
export async function DELETE() { resetState(); return ok(); }
