"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Check, Loader2, Pencil, Share2, X } from "lucide-react";
import type { Lead, Message } from "@/lib/types";
import { COSTS } from "@/lib/costs";
import { ActorBadge, btn, btnPrimary, btnSm, Conf, ModeBadge, Src, TierBadge } from "./ui";

type ReviewFn = (leadId: string, messageId: string, action: "approve" | "edit" | "reject", body?: string, subject?: string) => void;

function MessageCard({ lead, m, onReview }: { lead: Lead; m: Message; onReview: ReviewFn }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(m.body);
  const [subject, setSubject] = useState(m.subject ?? "");
  const tone = m.status === "approved" ? "border-emerald-300 bg-emerald-50/50" : m.status === "rejected" ? "border-rose-200 bg-rose-50/40 opacity-70" : "border-neutral-200";
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold">Step {m.step}: {m.label}</span>
        <span className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase ${m.status === "approved" ? "bg-emerald-600 text-white" : m.status === "rejected" ? "bg-rose-600 text-white" : "bg-neutral-200 text-neutral-700"}`}>{m.status === "approved" ? "approved, queued" : m.status}</span>
        {m.edited && <span className="text-[10px] text-neutral-500">edited by rep</span>}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          {m.subject !== undefined && <input className="w-full rounded border border-neutral-300 px-2 py-1 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} />}
          <textarea className="w-full rounded border border-neutral-300 px-2 py-1 text-sm" rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={() => { onReview(lead.id, m.id, "edit", body, m.subject !== undefined ? subject : undefined); setEditing(false); }}>Save edit</button>
            <button className={btn} onClick={() => { setBody(m.body); setSubject(m.subject ?? ""); setEditing(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {m.subject && <div className="mt-2 text-sm font-medium">Subject: {m.subject}</div>}
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{m.body}</p>
          <div className="mt-2.5 flex gap-2">
            <button className={`${btnSm} border-emerald-400 text-emerald-800`} disabled={m.status === "approved"} onClick={() => onReview(lead.id, m.id, "approve")}><Check size={12} /> Approve</button>
            <button className={btnSm} disabled={m.status === "approved"} onClick={() => { setBody(m.body); setSubject(m.subject ?? ""); setEditing(true); }}><Pencil size={12} /> Edit</button>
            <button className={`${btnSm} border-rose-300 text-rose-700`} disabled={m.status !== "draft"} onClick={() => onReview(lead.id, m.id, "reject")}><X size={12} /> Reject</button>
          </div>
        </>
      )}
    </div>
  );
}

export function ReviewDrawer({ lead, onClose, onReview, onEnrich, enriching }: { lead: Lead | null; onClose: () => void; onReview: ReviewFn; onEnrich: (l: Lead) => void; enriching: string | null }) {
  return (
    <Dialog.Root open={!!lead} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl focus:outline-none" aria-describedby={undefined}>
          {lead && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Dialog.Title className="font-serif text-2xl font-semibold">{lead.company}</Dialog.Title>
                  <p className="text-sm text-neutral-500">{lead.description}</p>
                </div>
                <Dialog.Close className="rounded p-1 hover:bg-neutral-100" aria-label="Close"><X size={18} /></Dialog.Close>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <TierBadge tier={lead.tier} /><span className="font-mono font-semibold">{lead.score}</span><span className="text-neutral-400">fit {lead.fitScore} · intent {lead.intentScore}</span>
                <span className="rounded bg-neutral-100 px-1.5 py-px text-xs">{lead.stage}</span>
                <ActorBadge actor={lead.lastActor} /><span className="text-xs text-neutral-500">{lead.lastAction}</span>
                <span className="ml-auto font-mono text-xs">Cost so far: {lead.costCredits} credits</span>
              </div>

              <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Receipts</h3>
              <div className="mt-1 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {(["fit", "person", "timing"] as const).map((k) => {
                  const r = lead.receipts[k];
                  return (
                    <div key={k} className="p-2.5 text-sm">
                      <div className="flex items-center gap-2"><span className="w-16 text-[11px] font-bold uppercase text-emerald-700">{k}</span><Conf v={r.confidence} /><span className="ml-auto"><Src href={r.sourceUrl}>{r.sourceTitle?.slice(0, 48) || "source"}</Src></span></div>
                      <p className="mt-0.5 text-neutral-700">{k === "fit" ? "Why this account: " : k === "person" ? "Why this person: " : "Why today: "}{r.summary}</p>
                    </div>
                  );
                })}
              </div>

              {lead.warmPath && (
                <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-sm">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800"><Share2 size={12} /> Warm intro path (graph)</div>
                  <p className="mt-1 font-mono text-xs text-sky-950">{lead.warmPath}</p>
                </div>
              )}

              {lead.moss && (
                <div className="mt-3">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Moss retrieval <span className="rounded bg-neutral-100 px-1 font-mono normal-case text-neutral-700">{lead.moss.ms} ms</span><ModeBadge mode={lead.moss.mode} /></h3>
                  <ul className="mt-1 space-y-1">
                    {lead.moss.hits.map((h, i) => <li key={i} className="flex gap-2 text-xs text-neutral-700"><span className="font-mono text-neutral-400">{h.score.toFixed(2)}</span><span className="min-w-0 flex-1">{h.text}</span><Src href={h.sourceUrl} /></li>)}
                  </ul>
                </div>
              )}

              <h3 className="mt-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Contact</h3>
              <div className="mt-1 text-sm">
                <span className="font-medium">{lead.contact.name}</span>, {lead.contact.title}
                {lead.contact.email && <div className="font-mono text-xs">{lead.contact.email} <span className={lead.contact.emailVerified ? "text-emerald-700" : "text-amber-700"}>({lead.contact.emailVerified ? "verified" : "pattern guess, unverified"})</span></div>}
                <div className="flex gap-3">{lead.contact.linkedin && <Src href={lead.contact.linkedin}>LinkedIn</Src>}<span className="text-xs text-neutral-500">{lead.domain}</span></div>
              </div>

              <h3 className="mt-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Outreach sequence <ModeBadge mode={lead.outreachMode} label="LLM" />{lead.enriched && <span className="normal-case">Template {lead.template}</span>}</h3>
              {!lead.enriched ? (
                <div className="mt-2 rounded-lg border border-dashed border-neutral-300 p-4 text-center">
                  <p className="text-sm text-neutral-600">Enrich this lead to add contact details and draft the 3 step sequence.</p>
                  <button className={`${btnPrimary} mt-2`} disabled={!!enriching} onClick={() => onEnrich(lead)}>{enriching === lead.id && <Loader2 size={14} className="animate-spin" />} Enrich and draft ({COSTS.lead_enriched} credits)</button>
                </div>
              ) : (
                <div className="mt-2 space-y-3">
                  <p className="text-xs text-neutral-500">Human review is mandatory. Approved messages go to the queue. Nothing is sent from this app.</p>
                  {lead.messages.map((m) => <MessageCard key={m.id + m.body.length} lead={lead} m={m} onReview={onReview} />)}
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
