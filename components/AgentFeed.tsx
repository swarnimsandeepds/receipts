"use client";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useEffect, useRef } from "react";
import { Ban, Brain, ChevronRight, Coins, Database, Info, Search, Share2, UserSearch } from "lucide-react";
import type { FeedEvent } from "@/lib/types";
import { ModeBadge, time } from "./ui";

const ICON = { search: Search, llm: Brain, moss: Database, graph: Share2, held: Ban, credit: Coins, enrich: UserSearch, info: Info } as const;
const COLOR = { search: "text-blue-600", llm: "text-violet-600", moss: "text-emerald-600", graph: "text-fuchsia-600", held: "text-rose-600", credit: "text-amber-600", enrich: "text-sky-600", info: "text-neutral-500" } as const;

export function AgentFeed({ feed, open, onOpenChange, running }: { feed: FeedEvent[]; open: boolean; onOpenChange: (o: boolean) => void; running: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [feed.length]);
  return (
    <Collapsible.Root open={open} onOpenChange={onOpenChange} className={`shrink-0 border-l border-neutral-200 bg-neutral-50 ${open ? "w-80" : "w-10"}`}>
      <div className="sticky top-0 flex h-screen flex-col">
        <Collapsible.Trigger className="flex items-center gap-2 border-b border-neutral-200 px-2.5 py-2.5 text-left hover:bg-neutral-100" aria-label="Toggle agent feed">
          <ChevronRight size={16} className={`shrink-0 transition-transform ${open ? "" : "rotate-180"}`} />
          {open && <span className="text-sm font-semibold">Agent thinking</span>}
          {open && running && <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> working</span>}
        </Collapsible.Trigger>
        <Collapsible.Content className="min-h-0 flex-1 overflow-y-auto p-2">
          {feed.length === 0 && <p className="p-2 text-xs text-neutral-500">Each step the agent takes shows up here: searches, Moss retrievals with timing, graph queries, leads held back, credits spent.</p>}
          <ol className="space-y-1.5">
            {feed.map((f) => {
              const Icon = ICON[f.kind] ?? Info;
              return (
                <li key={f.id} className="flex gap-2 rounded border border-neutral-200 bg-white p-2 text-xs">
                  <Icon size={13} className={`mt-0.5 shrink-0 ${COLOR[f.kind]}`} />
                  <div className="min-w-0">
                    <p className="break-words text-neutral-800">{f.text}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-400">
                      <span>{time(f.ts)}</span>
                      {f.ms !== undefined && <span className="rounded bg-neutral-100 px-1 font-mono text-neutral-700">{f.ms} ms</span>}
                      <ModeBadge mode={f.mode} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div ref={end} />
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}
