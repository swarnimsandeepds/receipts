"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Ban, Brain, Check, Coins, Database, FileCheck2, Loader2, Play, Search, Share2, Target, UserCheck, X, Zap } from "lucide-react";
import type { ClientState } from "@/lib/types";
import { ModeBadge } from "./ui";
import { ReceiptGame } from "./ReceiptGame";
import { computeQuests, REWARDS } from "@/lib/quests";

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

const STRIP = ["#5aa9e6", "#e0457b", "#f6dc5c", "#131313", "#c9c5ba", "#5aa9e6", "#e0457b", "#f6dc5c", "#4b4842", "#c9c5ba", "#a9d4f2", "#ee8fb0", "#faeb9e", "#8a867b", "#c9c5ba", "#cfe6f7", "#f3c3d4", "#fcf3c4", "#c9c5ba", "#b5b1a6"];
// Fictional seeded accounts, shown as label cards until a real run fills the workspace.
const SAMPLE_LABELS = [
  { name: "Larkspur Voice", tag: "VOICE AI", tier: "A", score: 99 }, { name: "Quillon AI", tag: "SALES COPILOT", tier: "A", score: 93 },
  { name: "Tandem Desk", tag: "SUPPORT", tier: "A", score: 92 }, { name: "Corvid Labs", tag: "VOICE AI", tier: "A", score: 81 },
  { name: "Northfold", tag: "VOICE AI", tier: "B", score: 74 }, { name: "Sablewood", tag: "INSURANCE", tier: "B", score: 68 },
  { name: "Halcyon CX", tag: "CONTACT CENTER", tier: "B", score: 65 }, { name: "Pellucid", tag: "MEETINGS", tier: "B", score: 54 },
];

export function Landing({ state, busy, onDemo, onGameXp }: { state: ClientState; busy: boolean; onDemo: () => void; onGameXp: (xp: number) => void }) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3500);
    return () => clearInterval(t);
  }, [auto]);

  const mossMs = state.leads.map((l) => l.moss?.ms).filter((x): x is number => typeof x === "number");
  const avgMs = mossMs.length ? (mossMs.reduce((a, b) => a + b, 0) / mossMs.length).toFixed(1) : null;
  const hasRun = state.leads.length > 0 || state.heldBack.length > 0;
  const stats = [
    { label: "Leads with 3 receipts", value: String(state.leads.length) },
    { label: "Held back", value: String(state.heldBack.length) },
    { label: "Avg Moss retrieval", value: avgMs ? `${avgMs} ms` : "n/a" },
    { label: "Messages approved", value: String(state.leads.reduce((n, l) => n + l.messages.filter((m) => m.status === "approved").length, 0)) },
  ];
  const labels = hasRun
    ? state.leads.slice(0, 10).map((l) => ({ name: l.company, tag: l.industry.split(" ").slice(0, 2).join(" ").toUpperCase(), tier: l.tier as string, score: l.score }))
    : SAMPLE_LABELS;
  const S = STEPS[step];

  return (
    <div>
      {/* Hero */}
      <section className="relative px-6 pb-16 pt-20 text-center">
        <span className="crop tl" /><span className="crop tr" />
        <h1 className="display mx-auto max-w-5xl text-6xl md:text-8xl">
          No <span className="hl">receipt</span><FileCheck2 className="mx-2 inline-block h-12 w-12 align-baseline md:h-16 md:w-16" strokeWidth={1.5} />,<br />no outreach.
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-lg" style={{ color: "var(--muted)" }}>Receipts is a sales agent that has to show its work. It only drafts a message when it can prove three things with a source: why this account, why this person, and why today.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button className="btn-ink" onClick={onDemo} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Run the live demo <ArrowRight size={15} /></button>
        </div>
        <div className="mx-auto mt-8 w-56 border bg-white p-2.5 text-left" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center bg-emerald-600 text-white"><Database size={14} /></span>
            <span><span className="eyebrow block leading-none">Retrieval by</span><span className="text-sm font-semibold">Moss</span></span>
            <span className="ml-auto"><ModeBadge mode={state.integrations.Moss} /></span>
          </div>
          <div className="mt-2 flex items-end gap-2"><div className="barcode flex-1" /><span className="eyebrow">{avgMs ? `${avgMs} MS` : "MS · P50"}</span></div>
        </div>
      </section>

      {/* Colour strip and label marquee */}
      <div className="flex h-2">{STRIP.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
      <section className="overflow-hidden border-b" style={{ background: "var(--band)", borderColor: "var(--line)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 text-sm">
          <span className="font-semibold tracking-tight">{hasRun ? "Accounts with all three receipts" : "Sample accounts the demo finds"}</span>
          <button className="eyebrow underline underline-offset-4" onClick={() => setPaused((p) => !p)}>{paused ? "Play" : "Pause"}</button>
        </div>
        <div className={`marquee ${paused ? "paused" : ""}`}>
          {[...labels, ...labels].map((l, i) => (
            <div key={i} className="w-52 shrink-0 border-r bg-white p-3 text-left transition-colors hover:bg-[#fffdf7]" style={{ borderColor: "var(--line)" }} aria-hidden={i >= labels.length}>
              <div className="flex items-start justify-between"><span className="truncate text-lg font-medium tracking-tight">{l.name}</span><span className={`ml-2 shrink-0 px-1 text-[10px] font-bold text-white ${l.tier === "A" ? "bg-emerald-600" : l.tier === "B" ? "bg-amber-500" : "bg-neutral-400"}`}>{l.tier}</span></div>
              <div className="barcode mt-2" />
              <div className="mt-1 flex justify-between"><span className="eyebrow truncate">{l.tag}</span><span className="eyebrow">{l.score}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* Live numbers */}
      <section className="mx-auto grid max-w-6xl grid-cols-2 border-x border-b md:grid-cols-4" style={{ borderColor: "var(--line)" }}>
        {stats.map((s, i) => (
          <div key={s.label} className={`p-5 ${i > 0 ? "md:border-l" : ""}`} style={{ borderColor: "var(--line)" }}>
            <div className="display text-4xl tabular-nums">{s.value}</div>
            <div className="eyebrow mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      {/* The gate */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
        <div>
          <div className="eyebrow">The gate</div>
          <h2 className="display mt-3 text-5xl">Three receipts,<br />or the agent stays quiet.</h2>
          <p className="mt-5 max-w-md text-lg" style={{ color: "var(--muted)" }}>Every lead has to pass the same check. Toggle a receipt on the card and watch the agent unlock or refuse the draft.</p>
          <ul className="mt-6 space-y-0 border-t" style={{ borderColor: "var(--line)" }}>
            {RECEIPTS.map((r) => (
              <li key={r.key} className="flex items-center gap-3 border-b py-3" style={{ borderColor: "var(--line)" }}><r.icon size={18} /><span className="w-20 font-mono text-xs font-bold tracking-widest">{r.name}</span><span style={{ color: "var(--muted)" }}>{r.q}</span></li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <span className="anim-bob absolute -left-5 -top-4 z-10 hidden border-2 border-emerald-600 bg-white px-2 py-0.5 font-mono text-xs font-black uppercase tracking-widest text-emerald-700 lg:block" style={{ ["--r" as string]: "-10deg" }}>Fit ✓</span>
          <span className="anim-bob absolute -right-4 top-24 z-10 hidden border-2 border-sky-600 bg-white px-2 py-0.5 font-mono text-xs font-black uppercase tracking-widest text-sky-700 lg:block" style={{ ["--r" as string]: "8deg", animationDelay: "1.2s" }}>Person ✓</span>
          <span className="anim-bob absolute -bottom-4 left-10 z-10 hidden border-2 border-amber-600 bg-white px-2 py-0.5 font-mono text-xs font-black uppercase tracking-widest text-amber-700 lg:block" style={{ ["--r" as string]: "-5deg", animationDelay: "2.1s" }}>Timing ✓</span>
          <ReceiptDemo />
        </div>
      </section>

      {/* Game */}
      <section style={{ background: "var(--ink)" }} className="px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="eyebrow" style={{ color: "#c9c5ba" }}>Mini game · eight leads, three lives</div>
          <h2 className="display mt-3 text-5xl">Receipt Check: <span style={{ color: "var(--hl)" }}>would you send it?</span></h2>
          <p className="mt-3 max-w-xl text-neutral-300">Build a streak for a score multiplier. Watch for negative signals.</p>
          <div className="mt-8 border border-neutral-700"><ReceiptGame onXp={onGameXp} /></div>
        </div>
      </section>

      {/* The system */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="eyebrow">The system</div>
        <h2 className="display mt-3 text-5xl">From first signal to approved message.</h2>
        <div className="mt-10 grid border lg:grid-cols-[19rem_1fr]" style={{ borderColor: "var(--line)" }}>
          <ol className="border-b lg:border-b-0 lg:border-r" style={{ borderColor: "var(--line)" }}>
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
                <button type="button" onClick={() => { setStep(i); setAuto(false); }} aria-current={i === step}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${i === step ? "bg-[#131313] text-white" : "bg-white hover:bg-[#f4f1e7]"}`}>
                  <span className="font-mono text-xs opacity-60">0{i + 1}</span>
                  <span><span className="block text-sm font-semibold tracking-tight">{s.title}</span><span className={`block text-xs ${i === step ? "text-neutral-300" : "text-neutral-500"}`}>{s.line}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="relative flex min-h-[18rem] flex-col justify-between bg-[#fffdf7] p-8">
            <span className="crop tr" /><span className="crop bl" />
            <div key={step} className="anim-slide-up">
              <S.icon size={30} strokeWidth={1.5} />
              <h3 className="display mt-4 text-3xl">{S.title}. <span className="hl">{S.line}</span></h3>
              <p className="mt-3 max-w-2xl text-lg" style={{ color: "var(--muted)" }}>{S.body}</p>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <div className="barcode w-40" />
              <span className="eyebrow">Step 0{step + 1} / 0{STEPS.length}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quests */}
      <section className="border-y px-6 py-20" style={{ background: "var(--band)", borderColor: "var(--line)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="eyebrow">Quests</div>
          <h2 className="display mt-3 text-5xl">Earn XP by doing the real work.</h2>
          <p className="mt-3 max-w-xl text-lg" style={{ color: "var(--muted)" }}>Progress is read from this workspace, so nothing unlocks unless you actually did it.</p>
          <div className="mt-6 grid max-w-2xl grid-cols-2 border bg-white" style={{ borderColor: "var(--line)" }}>
            {REWARDS.map((r, i) => (
              <div key={r.id} className={`p-4 ${i ? "border-l" : ""}`} style={{ borderColor: "var(--line)" }}>
                <div className="eyebrow">Redeem · {r.xp.toLocaleString()} XP</div>
                <div className="mt-1 text-xl font-medium tracking-tight">{r.label}</div>
                <div className="barcode mt-2 w-24" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>Redeem from the quest log in the top bar. Requests are recorded now and fulfilled once a rewards partner is connected.</p>
          <div className="mt-8 grid border-l border-t sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--line)" }}>
            {computeQuests(state).map((q) => (
              <div key={q.id} className={`group border-b border-r p-4 text-left transition-colors ${q.done ? "bg-emerald-50" : "bg-white hover:bg-[#fffdf7]"}`} style={{ borderColor: "var(--line)" }}>
                <div className="flex items-center justify-between">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${q.done ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-400"}`}>{q.done ? <Check size={14} /> : <Zap size={13} />}</span>
                  <span className={`px-2 py-0.5 font-mono text-xs ${q.done ? "bg-emerald-600 text-white" : "bg-[#f6dc5c] text-black"}`}>+{q.xp} XP</span>
                </div>
                <div className="mt-3 text-base font-semibold tracking-tight">{q.title}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{q.hint}</div>
                {q.progress && !q.done && <div className="mt-1 font-mono text-[11px] text-neutral-500">{q.progress}</div>}
                <div className="barcode mt-3 opacity-20 transition-opacity group-hover:opacity-60" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative px-6 py-24 text-center">
        <span className="crop bl" /><span className="crop br" />
        <div className="eyebrow">Start</div>
        <h2 className="display mx-auto mt-3 max-w-3xl text-6xl">See the <span className="hl">receipts</span> for yourself.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button className="btn-ink" onClick={onDemo} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Run the live demo <ArrowRight size={15} /></button>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-1.5">{Object.entries(state.integrations).map(([k, v]) => <ModeBadge key={k} mode={v} label={k} />)}</div>
      </section>
    </div>
  );
}
