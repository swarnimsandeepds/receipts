"use client";
import { Ban, Loader2, Share2 } from "lucide-react";
import type { ClientState, Lead } from "@/lib/types";
import { COSTS } from "@/lib/costs";
import { ReceiptChips } from "./ReceiptChips";
import { btnSm, card, ModeBadge, Src, TierBadge } from "./ui";

export function LeadTable({ state, onOpen, onEnrich, enriching }: { state: ClientState; onOpen: (l: Lead) => void; onEnrich: (l: Lead) => void; enriching: string | null }) {
  const { leads, heldBack, competitors, displacement, modes } = state;
  if (!leads.length && !heldBack.length) return <p className="py-10 text-center text-sm text-neutral-500">No leads yet. Generate an ICP and run discovery, or click Load demo.</p>;
  const th = "px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap";
  const td = "px-2 py-1.5 align-top";
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-xl font-semibold">Qualified leads</h2>
          <span className="text-sm text-neutral-500">{leads.length} with all three receipts</span>
          <ModeBadge mode={modes.search} label="Search" /><ModeBadge mode={modes.extract} label="LLM" /><ModeBadge mode={modes.moss} label="Moss" />
        </div>
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full border-collapse text-[13px]">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr><th className={th}>#</th><th className={th}>Company</th><th className={th}>Contact</th><th className={th}>Score</th><th className={th}>Tier</th><th className={th}>Receipts</th><th className={th}>Why today</th><th className={th}>Moss</th><th className={th}>Cost</th><th className={th}></th></tr>
            </thead>
            <tbody>
              {leads.map((l, i) => (
                <tr key={l.id} className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50" onClick={() => onOpen(l)}>
                  <td className={`${td} font-mono text-xs text-neutral-400`}>{i + 1}</td>
                  <td className={td}>
                    <div className="font-medium">{l.company}</div>
                    <div className="text-[11px] text-neutral-500">{l.industry} · {l.employees || "?"} emp</div>
                    <span onClick={(e) => e.stopPropagation()}><Src href={l.sourceUrl}>{l.domain}</Src></span>
                    {l.usesCompetitor && <span className="ml-1.5 rounded bg-fuchsia-100 px-1 text-[10px] font-medium text-fuchsia-800">uses {l.usesCompetitor}</span>}
                  </td>
                  <td className={td}>
                    <div>{l.contact.name}</div>
                    <div className="text-[11px] text-neutral-500">{l.contact.title}</div>
                    {l.contact.email && <div className="font-mono text-[11px] text-neutral-600">{l.contact.email}</div>}
                    {l.warmPath && <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-800"><Share2 size={10} /> warm intro</div>}
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 font-mono text-sm font-semibold tabular-nums">{l.score}</span>
                      <span className="h-1.5 w-14 overflow-hidden rounded bg-neutral-200"><span className={`block h-full ${l.tier === "A" ? "bg-emerald-500" : l.tier === "B" ? "bg-amber-500" : "bg-neutral-400"}`} style={{ width: `${l.score}%` }} /></span>
                    </div>
                    <div className="font-mono text-[10px] text-neutral-400">fit {l.fitScore} · intent {l.intentScore}</div>
                  </td>
                  <td className={td}><TierBadge tier={l.tier} /></td>
                  <td className={td}><ReceiptChips lead={l} /></td>
                  <td className={`${td} max-w-xs`}>
                    <div className="line-clamp-2 text-xs text-neutral-700">{l.receipts.timing.summary}</div>
                    <span onClick={(e) => e.stopPropagation()}><Src href={l.receipts.timing.sourceUrl}>{l.receipts.timing.sourceTitle?.slice(0, 44) || "source"}</Src></span>
                  </td>
                  <td className={`${td} whitespace-nowrap font-mono text-[11px] text-neutral-600`}>{l.moss ? <>{l.moss.hits.length} hits<br />{l.moss.ms} ms</> : "n/a"}</td>
                  <td className={`${td} whitespace-nowrap font-mono text-xs`}>{l.costCredits} cr</td>
                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    {l.enriched
                      ? <button className={btnSm} onClick={() => onOpen(l)}>Review {l.messages.filter((m) => m.status === "approved").length}/{l.messages.length}</button>
                      : <button className={btnSm} disabled={!!enriching} onClick={() => onEnrich(l)}>{enriching === l.id ? <Loader2 size={12} className="animate-spin" /> : null} Enrich ({COSTS.lead_enriched} cr)</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-serif text-xl font-semibold"><Ban size={18} className="text-rose-600" /> Held back <span className="font-sans text-sm font-normal text-neutral-500">{heldBack.length} leads. No receipt, no outreach.</span></h2>
        <div className={`${card} divide-y divide-neutral-100`}>
          {heldBack.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
              <span className="w-44 font-medium">{h.company}</span>
              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${h.missing === "NEGATIVE" ? "bg-neutral-800 text-white" : "bg-rose-100 text-rose-800"}`}>{h.missing === "NEGATIVE" ? "NEGATIVE SIGNAL" : `NO ${h.missing} RECEIPT`}</span>
              <span className="min-w-0 flex-1 text-neutral-700">{h.reason}</span>
              <Src href={h.sourceUrl} />
            </div>
          ))}
          {!heldBack.length && <p className="p-3 text-sm text-neutral-500">Nothing held back.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-xl font-semibold">Competitor map</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {competitors.map((c) => (
            <div key={c.name} className={`${card} p-3 text-sm`}>
              <div className="flex items-center justify-between"><span className="font-semibold">{c.name}</span><Src href={c.sourceUrl} /></div>
              <p className="mt-1 text-neutral-700">{c.positioning}</p>
              <p className="mt-1.5 text-xs"><span className="font-semibold text-neutral-500">Pricing tier:</span> {c.pricingTier}</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-neutral-600">{c.differentiators.map((d) => <li key={d}>{d}</li>)}</ul>
              {displacement.filter((d) => d.competitor === c.name).length > 0 && (
                <p className="mt-2 rounded bg-fuchsia-50 px-2 py-1 text-xs text-fuchsia-900">Displacement targets: {displacement.filter((d) => d.competitor === c.name).map((d) => d.company).join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
