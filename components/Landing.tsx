"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Ban, Brain, Check, Coins, Database, FileCheck2, Loader2, Play, Search, Share2, Target, UserCheck, X, Zap } from "lucide-react";
import type { ClientState } from "@/lib/types";
import { ModeBadge } from "./ui";

type Key = "fit" | "person" | "timing";
const RECEIPTS: { key: Key; name: string; q: string; icon: typeof Target; evidence: string; source: string; conf: number }[] = [
  { key: "fit", name: "FIT", q: "Why this account?", icon: Target, evidence: "Production voice agent, 85 employees. Retrieval sits on the critical path of every call turn.", source: "Company profile", conf: 0.93 },
  { key: "person", name: "PERSON", q: "Why this person?", icon: UserCheck, evidence: "Priya Raman, Head of AI. Role match, plus a warm intro: she used to work at one of your customers.", source: "Knowledge graph, 1 hop", conf: 0.98 },
  { key: "timing", name: "TIMING", q: "Why today?", icon: Zap, evidence: "Raised an $18M Series A nine days ago to expand its clinic voice agent to 400 new sites.", source: "Funding announcement", conf: 0.9 },
];
const DRAFT = `Hi Priya,

I saw this and wanted to reach out today: "Larkspur Voice raised an $18M Series A to expand its clinic voice agent to 400 new sites."

That usually means retrieval is about to carry a lot more load. Moss is real time semantic search for voice agents and copilots.

Worth 20 minutes next week to compare notes?`;

const STEPS = [
  { icon: Brain, title: "Define", line: "Describe what you sell.", body: "One prompt turns your product, customers and pricing into an ICP: industries with NAICS codes, size range, buyer personas, trigger events and negative signals. Every field is editable and carries a confidence score." },
  { icon: Search, title: "Discover", line: "Find accounts with a reason.", body: "The agent searches the web for target accounts and trigger signals such as funding, hiring, launches and job posts. Every company and every signal keeps its source link." },
  { icon: FileCheck2, title: "Prove", line: "Three receipts or nothing.", body: "FIT, PERSON and TIMING each need a source. A lead missing any one of them goes to Held back with the reason, and the agent is not allowed to draft for it." },
  { icon: Database, title: "Retrieve", line: "Ground every draft in Moss.", body: "Every snippet and signal is indexed in Moss. When the agent scores or drafts for a company it pulls that company's top signals in a few milliseconds, and shows you the timing." },
  { icon: Share2, title: "Connect", line: "Find the warm path.", body: "A knowledge graph of companies, people, competitors and signals answers two questions: who can introduce us, and who is using a competitor we can displace." },
  { icon: Check, title: "Review", line: "A human approves every message.", body: "Each lead gets a three step sequence that quotes its timing receipt. You approve, edit or reject every message. Approved messages go to a queue. Nothing is sent for you." },
];

function ReceiptDemo() {
  const [on, setOn] = useState<Record<Key, boolean>>({ fit: true, person: true, timing: false });
  const [typed, setTyped] = useState(0);
  const all = on.fit && on.person && on.timing;
  const missing = RECEIPTS.filter((r) => !on[r.key]).map((r) => r.name);

  useEffect(() => {
    if (!all) { setTyped(0); return; }
    const t = setInterval(() => setTyped((n) => (n >= DRAFT.length ? n : n + 4)), 16);
    return () => clearInterval(t);
  }, [all]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-200/60">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Try it: toggle a receipt</div>
          <div className="font-serif text-xl font-semibold">Larkspur Voice</div>
          <div className="text-xs text-neutral-500">Voice agents for outpatient clinics · 85 employees</div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${all ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-800"}`}>{all ? "Outreach unlocked" : "Held back"}</span>
      </div>

      <div className="mt-4 space-y-2">
        {RECEIPTS.map((r) => {
          const active = on[r.key];
          return (
            <button key={r.key} type="button" onClick={() => setOn((s) => ({ ...s, [r.key]: !s[r.key] }))} aria-pressed={active}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${active ? "border-emerald-300 bg-emerald-50" : "border-dashed border-neutral-300 bg-neutral-50 opacity-70 hover:opacity-100"}`}>
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${active ? "bg-emerald-600 text-white" : "bg-neutral-200 text-neutral-500"}`}>{active ? <Check size={14} /> : <X size={14} />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs"><span className="font-bold tracking-wide">{r.name}</span><span className="text-neutral-500">{r.q}</span>{active && <span className="ml-auto font-mono text-emerald-800">{r.conf.toFixed(2)}</span>}</span>
                <span className="mt-0.5 block text-sm text-neutral-800">{active ? r.evidence : "No sourced evidence found."}</span>
                {active && <span className="mt-0.5 block text-[11px] text-blue-700 underline decoration-blue-300 underline-offset-2">{r.source} ↗</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`mt-4 rounded-xl border p-3 ${all ? "border-neutral-200 bg-neutral-50" : "border-rose-200 bg-rose-50"}`}>
        {all ? (
          <>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Draft for review <span className="rounded bg-neutral-200 px-1.5 normal-case text-neutral-700">not sent</span></div>
            <p className="min-h-[9.5rem] whitespace-pre-wrap text-sm text-neutral-800">{DRAFT.slice(0, typed)}{typed < DRAFT.length && <span className="animate-pulse">▍</span>}</p>
          </>
        ) : (
          <div className="flex min-h-[9.5rem] flex-col items-center justify-center text-center">
            <Ban size={22} className="text-rose-600" />
            <p className="mt-2 text-sm font-semibold text-rose-900">No {missing.join(" or ")} receipt, no outreach.</p>
            <p className="text-xs text-rose-800">The agent will not draft a message for this lead. Turn on all three to unlock it.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Landing({ state, busy, onDemo, onConsole }: { state: ClientState; busy: boolean; onDemo: () => void; onConsole: () => void }) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3500);
    return () => clearInterval(t);
  }, [auto]);

  const mossMs = state.leads.map((l) => l.moss?.ms).filter((x): x is number => typeof x === "number");
  const avgMs = mossMs.length ? (mossMs.reduce((a, b) => a + b, 0) / mossMs.length).toFixed(1) : null;
  const hasRun = state.leads.length > 0 || state.heldBack.length > 0;
  const stats = [
    { label: "Leads with 3 receipts", value: hasRun ? String(state.leads.length) : "0" },
    { label: "Held back", value: hasRun ? String(state.heldBack.length) : "0" },
    { label: "Avg Moss retrieval", value: avgMs ? `${avgMs} ms` : "n/a" },
    { label: "Messages approved", value: String(state.leads.reduce((n, l) => n + l.messages.filter((m) => m.status === "approved").length, 0)) },
  ];
  const S = STEPS[step];
  const cta = "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="bg-gradient-to-b from-amber-50/60 via-white to-white">
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-12 lg:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> AI go-to-market engine, retrieval by Moss <ModeBadge mode={state.integrations.Moss} /></div>
          <h1 className="mt-5 font-serif text-6xl font-bold leading-[1.02] tracking-tight">No receipt,<br />no outreach.</h1>
          <p className="mt-5 max-w-lg text-lg text-neutral-600">Receipts is a sales agent that has to show its work. It only drafts a message when it can prove three things with a source: why this account, why this person, and why today.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className={`${cta} bg-neutral-900 text-white hover:bg-neutral-700`} onClick={onDemo} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run the live demo</button>
            <button className={`${cta} border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50`} onClick={onConsole}>Open console <ArrowRight size={16} /></button>
          </div>
          <p className="mt-3 text-xs text-neutral-500">The demo uses Moss (moss.dev) as the product being sold and runs the whole pipeline in about 20 seconds.</p>
        </div>
        <ReceiptDemo />
      </section>

      {/* Live strip */}
      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="py-5">
              <div className="font-mono text-3xl font-semibold tabular-nums">{s.value}</div>
              <div className="text-xs uppercase tracking-wider text-neutral-500">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mx-auto max-w-6xl px-6 pb-3 text-xs text-neutral-500">{hasRun ? "Live numbers from this workspace." : "Run the demo and these fill in with live numbers from this workspace."}</p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-serif text-3xl font-semibold">How it works</h2>
        <p className="mt-1 text-neutral-600">Six steps, each one visible in the console. Click a step.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
          <ol className="space-y-1">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button type="button" onClick={() => { setStep(i); setAuto(false); }} aria-current={i === step}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${i === step ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs ${i === step ? "bg-white text-neutral-900" : "bg-neutral-200 text-neutral-700"}`}>{i + 1}</span>
                  <span><span className="block text-sm font-semibold">{s.title}</span><span className={`block text-xs ${i === step ? "text-neutral-300" : "text-neutral-500"}`}>{s.line}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex min-h-[15rem] flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-7">
            <div>
              <S.icon size={28} className="text-neutral-900" />
              <h3 className="mt-3 font-serif text-2xl font-semibold">{step + 1}. {S.title}: {S.line}</h3>
              <p className="mt-2 max-w-2xl text-neutral-700">{S.body}</p>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex gap-1.5">{STEPS.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-neutral-900" : "w-1.5 bg-neutral-300"}`} />)}</div>
              <button className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-neutral-900 hover:underline" onClick={onConsole}>See it in the console <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-14 md:grid-cols-3">
          {[
            { icon: FileCheck2, title: "Proof on every row", body: "Score, tier and three receipt chips on every lead. Hover a chip for the evidence and its source." },
            { icon: Ban, title: "A Held back list", body: "Leads that fail the gate are listed with the exact receipt they are missing, so nothing disappears silently." },
            { icon: Coins, title: "Metered and audited", body: "Enrichment, outreach and graph queries are metered as credits. Every AI and human action lands in the audit log." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-neutral-200 bg-white p-6 transition-transform hover:-translate-y-0.5 hover:shadow-md">
              <f.icon size={22} />
              <h3 className="mt-3 font-serif text-xl font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mx-auto max-w-6xl px-6 py-14 text-center">
        <h2 className="font-serif text-4xl font-bold tracking-tight">See the receipts for yourself.</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button className={`${cta} bg-neutral-900 text-white hover:bg-neutral-700`} onClick={onDemo} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run the live demo</button>
          <button className={`${cta} border border-neutral-300 bg-white hover:bg-neutral-50`} onClick={onConsole}>Open console <ArrowRight size={16} /></button>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-1.5">{Object.entries(state.integrations).map(([k, v]) => <ModeBadge key={k} mode={v} label={k} />)}</div>
      </section>
    </div>
  );
}
