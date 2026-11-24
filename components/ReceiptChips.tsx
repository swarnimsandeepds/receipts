"use client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Check, X } from "lucide-react";
import type { Lead, Receipt } from "@/lib/types";
import { Conf, Src } from "./ui";

function Chip({ name, r }: { name: string; r: Receipt }) {
  return (
    <Tooltip.Root delayDuration={100}>
      <Tooltip.Trigger asChild>
        <a href={r.sourceUrl || undefined} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-semibold tracking-wide ${r.ok ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-700"}`}>
          {r.ok ? <Check size={10} /> : <X size={10} />}{name}<span className="ml-0.5 font-mono font-normal">{r.confidence.toFixed(2)}</span>
        </a>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={4} className="z-50 max-w-xs rounded-md border border-neutral-200 bg-white p-2.5 text-xs shadow-lg">
          <div className="mb-1 font-semibold">{name} receipt</div>
          <p className="text-neutral-700">{r.summary}</p>
          <div className="mt-1.5 flex items-center justify-between gap-3"><Conf v={r.confidence} /><Src href={r.sourceUrl}>{r.sourceTitle?.slice(0, 40) || "source"}</Src></div>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function ReceiptChips({ lead }: { lead: Lead }) {
  return (
    <span className="inline-flex gap-1">
      <Chip name="FIT" r={lead.receipts.fit} />
      <Chip name="PERSON" r={lead.receipts.person} />
      <Chip name="TIMING" r={lead.receipts.timing} />
    </span>
  );
}
