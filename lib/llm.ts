// One helper: ask an LLM for JSON, validate with zod, fall back to a mock on any failure.
import type { ZodType } from "zod";
import type { Mode } from "./types";

export const llmConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
// True only after an LLM call has actually succeeded, so the header never claims "live" on a bad key.
const flag = globalThis as unknown as { __llmOk?: boolean };
export const llmWorking = () => llmConfigured() && !!flag.__llmOk;

function extractJson(text: string): unknown {
  const start = text.search(/[\[{]/);
  if (start < 0) throw new Error("no JSON in LLM output");
  const open = text[start];
  const end = text.lastIndexOf(open === "{" ? "}" : "]");
  return JSON.parse(text.slice(start, end + 1));
}

async function callLlm(system: string, prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
    const res = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-sonnet-5-5",
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
  const res = await client.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content ?? "";
}

export async function llmJson<T>(opts: { schema: ZodType<T>; system: string; prompt: string; mock: () => T }): Promise<{ data: T; mode: Mode; error?: string }> {
  if (!llmConfigured()) return { data: opts.mock(), mode: "mock" };
  try {
    const text = await callLlm(opts.system + "\nReturn only one valid JSON object. No prose, no markdown fences.", opts.prompt);
    const data = opts.schema.parse(extractJson(text));
    flag.__llmOk = true;
    return { data, mode: "live" };
  } catch (e) {
    flag.__llmOk = false;
    return { data: opts.mock(), mode: "mock", error: e instanceof Error ? e.message.slice(0, 200) : "LLM call failed" };
  }
}
