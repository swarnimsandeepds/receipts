"use client";
import type { ReactNode } from "react";
import type { Mode, Tier } from "@/lib/types";

export function ModeBadge({ mode, label }: { mode?: Mode; label?: string }) {
  if (!mode) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${mode === "live" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
      {label ? `${label} ` : ""}{mode}
    </span>
  );
}

export function Conf({ v }: { v: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  return (
    <span className="inline-flex items-center gap-1 align-middle" title={`Confidence ${v.toFixed(2)}`}>
      <span className="inline-block h-1.5 w-10 overflow-hidden rounded bg-neutral-200"><span className={`block h-full ${pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} /></span>
      <span className="font-mono text-[11px] tabular-nums text-neutral-600">{v.toFixed(2)}</span>
    </span>
  );
}

export function Src({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return null;
  return <a href={href} target="_blank" rel="noreferrer" className="text-[11px] text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700">{children ?? "source"} ↗</a>;
}

export function TierBadge({ tier }: { tier: Tier }) {
  const c = tier === "A" ? "bg-emerald-600 text-white" : tier === "B" ? "bg-amber-500 text-white" : "bg-neutral-400 text-white";
  return <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${c}`}>{tier}</span>;
}

export function ActorBadge({ actor }: { actor: "AI" | "Rep" }) {
  return <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${actor === "AI" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>{actor}</span>;
}

export const btn = "inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50";
export const btnSm = "inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50";
export const card = "rounded-lg border border-neutral-200 bg-white";
export const time = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
