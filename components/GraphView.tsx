"use client";
import { useMemo, useState } from "react";
import type { ClientState, GraphNode } from "@/lib/types";
import { btnSm, card } from "./ui";

const EDGE_COLOR: Record<string, string> = { works_at: "#94a3b8", previously_employed_at: "#0284c7", matched_to: "#d4d4d4", competes_with: "#e11d48", uses: "#c026d3", contacted_via: "#f59e0b", replied_to: "#059669" };
const NODE_COLOR: Record<string, string> = { Company: "#171717", Person: "#0284c7", Product: "#059669", Competitor: "#e11d48", Signal: "#f59e0b" };

export function GraphView({ state, onQuery }: { state: ClientState; onQuery: (q: "warm_intro" | "displacement", leadId?: string) => void }) {
  const { graph, leads, displacement } = state;
  const warm = leads.filter((l) => l.warmPath);
  const [sel, setSel] = useState<string>("");
  const lead = leads.find((l) => l.id === sel) ?? warm[0];
  const hi = new Set(lead?.warmPathIds ?? []);

  const { pos, width, height } = useMemo(() => {
    const col = (n: GraphNode) => (n.type === "Product" || n.type === "Competitor" ? 0 : n.type === "Company" && !n.target ? 1 : n.type === "Person" ? 2 : n.type === "Company" ? 3 : 4);
    const cols: GraphNode[][] = [[], [], [], [], []];
    for (const n of graph.nodes) cols[col(n)].push(n);
    const rows = Math.max(1, ...cols.map((c) => c.length));
    const height = Math.max(360, rows * 26 + 50);
    const xs = [70, 270, 480, 700, 900];
    const pos = new Map<string, { x: number; y: number }>();
    cols.forEach((c, ci) => c.forEach((n, i) => pos.set(n.id, { x: xs[ci], y: 44 + ((i + 0.5) * (height - 60)) / c.length })));
    return { pos, width: 1120, height };
  }, [graph]);

  if (!graph.nodes.length) return <p className="py-10 text-center text-sm text-neutral-500">The graph fills in after discovery.</p>;
  const onPath = (a: string, b: string) => { const ids = lead?.warmPathIds ?? []; for (let i = 0; i < ids.length - 1; i++) if ((ids[i] === a && ids[i + 1] === b) || (ids[i] === b && ids[i + 1] === a)) return true; return false; };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className={`${card} p-3`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Query A: warm intro path</h3>
          <p className="text-xs text-neutral-500">Existing customer to target contact through previously_employed_at, up to 4 hops.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select className="rounded border border-neutral-300 px-2 py-1 text-sm" value={lead?.id ?? ""} onChange={(e) => setSel(e.target.value)}>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.contact.name} at {l.company}{l.warmPath ? " (path)" : ""}</option>)}
            </select>
            <button className={btnSm} disabled={!lead} onClick={() => lead && onQuery("warm_intro", lead.id)}>Run query (1 credit)</button>
          </div>
          <p className="mt-2 rounded bg-sky-50 p-2 font-mono text-xs text-sky-950">{lead?.warmPath ?? "No warm path for this contact."}</p>
        </div>
        <div className={`${card} p-3`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Query B: displacement targets</h3>
          <p className="text-xs text-neutral-500">Target companies with a uses edge to a competitor that competes_with the product.</p>
          <button className={`${btnSm} mt-2`} onClick={() => onQuery("displacement")}>Run query (1 credit)</button>
          <ul className="mt-2 space-y-1 text-sm">
            {displacement.map((d) => <li key={d.company} className="rounded bg-fuchsia-50 px-2 py-1 font-mono text-xs text-fuchsia-950">{d.company} -[uses]-&gt; {d.competitor} -[competes_with]-&gt; {state.intake?.name}</li>)}
            {!displacement.length && <li className="text-xs text-neutral-500">None found.</li>}
          </ul>
        </div>
      </div>
      <div className={`${card} overflow-x-auto p-2`}>
        <div className="flex flex-wrap gap-3 px-2 pb-1 text-[11px] text-neutral-600">
          {Object.entries(NODE_COLOR).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{k}</span>)}
          <span className="text-neutral-300">|</span>
          {Object.entries(EDGE_COLOR).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1"><span className="h-0.5 w-4" style={{ background: c }} />{k}</span>)}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[900px]" role="img" aria-label="Knowledge graph">
          {["Product, competitors", "Customers, past employers", "People", "Target companies", "Signals"].map((t, i) => <text key={t} x={[70, 270, 480, 700, 900][i]} y={16} fontSize={11} fill="#737373" fontWeight={600}>{t}</text>)}
          {graph.edges.map((e, i) => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            const on = onPath(e.from, e.to) && (e.type === "works_at" || e.type === "previously_employed_at");
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? "#0369a1" : EDGE_COLOR[e.type]} strokeWidth={on ? 3 : e.type === "matched_to" ? 0.6 : 1.2} opacity={on ? 1 : 0.7} />;
          })}
          {graph.nodes.map((n) => {
            const p = pos.get(n.id)!;
            const on = hi.has(n.id);
            return (
              <g key={n.id}>
                <circle cx={p.x} cy={p.y} r={on ? 7 : 5} fill={NODE_COLOR[n.type]} stroke={on ? "#0369a1" : n.customer ? "#059669" : "#fff"} strokeWidth={on ? 3 : n.customer ? 2.5 : 1} />
                <text x={p.x + 10} y={p.y + 3.5} fontSize={11} fill="#262626" fontWeight={on ? 700 : 400}>{n.label}{n.customer ? " (customer)" : ""}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
