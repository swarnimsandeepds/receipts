"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactNode } from "react";
import { Ban, Check, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";

// An in-app animated walkthrough that plays like a video while the real pipeline runs behind it.
const SCENE_MS = 5000;
const d = (ms: number) => ({ animationDelay: `${ms}ms` });
const Row = ({ delay, children, className = "" }: { delay: number; children: ReactNode; className?: string }) => <div className={`anim-slide-up ${className}`} style={d(delay)}>{children}</div>;

const SCENES: { title: string; caption: string; body: ReactNode }[] = [
  {
    title: "1. Define", caption: "Describe what you sell. One prompt becomes an editable ICP with confidence scores.",
    body: (
      <div className="grid gap-3 md:grid-cols-2">
        <Row delay={0} className="border border-neutral-700 bg-neutral-900 p-4"><div className="eyebrow !text-neutral-400">Intake</div><p className="mt-2 text-sm text-neutral-200">Moss (moss.dev): real time semantic search for voice agents and copilots.</p></Row>
        <div className="space-y-2">
          {[["Voice AI platforms", "0.93"], ["Support and contact center software", "0.86"], ["Head of AI / ML Engineering", "0.92"], ["Trigger: raised Seed to Series B", "0.88"]].map(([t, c], i) => (
            <Row key={t} delay={600 + i * 500} className="flex items-center justify-between bg-white px-3 py-2 text-sm text-neutral-900"><span>{t}</span><span className="font-mono text-xs text-emerald-700">{c}</span></Row>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "2. Discover", caption: "The agent searches for accounts and trigger signals. Every result keeps its source link.",
    body: (
      <div className="space-y-2">
        {["voice AI agent startups funding round", "hiring retrieval engineer voice agent", "launch real time agent assist copilot"].map((q, i) => (
          <Row key={q} delay={i * 700} className="flex items-center gap-3 border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"><span className="font-mono text-xs text-sky-400">SEARCH</span><span className="text-neutral-200">&ldquo;{q}&rdquo;</span><span className="ml-auto font-mono text-xs text-neutral-500">6 results</span></Row>
        ))}
        <Row delay={2400} className="bg-white px-3 py-2 text-sm text-neutral-900">Larkspur Voice raised an $18M Series A <span className="text-xs text-blue-700 underline">source ↗</span></Row>
        <Row delay={3000} className="bg-white px-3 py-2 text-sm text-neutral-900">Tandem Desk launched Live Assist <span className="text-xs text-blue-700 underline">source ↗</span></Row>
      </div>
    ),
  },
  {
    title: "3. Prove", caption: "Three receipts or nothing. Leads missing one are held back with the reason.",
    body: (
      <div className="grid gap-3 md:grid-cols-2">
        <Row delay={0} className="relative bg-white p-4 text-neutral-900">
          <div className="text-lg font-medium tracking-tight">Larkspur Voice</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["FIT", "PERSON", "TIMING"].map((r, i) => <span key={r} className="anim-stamp border-2 border-emerald-600 px-2 py-0.5 font-mono text-xs font-black tracking-widest text-emerald-700" style={d(700 + i * 600)}>{r} ✓</span>)}
          </div>
          <div className="anim-slide-up mt-3 inline-flex items-center gap-1 bg-emerald-600 px-2 py-1 text-xs font-semibold text-white" style={d(2700)}><Check size={12} /> Outreach unlocked</div>
        </Row>
        <Row delay={1500} className="bg-white p-4 text-neutral-900">
          <div className="text-lg font-medium tracking-tight">Mellow Studio</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="border-2 border-emerald-600 px-2 py-0.5 font-mono text-xs font-black tracking-widest text-emerald-700">FIT ✓</span>
            <span className="border-2 border-emerald-600 px-2 py-0.5 font-mono text-xs font-black tracking-widest text-emerald-700">PERSON ✓</span>
            <span className="border-2 border-dashed border-rose-500 px-2 py-0.5 font-mono text-xs font-black tracking-widest text-rose-600">TIMING ✗</span>
          </div>
          <div className="anim-slide-up mt-3 inline-flex items-center gap-1 bg-rose-600 px-2 py-1 text-xs font-semibold text-white" style={d(3300)}><Ban size={12} /> Held back: no reason to reach out today</div>
        </Row>
      </div>
    ),
  },
  {
    title: "4. Retrieve", caption: "Every signal is indexed in Moss. The agent pulls a company's top signals in milliseconds.",
    body: (
      <div className="space-y-2">
        <Row delay={0} className="flex items-center gap-3 border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm"><span className="font-mono text-xs text-emerald-400">MOSS</span><span className="text-neutral-200">Indexed 39 snippets and signals into &ldquo;signals&rdquo;</span></Row>
        {[["Larkspur Voice", "2.9 ms"], ["Tandem Desk", "3.1 ms"], ["Quillon AI", "2.6 ms"]].map(([c, ms], i) => (
          <Row key={c} delay={900 + i * 700} className="flex items-center gap-3 bg-white px-3 py-2 text-sm text-neutral-900"><span>Top signals for {c}</span><div className="barcode w-24" /><span className="ml-auto bg-[#f6dc5c] px-2 font-mono text-xs font-bold">{ms}</span></Row>
        ))}
      </div>
    ),
  },
  {
    title: "5. Connect", caption: "A knowledge graph finds warm intro paths and companies using a competitor.",
    body: (
      <div className="flex flex-wrap items-center justify-center gap-2 py-6 text-sm">
        {[["Hearth AI", "customer"], ["Dana Okafor", "works there"], ["Kestrel Labs", "past employer"], ["Jonas Weber", "also worked there"], ["Tandem Desk", "target"]].map(([n, t], i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <span className="anim-slide-up text-neutral-500" style={d(i * 700 - 300)}>→</span>}
            <div className="anim-pop bg-white px-3 py-2 text-center text-neutral-900" style={d(i * 700)}><div className="font-medium tracking-tight">{n}</div><div className="eyebrow">{t}</div></div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "6. Review", caption: "A human approves every message. Approved messages are queued. Nothing is sent for you.",
    body: (
      <Row delay={0} className="bg-white p-4 text-neutral-900">
        <div className="eyebrow">Step 1: Email · draft</div>
        <p className="mt-2 text-sm">Hi Priya, I saw this and wanted to reach out today: &ldquo;Larkspur Voice raised an $18M Series A to expand its clinic voice agent to 400 new sites.&rdquo;</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="anim-pop border border-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-800" style={d(1200)}>✓ Approve</span>
          <span className="border border-neutral-300 px-2 py-1 text-xs">Edit</span><span className="border border-neutral-300 px-2 py-1 text-xs">Reject</span>
          <span className="anim-stamp ml-auto border-2 border-amber-600 px-2 py-0.5 font-mono text-xs font-black tracking-widest text-amber-700" style={d(2400)}>QUEUED, NOT SENT</span>
        </div>
      </Row>
    ),
  },
];

export function DemoVideo({ open, onClose, pipelineBusy }: { open: boolean; onClose: () => void; pipelineBusy: boolean }) {
  const [{ scene, elapsed }, setClock] = useState({ scene: 0, elapsed: 0 });
  const [playing, setPlaying] = useState(true);
  const seek = (n: number) => { setClock({ scene: n, elapsed: 0 }); setPlaying(true); };
  const done = scene >= SCENES.length;

  useEffect(() => { if (open) seek(0); }, [open]);
  // Advance on wall-clock time so the video keeps pace even when the browser throttles timers.
  useEffect(() => {
    if (!open || !playing || done) return;
    let last = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      setClock((c) => {
        const total = c.scene * SCENE_MS + c.elapsed + delta;
        return { scene: Math.min(SCENES.length, Math.floor(total / SCENE_MS)), elapsed: total % SCENE_MS };
      });
    }, 100);
    return () => clearInterval(t);
  }, [open, playing, done]);

  const s = SCENES[Math.min(scene, SCENES.length - 1)];
  const total = SCENES.length * SCENE_MS;
  const at = Math.min(total, scene * SCENE_MS + elapsed);
  const fmt = (ms: number) => `0:${String(Math.floor(ms / 1000)).padStart(2, "0")}`;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[min(56rem,94vw)] -translate-x-1/2 -translate-y-1/2 bg-[#131313] text-white shadow-2xl focus:outline-none" aria-describedby={undefined}>
          <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            <Dialog.Title className="text-sm font-semibold tracking-tight">How Receipts works</Dialog.Title>
            <span className="eyebrow !text-neutral-500">30 second walkthrough</span>
            <span className="ml-auto text-xs text-neutral-400">{pipelineBusy ? "The live demo is running in the console behind this" : "The live demo is ready in the console"}</span>
            <Dialog.Close className="p-1 hover:bg-neutral-800" aria-label="Close"><X size={16} /></Dialog.Close>
          </div>

          <div className="flex min-h-[21rem] flex-col justify-center px-6 py-6">
            {done ? (
              <div className="anim-pop text-center">
                <div className="eyebrow !text-neutral-400">That is the whole loop</div>
                <div className="display mt-2 text-4xl">No <span style={{ color: "var(--hl)" }}>receipt</span>, no outreach.</div>
                <p className="mt-2 text-neutral-300">{pipelineBusy ? "The live run is still finishing in the console." : "The live run has finished. The leads are waiting in the console."}</p>
                <div className="mt-5 flex justify-center gap-2">
                  <button className="btn-paper" onClick={() => seek(0)}><RotateCcw size={14} /> Replay</button>
                  <button className="inline-flex items-center gap-2 border border-[#f6dc5c] bg-[#f6dc5c] px-4 py-2.5 text-sm font-semibold text-black" onClick={onClose}>{pipelineBusy ? "Watch the live run" : "See the results"}</button>
                </div>
              </div>
            ) : (
              <div key={scene}>
                <div className="anim-slide-up display text-3xl">{s.title}</div>
                <div className="mt-4">{s.body}</div>
              </div>
            )}
          </div>

          {!done && <p className="border-t border-neutral-800 px-6 py-3 text-center text-sm text-neutral-200">{s.caption}</p>}

          <div className="flex items-center gap-3 border-t border-neutral-800 px-4 py-2.5">
            <button className="p-1.5 hover:bg-neutral-800" onClick={() => (done ? seek(0) : setPlaying((p) => !p))} aria-label={playing && !done ? "Pause" : "Play"}>{done ? <RotateCcw size={16} /> : playing ? <Pause size={16} /> : <Play size={16} />}</button>
            <span className="font-mono text-xs text-neutral-400">{fmt(at)} / {fmt(total)}</span>
            <div className="flex flex-1 gap-1">
              {SCENES.map((sc, i) => (
                <button key={sc.title} className="h-1.5 flex-1 bg-neutral-700" onClick={() => seek(i)} aria-label={`Go to ${sc.title}`}>
                  <span className="block h-full bg-[#f6dc5c]" style={{ width: i < scene ? "100%" : i === scene ? `${(elapsed / SCENE_MS) * 100}%` : "0%" }} />
                </button>
              ))}
            </div>
            <button className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white" onClick={onClose}><SkipForward size={14} /> Skip</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
