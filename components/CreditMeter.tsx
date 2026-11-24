"use client";
import { Coins, Plus } from "lucide-react";
import type { ClientState } from "@/lib/types";
import { btnSm, ModeBadge } from "./ui";

export function CreditMeter({ state, onTopUp }: { state: ClientState; onTopUp: () => void }) {
  const b = state.credits.balance;
  const low = b < 5;
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${low ? "border-rose-300 bg-rose-50" : "border-neutral-200 bg-white"}`}>
      <Coins size={16} className={low ? "text-rose-600" : "text-neutral-600"} />
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">Credits <ModeBadge mode={state.modes.billing ?? state.integrations.Flexprice} label="Flexprice" /></div>
        <div className={`font-mono text-lg font-semibold tabular-nums ${low ? "text-rose-700" : ""}`}>{b}</div>
      </div>
      <button className={btnSm} onClick={onTopUp}><Plus size={12} /> Top up</button>
    </div>
  );
}
