"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import type { Icp, Mode } from "@/lib/types";
import { btn, btnPrimary, btnSm, card, Conf, ModeBadge } from "./ui";

const cell = "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-neutral-200 focus:border-neutral-900 focus:bg-white focus:outline-none";

function ConfInput({ v, onChange }: { v: number; onChange: (n: number) => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Conf v={v} />
      <input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-12 accent-neutral-800" aria-label="confidence" />
    </span>
  );
}

export function IcpCards({ icp, mode, onSave, onDiscover, busy }: { icp: Icp; mode?: Mode; onSave: (icp: Icp, note?: string) => Promise<void> | void; onDiscover: () => void; busy: string | null }) {
  const [d, setD] = useState<Icp>(icp);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setD(icp); setDirty(false); }, [icp]);
  const up = (fn: (x: Icp) => void) => { const n = structuredClone(d); fn(n); setD(n); setDirty(true); };
  const seg = (id: string, status: "accepted" | "dismissed") => { const n = structuredClone(d); const s = n.adjacentSegments.find((x) => x.id === id)!; s.status = status; setD(n); onSave(n, `Adjacent segment ${status}: ${s.name}`); };

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className={`${card} p-3`}><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</h3><div className="space-y-1">{children}</div></div>
  );

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold">2. Ideal customer profile {mode === "live" && <ModeBadge mode={mode} label="LLM" />}</h2>
        <div className="flex gap-2">
          {dirty && <button className={btn} onClick={() => onSave(d)}><Check size={14} /> Save edits</button>}
          <button className={btnPrimary} disabled={!!busy} onClick={async () => { if (dirty) await onSave(d); onDiscover(); }}>
            {busy === "discovery" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Run discovery
          </button>
        </div>
      </div>
      <p className="mb-3 text-sm text-neutral-500">Every field is editable. Click any text to change it, drag a slider to change confidence.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Card({ title: "Industries (NAICS)", children: d.industries.map((x, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={cell} value={x.name} onChange={(e) => up((n) => { n.industries[i].name = e.target.value; })} />
            <input className={`${cell} w-20 shrink-0 font-mono text-xs`} value={x.naics} onChange={(e) => up((n) => { n.industries[i].naics = e.target.value; })} />
            <ConfInput v={x.confidence} onChange={(v) => up((n) => { n.industries[i].confidence = v; })} />
          </div>)) })}
        {Card({ title: "Company size", children: (
          <div className="flex items-center gap-2 text-sm">
            <input type="number" className={`${cell} w-20`} value={d.companySize.min} onChange={(e) => up((n) => { n.companySize.min = Number(e.target.value); })} />
            <span className="text-neutral-400">to</span>
            <input type="number" className={`${cell} w-20`} value={d.companySize.max} onChange={(e) => up((n) => { n.companySize.max = Number(e.target.value); })} />
            <span className="grow text-neutral-500">employees</span>
            <ConfInput v={d.companySize.confidence} onChange={(v) => up((n) => { n.companySize.confidence = v; })} />
          </div>) })}
        {Card({ title: "Buyer personas", children: d.personas.map((x, i) => (
          <div key={i} className="border-b border-neutral-100 pb-1 last:border-0">
            <div className="flex items-center gap-2">
              <input className={`${cell} font-medium`} value={x.title} onChange={(e) => up((n) => { n.personas[i].title = e.target.value; })} />
              <ConfInput v={x.confidence} onChange={(v) => up((n) => { n.personas[i].confidence = v; })} />
            </div>
            <input className={`${cell} text-xs text-neutral-600`} value={x.why} onChange={(e) => up((n) => { n.personas[i].why = e.target.value; })} />
            <div className="flex items-center gap-1 px-1 text-xs text-neutral-500">Tone: <input className={`${cell} text-xs`} value={x.tone} onChange={(e) => up((n) => { n.personas[i].tone = e.target.value; })} /></div>
          </div>)) })}
        {Card({ title: "Trigger events", children: d.triggers.map((x, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={cell} value={x.event} onChange={(e) => up((n) => { n.triggers[i].event = e.target.value; })} />
            <ConfInput v={x.confidence} onChange={(v) => up((n) => { n.triggers[i].confidence = v; })} />
          </div>)) })}
        {Card({ title: "Negative signals", children: d.negativeSignals.map((x, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={cell} value={x.signal} onChange={(e) => up((n) => { n.negativeSignals[i].signal = e.target.value; })} />
            <ConfInput v={x.confidence} onChange={(v) => up((n) => { n.negativeSignals[i].confidence = v; })} />
          </div>)) })}
        {Card({ title: "Adjacent segments", children: d.adjacentSegments.map((x, i) => (
          <div key={x.id} className={`rounded border p-2 ${x.status === "accepted" ? "border-emerald-300 bg-emerald-50" : x.status === "dismissed" ? "border-neutral-200 bg-neutral-50 opacity-60" : "border-neutral-200"}`}>
            <div className="flex items-center gap-2">
              <input className={`${cell} font-medium`} value={x.name} onChange={(e) => up((n) => { n.adjacentSegments[i].name = e.target.value; })} />
              <Conf v={x.confidence} />
            </div>
            <input className={`${cell} text-xs text-neutral-600`} value={x.rationale} onChange={(e) => up((n) => { n.adjacentSegments[i].rationale = e.target.value; })} />
            <div className="mt-1 flex items-center gap-1.5">
              <button className={btnSm} onClick={() => seg(x.id, "accepted")}><Check size={12} /> Accept</button>
              <span className="text-[11px] text-neutral-400">adjust by editing the text</span>
              <button className={`${btnSm} ml-auto`} onClick={() => seg(x.id, "dismissed")}><X size={12} /> Dismiss</button>
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-neutral-500">{x.status}</div>
          </div>)) })}
      </div>
    </section>
  );
}
