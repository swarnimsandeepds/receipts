import { NextResponse } from "next/server";
import { getState } from "./store";
import { buildGraph } from "./graph";
import { llmConfigured } from "./llm";
import { mossConfigured } from "./moss";
import type { ClientState, Mode } from "./types";

const m = (b: boolean): Mode => (b ? "live" : "mock");

export function clientState(): ClientState {
  const s = getState();
  return {
    ...s,
    graph: buildGraph(s),
    integrations: {
      LLM: m(llmConfigured()), Tavily: m(!!process.env.TAVILY_API_KEY), Hunter: m(!!process.env.HUNTER_API_KEY),
      Moss: m(mossConfigured()), Flexprice: m(!!process.env.FLEXPRICE_API_KEY),
    },
  };
}

export const ok = (extra: Record<string, unknown> = {}, status = 200) => NextResponse.json({ state: clientState(), ...extra }, { status });
export const fail = (error: string, status = 400) => NextResponse.json({ state: clientState(), error }, { status });
