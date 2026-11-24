"use client";
import { Loader2, Play, Sparkles } from "lucide-react";
import type { Intake } from "@/lib/types";
import { btn, btnPrimary, card } from "./ui";

export function IntakeForm({ value, onChange, onSubmit, onDemo, busy }: { value: Intake; onChange: (v: Intake) => void; onSubmit: () => void; onDemo: () => void; busy: string | null }) {
  const set = (k: keyof Intake) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  const input = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";
  return (
    <section className={`${card} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold">1. Intake</h2>
          <p className="text-sm text-neutral-500">Describe what you sell. The agent turns it into an ICP, then finds accounts it can prove.</p>
        </div>
        <button className={btn} onClick={onDemo} disabled={!!busy}><Play size={14} /> Load demo</button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium md:col-span-2">Product name
          <input className={input} value={value.name} onChange={set("name")} placeholder="Moss" />
        </label>
        <label className="text-sm font-medium md:col-span-2">Product description
          <textarea className={input} rows={3} value={value.product} onChange={set("product")} placeholder="What it does and who it is for" />
        </label>
        <label className="text-sm font-medium">Existing customers
          <textarea className={input} rows={2} value={value.customers} onChange={set("customers")} placeholder="Comma separated" />
        </label>
        <label className="text-sm font-medium">Pricing
          <textarea className={input} rows={2} value={value.pricing} onChange={set("pricing")} placeholder="Model and price points" />
        </label>
      </div>
      <div className="mt-4">
        <button className={btnPrimary} onClick={onSubmit} disabled={!!busy || !value.product.trim()}>
          {busy === "icp" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate ICP
        </button>
      </div>
    </section>
  );
}
