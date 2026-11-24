"use client";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutDashboard, Loader2, Lock, Play, Receipt, RotateCcw, Sparkles } from "lucide-react";
import type { ClientState, Icp, Intake, Lead, Stage } from "@/lib/types";
import { DEMO_INTAKE } from "@/lib/mock";
import { IntakeForm } from "@/components/IntakeForm";
import { IcpCards } from "@/components/IcpCards";
import { LeadTable } from "@/components/LeadTable";
import { ReviewDrawer } from "@/components/ReviewDrawer";
import { Kanban } from "@/components/Kanban";
import { Charts } from "@/components/Charts";
import { GraphView } from "@/components/GraphView";
import { AgentFeed } from "@/components/AgentFeed";
import { CreditMeter } from "@/components/CreditMeter";
import { Landing } from "@/components/Landing";
import { QuestLog } from "@/components/QuestLog";
import { DemoVideo } from "@/components/DemoVideo";
import { GAME_XP_KEY } from "@/components/ReceiptGame";
import { ActorBadge, btn, btnPrimary, card, ModeBadge, time } from "@/components/ui";

const EMPTY: Intake = { name: "", product: "", customers: "", pricing: "" };
const TABS = [["intake", "Intake and ICP"], ["leads", "Leads"], ["queue", "Send queue"], ["pipeline", "Pipeline"], ["graph", "Graph"], ["charts", "Charts"], ["audit", "Audit log"]] as const;

export default function Home() {
  const [state, setState] = useState<ClientState | null>(null);
  const [intake, setIntake] = useState<Intake>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [view, setViewState] = useState<"product" | "console">("product");
  const [tab, setTab] = useState<string>("intake");
  const [gameXp, setGameXp] = useState(0);
  const [video, setVideo] = useState(false);
  useEffect(() => { setGameXp(Number(window.localStorage.getItem(GAME_XP_KEY) || 0)); }, []);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [wall, setWall] = useState(false);
  const [feedOpen, setFeedOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);

  const accept = useCallback((s?: ClientState) => {
    if (s && s.version >= version.current) { version.current = s.version; setState(s); }
  }, []);

  const api = useCallback(async (path: string, method = "GET", body?: unknown): Promise<{ ok: boolean; status: number; error?: string }> => {
    try {
      const res = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
      const json = await res.json();
      accept(json.state);
      return { ok: res.ok, status: res.status, error: json.error };
    } catch (e) {
      return { ok: false, status: 0, error: e instanceof Error ? e.message : "Request failed" };
    }
  }, [accept]);

  useEffect(() => {
    api("/api/state").then(() => undefined);
  }, [api]);
  const hydrated = useRef(false);
  useEffect(() => { if (state?.intake && !hydrated.current) { hydrated.current = true; setIntake(state.intake); } }, [state]);

  // Poll while the agent is working so the feed streams.
  const working = !!busy || !!enriching;
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => { api("/api/state"); }, 600);
    return () => clearInterval(t);
  }, [working, api]);

  // Product page first; the console lives behind its own tab. The choice is kept in the URL hash.
  useEffect(() => { if (window.location.hash === "#console") setViewState("console"); }, []);
  const setView = (v: "product" | "console") => { setViewState(v); window.history.replaceState(null, "", v === "console" ? "#console" : "#"); window.scrollTo({ top: 0 }); };

  const fail = (r: { error?: string }) => setError(r.error ?? "Something went wrong");

  const generateIcp = async (v: Intake, reset = false) => {
    setError(null); setBusy("icp");
    const r = await api("/api/icp", "POST", { ...v, reset });
    setBusy(null);
    if (!r.ok) fail(r);
    return r.ok;
  };
  const discover = async () => {
    setError(null); setBusy("discovery"); setFeedOpen(true);
    const r = await api("/api/discovery", "POST");
    setBusy(null);
    if (!r.ok) fail(r); else setTab("leads");
    return r.ok;
  };
  const enrich = async (l: { id: string }) => {
    setEnriching(l.id);
    const r = await api("/api/enrich", "POST", { leadId: l.id });
    setEnriching(null);
    if (r.status === 402) { setWall(true); return false; }
    if (!r.ok) fail(r);
    return r.ok;
  };
  const runDemo = async () => {
    setView("console"); setVideo(true); setIntake(DEMO_INTAKE); setTab("intake"); setFeedOpen(true);
    if (!(await generateIcp(DEMO_INTAKE, true))) return;
    if (!(await discover())) return;
    const res = await fetch("/api/state", { cache: "no-store" }).then((r) => r.json());
    const top = (res.state as ClientState).leads.filter((l) => !l.enriched).slice(0, 5);
    setBusy("enrich");
    for (const l of top) if (!(await enrich(l))) break;
    setBusy(null);
  };
  const reset = async () => { await api("/api/state", "DELETE"); setIntake(EMPTY); setTab("intake"); setOpenLead(null); };

  if (!state) return <main className="flex h-screen items-center justify-center text-neutral-500"><Loader2 className="animate-spin" /></main>;
  const lead: Lead | null = state.leads.find((l) => l.id === openLead) ?? null;
  const queue = state.leads.flatMap((l) => l.messages.filter((m) => m.status === "approved").map((m) => ({ l, m })));
  const counts: Record<string, number> = { leads: state.leads.length, queue: queue.length, audit: state.audit.length };

  return (
    <Tooltip.Provider>
      <nav className="sticky top-0 z-30 flex h-[3.25rem] items-stretch border-b bg-white/95 backdrop-blur" style={{ borderColor: "var(--line)" }}>
        <button className="flex items-center gap-2 border-r px-5 text-[15px] font-semibold tracking-tight" style={{ borderColor: "var(--line)" }} onClick={() => setView("product")}><Receipt size={17} /> Receipts</button>
        <div role="tablist" aria-label="View" className="flex items-stretch">
          {([["product", "Product", Sparkles], ["console", "Console", LayoutDashboard]] as const).map(([v, label, Icon]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 border-r px-4 text-sm transition-colors ${view === v ? "bg-[#f4f1e7] font-semibold" : "text-neutral-600 hover:bg-[#faf8f1]"}`} style={{ borderColor: "var(--line)" }}>
              <Icon size={14} /> {label}
              {v === "console" && working && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
              {v === "console" && !working && state.leads.length > 0 && <span className="bg-[#131313] px-1.5 font-mono text-[11px] text-white">{state.leads.length}</span>}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center px-3"><QuestLog state={state} gameXp={gameXp} /></span>
        <button className="flex items-center gap-2 bg-[#131313] px-5 text-sm font-medium text-white hover:bg-[#333]" onClick={runDemo} disabled={working}>
          Run demo <span aria-hidden>→</span>
        </button>
      </nav>
      {view === "product" && <Landing state={state} busy={working} onDemo={runDemo} onGameXp={setGameXp} />}
      <div className={view === "console" ? "flex min-h-screen" : "hidden"}>
        <div className="min-w-0 flex-1">
          <header className="border-b-2 border-neutral-900 px-6 pb-4 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">The GTM ledger · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
                <h1 className="font-serif text-5xl font-bold leading-none tracking-tight">Receipts</h1>
                <p className="mt-1 font-serif text-lg italic text-neutral-600">No receipt, no outreach.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">{Object.entries(state.integrations).map(([k, v]) => <ModeBadge key={k} mode={v} label={k} />)}</div>
                <button className={btnPrimary} onClick={runDemo} disabled={working}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Load demo</button>
                <button className={btn} onClick={reset} disabled={working} title="Clear all data"><RotateCcw size={14} /> Reset</button>
                <CreditMeter state={state} onTopUp={() => api("/api/billing", "POST")} />
              </div>
            </div>
            {busy && <p className="mt-2 flex items-center gap-2 text-sm text-neutral-600"><Loader2 size={14} className="animate-spin" /> {busy === "icp" ? "Generating ICP" : busy === "discovery" ? "Running discovery: search, receipt gate, Moss index, graph queries, scoring" : "Enriching top leads and drafting outreach"}</p>}
            {error && <p className="mt-2 rounded bg-rose-50 px-3 py-1.5 text-sm text-rose-800">{error}</p>}
          </header>

          <Tabs.Root value={tab} onValueChange={setTab} className="px-6 py-4">
            <Tabs.List className="mb-5 flex flex-wrap gap-1 border-b border-neutral-200">
              {TABS.map(([v, label]) => (
                <Tabs.Trigger key={v} value={v} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 data-[state=active]:border-neutral-900 data-[state=active]:text-neutral-900">
                  {label}{counts[v] ? <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 text-[11px] text-neutral-700">{counts[v]}</span> : null}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="intake">
              <IntakeForm value={intake} onChange={setIntake} onSubmit={() => generateIcp(intake)} onDemo={runDemo} busy={busy} />
              {state.icp && <IcpCards icp={state.icp} mode={state.modes.icp} busy={busy} onDiscover={discover} onSave={async (icp: Icp, note?: string) => { await api("/api/icp", "PUT", { icp, note }); }} />}
            </Tabs.Content>

            <Tabs.Content value="leads">
              <LeadTable state={state} onOpen={(l) => setOpenLead(l.id)} onEnrich={enrich} enriching={enriching} />
            </Tabs.Content>

            <Tabs.Content value="queue">
              <h2 className="font-serif text-xl font-semibold">Send queue</h2>
              <p className="mb-3 text-sm text-neutral-500">Messages a human approved. This app never sends email or LinkedIn messages. The queue is where a real sender would pick them up.</p>
              <div className="space-y-2">
                {queue.map(({ l, m }) => (
                  <div key={m.id} className={`${card} p-3 text-sm`}>
                    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">{l.company}</span><span className="text-neutral-500">to {l.contact.name}{m.channel === "email" && l.contact.email ? ` <${l.contact.email}>` : " on LinkedIn"}</span><span className="rounded bg-neutral-100 px-1.5">Step {m.step}: {m.label}</span><ActorBadge actor="Rep" /><span className="text-neutral-400">approved {m.approvedAt ? time(m.approvedAt) : ""}</span><span className="ml-auto rounded bg-amber-100 px-1.5 font-semibold text-amber-800">QUEUED, NOT SENT</span></div>
                    {m.subject && <div className="mt-1.5 font-medium">{m.subject}</div>}
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-neutral-700">{m.body}</p>
                  </div>
                ))}
                {!queue.length && <p className="py-8 text-center text-sm text-neutral-500">Nothing approved yet. Open a lead and approve a message.</p>}
              </div>
            </Tabs.Content>

            <Tabs.Content value="pipeline">
              <p className="mb-3 text-sm text-neutral-500">Approving a message moves a card to Contacted. Drag cards for every other move. Each card shows who acted last: <ActorBadge actor="AI" /> or <ActorBadge actor="Rep" />.</p>
              <Kanban leads={state.leads} onOpen={(l) => setOpenLead(l.id)} onMove={(leadId, stage: Stage) => {
                setState((s) => (s ? { ...s, leads: s.leads.map((l) => (l.id === leadId ? { ...l, stage, lastActor: "Rep", lastAction: `Moved to ${stage}` } : l)) } : s));
                api("/api/kanban", "POST", { leadId, stage });
              }} />
            </Tabs.Content>

            <Tabs.Content value="graph"><GraphView state={state} onQuery={(query, leadId) => api("/api/graph", "POST", { query, leadId })} /></Tabs.Content>
            <Tabs.Content value="charts"><Charts leads={state.leads} /></Tabs.Content>

            <Tabs.Content value="audit">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <h2 className="mb-2 font-serif text-xl font-semibold">Audit log</h2>
                  <div className={`${card} overflow-hidden`}>
                    <table className="w-full text-[13px]">
                      <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] uppercase tracking-wider text-neutral-500"><tr><th className="px-2 py-1.5">Time</th><th className="px-2 py-1.5">Actor</th><th className="px-2 py-1.5">Action</th><th className="px-2 py-1.5">Detail</th></tr></thead>
                      <tbody>
                        {[...state.audit].reverse().map((a) => (
                          <tr key={a.id} className="border-b border-neutral-100 last:border-0"><td className="whitespace-nowrap px-2 py-1 font-mono text-[11px] text-neutral-500" title={a.ts}>{time(a.ts)}</td><td className="px-2 py-1"><ActorBadge actor={a.actor} /></td><td className="whitespace-nowrap px-2 py-1 font-medium">{a.action}</td><td className="px-2 py-1 text-neutral-700">{a.detail}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {!state.audit.length && <p className="p-4 text-sm text-neutral-500">No actions yet.</p>}
                  </div>
                </div>
                <div>
                  <h2 className="mb-2 font-serif text-xl font-semibold">Credit ledger</h2>
                  <div className={`${card} divide-y divide-neutral-100 text-[13px]`}>
                    {[...state.credits.ledger].reverse().map((e) => (
                      <div key={e.id} className="flex items-center gap-2 px-2 py-1"><span className="font-mono text-[11px] text-neutral-500">{time(e.ts)}</span><span className="font-mono">{e.event}</span><ModeBadge mode={e.mode} /><span className={`ml-auto font-mono ${e.credits > 0 ? "text-emerald-700" : ""}`}>{e.credits > 0 ? "+" : ""}{e.credits}</span></div>
                    ))}
                    {!state.credits.ledger.length && <p className="p-4 text-sm text-neutral-500">No usage yet.</p>}
                  </div>
                </div>
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </div>

        <AgentFeed feed={state.feed} open={feedOpen} onOpenChange={setFeedOpen} running={working} />

        <ReviewDrawer lead={lead} onClose={() => setOpenLead(null)} enriching={enriching} onEnrich={enrich}
          onReview={(leadId, messageId, action, body, subject) => api("/api/review", "POST", { leadId, messageId, action, body, subject })} />

        <DemoVideo open={video} onClose={() => setVideo(false)} pipelineBusy={working} />

        <Dialog.Root open={wall} onOpenChange={setWall}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl focus:outline-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100"><Lock size={18} className="text-rose-700" /></div>
              <Dialog.Title className="mt-3 font-serif text-2xl font-semibold">You are out of credits</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-neutral-600">Enrichment costs 5 credits per lead and your balance is {state.credits.balance}. Upgrade or top up to keep enriching. Leads you already enriched stay available for review.</Dialog.Description>
              <div className="mt-5 flex gap-2">
                <button className={btnPrimary} onClick={async () => { await api("/api/billing", "POST"); setWall(false); }}>Top up 50 credits</button>
                <Dialog.Close className={btn}>Not now</Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </Tooltip.Provider>
  );
}
