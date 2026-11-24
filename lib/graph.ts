// In-memory knowledge graph, rebuilt from state. Two multi-hop queries: warm intro and displacement.
import type { Graph, GraphEdge, GraphNode, State } from "./types";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const companyId = (n: string) => `co:${slug(n)}`;
export const personId = (n: string) => `p:${slug(n)}`;

export function customersOf(s: State): string[] {
  return (s.intake?.customers ?? "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
}

export function buildGraph(s: State): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const add = (n: GraphNode) => { const e = nodes.get(n.id); if (e) Object.assign(e, { ...n, ...e, customer: e.customer || n.customer, target: e.target || n.target }); else nodes.set(n.id, n); };
  const edge = (from: string, to: string, type: GraphEdge["type"]) => { if (!edges.some((e) => e.from === from && e.to === to && e.type === type)) edges.push({ from, to, type }); };
  if (!s.intake) return { nodes: [], edges: [] };

  const product = `product:${slug(s.intake.name || "product")}`;
  add({ id: product, type: "Product", label: s.intake.name || "Product" });
  for (const c of customersOf(s)) { add({ id: companyId(c), type: "Company", label: c, customer: true }); edge(companyId(c), product, "matched_to"); }
  for (const c of s.competitors) { add({ id: `comp:${slug(c.name)}`, type: "Competitor", label: c.name }); edge(`comp:${slug(c.name)}`, product, "competes_with"); }
  for (const p of s.people) {
    add({ id: personId(p.name), type: "Person", label: p.name });
    add({ id: companyId(p.company), type: "Company", label: p.company });
    edge(personId(p.name), companyId(p.company), "works_at");
    for (const prev of p.previousEmployers) { add({ id: companyId(prev), type: "Company", label: prev }); edge(personId(p.name), companyId(prev), "previously_employed_at"); }
  }
  for (const l of s.leads) {
    const co = companyId(l.company);
    add({ id: co, type: "Company", label: l.company, target: true });
    edge(co, product, "matched_to");
    if (l.usesCompetitor) { add({ id: `comp:${slug(l.usesCompetitor)}`, type: "Competitor", label: l.usesCompetitor }); edge(co, `comp:${slug(l.usesCompetitor)}`, "uses"); }
    const p = personId(l.contact.name);
    add({ id: p, type: "Person", label: l.contact.name });
    edge(p, co, "works_at");
    for (const prev of l.contact.previousEmployers) { add({ id: companyId(prev), type: "Company", label: prev }); edge(p, companyId(prev), "previously_employed_at"); }
    const top = l.signals[0];
    if (top) {
      add({ id: `sig:${top.id}`, type: "Signal", label: `${top.type}: ${top.sourceTitle}`.slice(0, 48) });
      edge(`sig:${top.id}`, co, "matched_to");
      if (l.stage !== "Matched") edge(p, `sig:${top.id}`, "contacted_via");
    }
    if (l.stage === "Replied" || l.stage === "Meeting Booked") edge(p, product, "replied_to");
  }
  return { nodes: [...nodes.values()], edges };
}

/**
 * Query (a): warm intro. Breadth first search from an existing customer to the target contact,
 * walking works_at and previously_employed_at edges in either direction, at most 4 hops,
 * and requiring at least one previously_employed_at hop.
 */
export function warmIntroPath(graph: Graph, customerNames: string[], contactName: string): { text: string; ids: string[]; hops: number } | null {
  const target = personId(contactName);
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const adj = new Map<string, { to: string; type: string; forward: boolean }[]>();
  for (const e of graph.edges) {
    if (e.type !== "works_at" && e.type !== "previously_employed_at") continue;
    (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push({ to: e.to, type: e.type, forward: true });
    (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)!).push({ to: e.from, type: e.type, forward: false });
  }
  let best: { text: string; ids: string[]; hops: number } | null = null;
  for (const c of customerNames) {
    const start = companyId(c);
    const queue: { id: string; path: { id: string; via?: string; forward?: boolean }[]; prev: boolean }[] = [{ id: start, path: [{ id: start }], prev: false }];
    const seen = new Set([start]);
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur.id === target && cur.prev) {
        const text = cur.path.map((p, i) => (i === 0 ? `${label(p.id)} (customer)` : `${p.forward ? `-[${p.via}]->` : `<-[${p.via}]-`} ${label(p.id)}`)).join(" ");
        if (!best || cur.path.length - 1 < best.hops) best = { text, ids: cur.path.map((p) => p.id), hops: cur.path.length - 1 };
        break;
      }
      if (cur.path.length > 4) continue;
      for (const nx of adj.get(cur.id) ?? []) {
        if (seen.has(nx.to)) continue;
        seen.add(nx.to);
        queue.push({ id: nx.to, path: [...cur.path, { id: nx.to, via: nx.type, forward: nx.forward }], prev: cur.prev || nx.type === "previously_employed_at" });
      }
    }
  }
  return best;
}

/** Query (b): displacement targets. Target companies with a "uses" edge to a competitor that competes_with our product. */
export function displacementTargets(graph: Graph): { company: string; competitor: string }[] {
  const competitors = new Set(graph.edges.filter((e) => e.type === "competes_with").map((e) => e.from));
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  return graph.edges.filter((e) => e.type === "uses" && competitors.has(e.to)).map((e) => ({ company: label(e.from), competitor: label(e.to) }));
}
