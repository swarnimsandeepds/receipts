"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Check, Lock, Trophy, X, Zap } from "lucide-react";
import type { ClientState } from "@/lib/types";
import { computeQuests, levelFor, XP_PER_LEVEL, type Quest } from "@/lib/quests";

export function Confetti({ count = 28 }: { count?: number }) {
  const colors = ["#059669", "#f59e0b", "#2563eb", "#e11d48", "#7c3aed", "#171717"];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="confetti-piece" style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 7) * 0.06}s`, animationDuration: `${1.1 + (i % 5) * 0.15}s` }} />
      ))}
    </div>
  );
}

export function QuestLog({ state, gameXp }: { state: ClientState; gameXp: number }) {
  const quests = computeQuests(state);
  const xp = quests.filter((q) => q.done).reduce((n, q) => n + q.xp, 0) + gameXp;
  const lv = levelFor(xp);
  const doneCount = quests.filter((q) => q.done).length;
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Quest[]>([]);
  const seen = useRef<Set<string> | null>(null);

  // Toast when a quest flips to done. The first render only records what was already complete.
  const doneIds = quests.filter((q) => q.done).map((q) => q.id).join(",");
  useEffect(() => {
    const now = new Set(doneIds ? doneIds.split(",") : []);
    if (seen.current) {
      const fresh = quests.filter((q) => q.done && !seen.current!.has(q.id));
      if (fresh.length) {
        setToasts((t) => [...t, ...fresh]);
        setTimeout(() => setToasts((t) => t.filter((x) => !fresh.includes(x))), 3800);
      }
    }
    seen.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneIds]);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button className="group flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-3 text-left transition-shadow hover:shadow-md" aria-label={`Quests: level ${lv.level}, ${xp} XP`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 font-mono text-sm font-bold text-white transition-transform group-hover:scale-110">{lv.level}</span>
            <span className="hidden sm:block">
              <span className="flex items-center gap-1.5 text-xs font-semibold leading-none">{lv.rank}<span className="font-mono font-normal text-neutral-500">{xp} XP</span></span>
              <span className="mt-1 block h-1.5 w-32 overflow-hidden rounded-full bg-neutral-200"><span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-700" style={{ width: `${lv.pct}%` }} /></span>
            </span>
            <span className="rounded-full bg-neutral-100 px-1.5 font-mono text-[11px] text-neutral-700">{doneCount}/{quests.length}</span>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="fixed right-4 top-16 z-50 max-h-[80vh] w-[22rem] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl focus:outline-none anim-pop" aria-describedby={undefined}>
            <div className="flex items-center justify-between">
              <Dialog.Title className="flex items-center gap-2 font-serif text-xl font-semibold"><Trophy size={18} className="text-amber-500" /> Quest log</Dialog.Title>
              <Dialog.Close className="rounded p-1 hover:bg-neutral-100" aria-label="Close"><X size={16} /></Dialog.Close>
            </div>
            <div className="mt-3 rounded-xl bg-gradient-to-br from-amber-50 to-rose-50 p-3">
              <div className="flex items-baseline justify-between"><span className="text-sm font-semibold">Level {lv.level}: {lv.rank}</span><span className="font-mono text-xs text-neutral-600">{lv.into}/{XP_PER_LEVEL} XP</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-700" style={{ width: `${lv.pct}%` }} /></div>
              <p className="mt-1.5 text-[11px] text-neutral-600">XP comes from real actions in the console{gameXp ? `, plus ${gameXp} XP from Receipt Check` : " and from the Receipt Check game"}.</p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {quests.map((q) => (
                <li key={q.id} className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${q.done ? "border-emerald-200 bg-emerald-50" : "border-neutral-200"}`}>
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${q.done ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-400"}`}>{q.done ? <Check size={13} /> : <Lock size={11} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">{q.title}<span className={`ml-auto shrink-0 rounded-full px-1.5 font-mono text-[11px] ${q.done ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800"}`}>+{q.xp}</span></span>
                    <span className="block text-xs text-neutral-600">{q.hint}</span>
                    {q.progress && !q.done && <span className="font-mono text-[11px] text-neutral-500">{q.progress}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {toasts.map((q) => (
          <div key={q.id} className="anim-slide-up relative flex items-center gap-3 rounded-full bg-neutral-900 py-2 pl-2 pr-5 text-white shadow-2xl">
            <Confetti count={18} />
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500"><Zap size={15} /></span>
            <span className="text-sm"><span className="font-semibold">Quest complete: {q.title}</span> <span className="font-mono text-amber-300">+{q.xp} XP</span></span>
          </div>
        ))}
      </div>
    </>
  );
}
