"use client";
import { useEffect, useState } from "react";
import { Ban, Check, Flame, Heart, RotateCcw, Send, Trophy, X } from "lucide-react";
import { Confetti } from "./QuestLog";

interface Round { company: string; blurb: string; fit: [boolean, string]; person: [boolean, string]; timing: [boolean, string]; trap?: string; why: string }
// Fictional seeded leads, the same ones the demo pipeline uses.
const ROUNDS: Round[] = [
  { company: "Larkspur Voice", blurb: "Voice agents for outpatient clinics · 85 employees", fit: [true, "Production voice agent, retrieval on every call turn"], person: [true, "Priya Raman, Head of AI"], timing: [true, "Raised an $18M Series A nine days ago"], why: "All three receipts, each with a source. Send it." },
  { company: "Mellow Studio", blurb: "Studio that prototypes voice experiences · 40 employees", fit: [true, "Builds voice prototypes for brands"], person: [true, "Arjun Mehta, Technical Director"], timing: [false, "No trigger signal found"], why: "No TIMING receipt. There is no reason to reach out today." },
  { company: "Tandem Desk", blurb: "Real time copilot for support agents · 140 employees", fit: [true, "Agent assist copilot, core ICP industry"], person: [true, "Jonas Weber, VP Engineering"], timing: [true, "Launched Live Assist 12 days ago"], why: "Fit, person and a fresh launch. Send it." },
  { company: "Opaline", blurb: "Help desk software adding an AI answer bot · 180 employees", fit: [true, "Support software in the core ICP"], person: [false, "No contact matching a buyer persona"], timing: [true, "Announced its AI answer bot beta"], why: "No PERSON receipt. You would be emailing a company, not a buyer." },
  { company: "Driftwood Analytics", blurb: "Dashboards for retail finance teams · 75 employees", fit: [false, "No agent or copilot product, confidence 0.31"], person: [true, "Peter Aldous, CTO"], timing: [true, "Raised a $4M seed round"], why: "Funding is not fit. Without a FIT receipt this is spam." },
  { company: "Vectorhaus", blurb: "Open source vector database with a managed cloud · 90 employees", fit: [true, "Works on retrieval infrastructure"], person: [true, "Ines Moreau, CEO"], timing: [true, "Raised a $22M Series A"], trap: "Negative signal: sells its own retrieval engine", why: "A negative signal overrides the receipts. They are a competitor, not a buyer." },
  { company: "Quillon AI", blurb: "Sales call copilot · 60 employees", fit: [true, "Real time loop, small platform team"], person: [true, "Aisha Bello, CTO, warm intro via a customer"], timing: [true, "Extended its seed by $7M"], why: "Three receipts plus a warm path. Send it." },
  { company: "Granite Telecom Group", blurb: "National telecom carrier · 12,000 employees", fit: [true, "Runs voice agents at scale"], person: [true, "Helen Marsh, SVP Technology"], timing: [true, "Hiring for its search platform team"], trap: "Negative signal: 12,000 employees with an in-house search team", why: "Far outside the size range and builds in house. Hold back." },
];
const shouldSend = (r: Round) => r.fit[0] && r.person[0] && r.timing[0] && !r.trap;
const RANKS: [number, string][] = [[1500, "Chief Receipts Officer"], [1000, "Proof Collector"], [500, "Signal Scout"], [0, "Receipt Rookie"]];
export const GAME_XP_KEY = "receipts.gameXp";

export function ReceiptGame({ onXp, onConsole }: { onXp: (xp: number) => void; onConsole: () => void }) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [correct, setCorrect] = useState(0);
  const [verdict, setVerdict] = useState<null | { right: boolean; sent: boolean; gained: number }>(null);
  const [best, setBest] = useState(0);
  const round = ROUNDS[i];
  const over = lives === 0 || i >= ROUNDS.length;

  useEffect(() => { setBest(Number(window.localStorage.getItem("receipts.best") || 0)); }, []);
  useEffect(() => {
    if (!over) return;
    if (score > best) { setBest(score); window.localStorage.setItem("receipts.best", String(score)); }
    const xp = Math.max(Number(window.localStorage.getItem(GAME_XP_KEY) || 0), Math.round(score / 10));
    window.localStorage.setItem(GAME_XP_KEY, String(xp));
    onXp(xp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const answer = (sent: boolean) => {
    if (verdict || over) return;
    const right = sent === shouldSend(round);
    const mult = Math.min(3, 1 + streak * 0.5);
    const gained = right ? Math.round(100 * mult) : 0;
    setVerdict({ right, sent, gained });
    if (right) { setScore((s) => s + gained); setStreak((s) => s + 1); setCorrect((c) => c + 1); } else { setStreak(0); setLives((l) => l - 1); }
  };
  const next = () => { setVerdict(null); setI((n) => n + 1); };
  const restart = () => { setI(0); setScore(0); setStreak(0); setLives(3); setCorrect(0); setVerdict(null); };

  // Keyboard: S to send, H to hold, Enter for next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (verdict && e.key === "Enter") next();
      else if (!verdict && e.key.toLowerCase() === "s") answer(true);
      else if (!verdict && e.key.toLowerCase() === "h") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const hud = (
    <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-5 py-3 text-sm">
      <span className="font-mono text-2xl font-bold tabular-nums text-amber-300">{score}</span>
      <span className="text-xs uppercase tracking-wider text-neutral-400">points</span>
      <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${streak >= 2 ? "bg-orange-500 text-white" : "bg-neutral-800 text-neutral-300"}`}><Flame size={12} /> {streak} streak · x{Math.min(3, 1 + streak * 0.5).toFixed(1)}</span>
      <span className="ml-auto flex items-center gap-1">{[0, 1, 2].map((h) => <Heart key={h} size={16} className={h < lives ? "fill-rose-500 text-rose-500" : "text-neutral-700"} />)}</span>
      <span className="flex gap-1">{ROUNDS.map((_, n) => <span key={n} className={`h-1.5 w-4 rounded-full ${n < i ? "bg-emerald-400" : n === i && !over ? "bg-white" : "bg-neutral-700"}`} />)}</span>
    </div>
  );

  if (over) {
    const rank = RANKS.find(([min]) => score >= min)![1];
    return (
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 text-white shadow-2xl">
        {hud}
        {lives > 0 && <Confetti count={40} />}
        <div className="anim-pop px-6 py-10 text-center">
          <Trophy size={40} className="mx-auto text-amber-300" />
          <div className="mt-3 text-xs uppercase tracking-[0.2em] text-neutral-400">{lives > 0 ? "Shift complete" : "Out of lives"}</div>
          <div className="mt-1 font-serif text-4xl font-bold">{rank}</div>
          <p className="mt-2 text-neutral-300">{correct} of {ROUNDS.length} calls right · {score} points · best {Math.max(best, score)}</p>
          <p className="mt-1 font-mono text-sm text-amber-300">+{Math.round(score / 10)} XP added to your quest log</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={restart} className="inline-flex items-center gap-2 rounded-lg border border-neutral-600 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800"><RotateCcw size={15} /> Play again</button>
            <button onClick={onConsole} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-200">Now do it for real in the console</button>
          </div>
        </div>
      </div>
    );
  }

  const rows: [string, [boolean, string]][] = [["FIT", round.fit], ["PERSON", round.person], ["TIMING", round.timing]];
  return (
    <div className="overflow-hidden rounded-3xl bg-neutral-900 text-white shadow-2xl">
      {hud}
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_15rem]">
        <div key={i} className={`relative rounded-2xl bg-white p-5 text-neutral-900 anim-slide-up ${verdict && !verdict.right ? "anim-shake" : ""}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Lead {i + 1} of {ROUNDS.length}</div>
          <div className="font-serif text-2xl font-semibold">{round.company}</div>
          <div className="text-xs text-neutral-500">{round.blurb}</div>
          <ul className="mt-4 space-y-2">
            {rows.map(([name, [ok, text]]) => (
              <li key={name} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>{ok ? <Check size={13} /> : <X size={13} />}</span>
                <span className="w-16 shrink-0 text-xs font-bold tracking-wide">{name}</span>
                <span className="text-neutral-800">{text}</span>
              </li>
            ))}
            {round.trap && <li className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white"><Ban size={16} className="shrink-0 text-amber-300" /><span>{round.trap}</span></li>}
          </ul>
          {verdict && (
            <div className={`anim-stamp absolute right-5 top-5 rounded-md border-4 px-3 py-1 font-mono text-lg font-black uppercase tracking-widest ${shouldSend(round) ? "border-emerald-600 text-emerald-700" : "border-rose-600 text-rose-700"}`}>{shouldSend(round) ? "Send" : "Held back"}</div>
          )}
        </div>

        <div className="flex flex-col justify-center gap-3">
          {!verdict ? (
            <>
              <p className="text-sm text-neutral-300">You are the agent. Does this lead get outreach?</p>
              <button onClick={() => answer(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-4 text-base font-bold text-white transition-transform hover:scale-[1.03] active:scale-95"><Send size={18} /> Draft outreach <kbd className="ml-1 rounded bg-emerald-700 px-1.5 text-xs">S</kbd></button>
              <button onClick={() => answer(false)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-4 text-base font-bold text-white transition-transform hover:scale-[1.03] active:scale-95"><Ban size={18} /> Hold back <kbd className="ml-1 rounded bg-rose-700 px-1.5 text-xs">H</kbd></button>
            </>
          ) : (
            <div className="anim-pop">
              <div className={`relative text-2xl font-bold ${verdict.right ? "text-emerald-400" : "text-rose-400"}`}>
                {verdict.right ? "Correct" : "Wrong call"}
                {verdict.right && <span className="anim-float-up absolute -top-1 left-28 font-mono text-lg text-amber-300">+{verdict.gained}</span>}
              </div>
              <p className="mt-1 text-sm text-neutral-200">{round.why}</p>
              <button onClick={next} className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-neutral-900 hover:bg-neutral-200">{i + 1 >= ROUNDS.length || lives === 0 ? "See results" : "Next lead"} <kbd className="ml-1 rounded bg-neutral-200 px-1.5 text-xs">Enter</kbd></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
