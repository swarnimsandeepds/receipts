"use client";
import { useEffect, useRef, useState } from "react";
import { Database, Loader2, Search } from "lucide-react";
import type { ClientState, Lead, Mode } from "@/lib/types";
import { ModeBadge, Src, TierBadge } from "./ui";

interface Hit { text: string; company: string; sourceUrl: string; type: string; score: number }
interface Result { hits: Hit[]; ms: number; mode: Mode }
const SUGGESTIONS = ["who just raised a funding round", "hiring retrieval or search engineers", "retrieval latency hurting calls", "moving off their current vector store", "launched a real time copilot"];

/** Search every indexed signal as you type. Retrieval runs on Moss and reports its latency. */
export function SignalSearch({ state, onOpen }: { state: ClientState; onOpen: (l: Lead) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const seq = useRef(0);

  const run = async (query: string, log: boolean) => {
    const id = ++seq.current;
    if (query.trim().length < 2) { setRes(null); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, log }), cache: "no-store" });
      const json = await r.json();
      if (id !== seq.current) return; // a newer keystroke already superseded this one
      setRes(json.result);
      if (json.result?.hits?.length) setHistory((h) => [...h.slice(-19), json.result.ms]);
    } catch { if (id === seq.current) setRes({ hits: [], ms: 0, mode: "mock" }); }
    finally { if (id === seq.current) setLoading(false); }
  };

  // Search as you type, debounced.
  useEffect(() => {
    const t = setTimeout(() => run(q, false), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const leadFor = (company: string) => state.leads.find((l) => l.company === company);
  const held = (company: string) => state.heldBack.find((h) => h.company === company);
  const avg = history.length ? (history.reduce((a, b) => a + b, 0) / history.length).toFixed(1) : null;
  const empty = !state.leads.length && !state.heldBack.length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Retrieval by Moss</div>
          <h2 className="display mt-1 text-3xl">Signal search</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Ask in plain language. Moss searches every indexed snippet and trigger signal by meaning, not keywords.</p>
        </div>
        <div className="flex items-center gap-2 border bg-white px-3 py-2" style={{ borderColor: "var(--line)" }}>
          <Database size={15} />
          <div className="leading-tight">
            <div className="eyebrow">Avg retrieval</div>
            <div className="font-mono text-lg font-semibold tabular-nums">{avg ? `${avg} ms` : "n/a"}</div>
          </div>
          <div className="ml-2 flex h-8 items-end gap-px" aria-hidden>
            {history.map((ms, i) => <span key={i} className="w-1 bg-[#131313]" style={{ height: `${Math.max(12, Math.min(100, (ms / Math.max(...history)) * 100))}%` }} />)}
          </div>
          <ModeBadge mode={res?.mode ?? state.integrations.Moss} />
        </div>
      </div>

      <form className="mt-4 flex border bg-white" style={{ borderColor: "var(--ink)" }} onSubmit={(e) => { e.preventDefault(); run(q, true); }}>
        <span className="flex items-center pl-3">{loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}</span>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={empty ? "Run the demo first, then search the signals" : "e.g. who is hiring search engineers"} aria-label="Search signals"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base outline-none" />
        <button type="submit" className="btn-ink !border-0">Search</button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => { setQ(s); run(s, true); }} className="border bg-white px-2 py-1 text-xs hover:bg-[#f4f1e7]" style={{ borderColor: "var(--line)" }}>{s}</button>)}
      </div>

      <div className="mt-4">
        {res && q.trim().length >= 2 && (
          <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            <span>{res.hits.length} signals</span><span className="bg-[#f6dc5c] px-1.5 font-mono font-bold text-black">{res.ms} ms</span><ModeBadge mode={res.mode} label="Moss" />
          </div>
        )}
        <ol className="border-t" style={{ borderColor: "var(--line)" }}>
          {(res?.hits ?? []).map((h, i) => {
            const lead = leadFor(h.company), hb = held(h.company);
            const text = h.text.startsWith(h.company + ": ") ? h.text.slice(h.company.length + 2) : h.text;
            return (
              <li key={i} className="anim-slide-up flex items-start gap-3 border-b bg-white px-3 py-3" style={{ borderColor: "var(--line)", animationDelay: `${i * 30}ms` }}>
                <div className="w-14 shrink-0">
                  <div className="font-mono text-sm font-semibold tabular-nums">{h.score.toFixed(2)}</div>
                  <div className="mt-1 h-1 bg-neutral-200"><div className="h-full bg-[#131313]" style={{ width: `${Math.max(4, Math.min(100, h.score * 100))}%` }} /></div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {lead ? <button type="button" onClick={() => onOpen(lead)} className="font-semibold tracking-tight underline decoration-neutral-300 underline-offset-4 hover:decoration-black">{h.company}</button> : <span className="font-semibold tracking-tight">{h.company}</span>}
                    {lead && <><TierBadge tier={lead.tier} /><span className="font-mono text-xs">{lead.score}</span></>}
                    {hb && <span className="bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-800">HELD BACK</span>}
                    {h.type && <span className="eyebrow">{h.type.replace("_", " ")}</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-800">{text}</p>
                  <Src href={h.sourceUrl} />
                </div>
              </li>
            );
          })}
        </ol>
        {res && !res.hits.length && q.trim().length >= 2 && !loading && <p className="border-b bg-white p-4 text-sm" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>{empty ? "Nothing is indexed yet. Click Run demo, then search again." : "No matching signals. Try describing the situation in different words."}</p>}
        {!res && <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>Type a question or pick a suggestion above. Results update as you type.</p>}
      </div>
    </div>
  );
}
