// OpenAI Responses API tool loop. Pure (fetch and tool execution are injected) so it can be tested with mocks.
// deno-lint-ignore-file no-explicit-any
import type { RunOutcome, ToolEvent } from "./runner.ts";
import { toOpenAiSchema } from "./schema.ts";
import type { ToolDef } from "./tools.ts";

export class OpenAIError extends Error {
  constructor(message: string, public status: number, public retryable = false) { super(message); }
}

export interface LoopOptions {
  apiKey: string;
  model: string;
  instructions: string;
  input: any[];
  tools: ToolDef[];
  maxRounds: number;          // model calls that may request tools
  maxToolCalls: number;       // total tool executions per request
  requestTimeoutMs: number;
  maxOutputTokens: number;
  includeEncryptedReasoning: boolean;
  fetchImpl?: typeof fetch;
  execTool: (name: string, args: unknown, callId: string) => Promise<RunOutcome>;
  baseUrl?: string;
}

export interface LoopResult {
  text: string;
  events: ToolEvent[];
  rounds: number;
  toolCalls: number;
  usage: { input_tokens: number; output_tokens: number };
  limitReached: boolean;
  model: string;
}

const toolDefs = (tools: ToolDef[]) => tools.map((t) => ({
  type: "function", name: t.name, description: t.description, parameters: toOpenAiSchema(t.parameters), strict: true,
}));

async function callOpenAI(o: LoopOptions, input: any[], allowTools: boolean): Promise<any> {
  const f = o.fetchImpl ?? fetch;
  const body: Record<string, unknown> = {
    model: o.model, instructions: o.instructions, input, store: false, max_output_tokens: o.maxOutputTokens,
    tools: toolDefs(o.tools), tool_choice: allowTools ? "auto" : "none",
  };
  if (o.includeEncryptedReasoning) body.include = ["reasoning.encrypted_content"];
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.requestTimeoutMs);
    try {
      const res = await f(`${o.baseUrl ?? "https://api.openai.com"}/v1/responses`, {
        method: "POST", signal: ctrl.signal,
        headers: { Authorization: `Bearer ${o.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = String(err?.error?.message ?? `OpenAI error ${res.status}`).slice(0, 300);
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }
        throw new OpenAIError(msg, res.status, retryable);
      }
      return await res.json();
    } catch (e: any) {
      if (e instanceof OpenAIError) throw e;
      if (attempt === 0) { await new Promise((r) => setTimeout(r, 500)); continue; }
      throw new OpenAIError(e?.name === "AbortError" ? "The AI provider timed out." : "Could not reach the AI provider.", 504, true);
    } finally { clearTimeout(timer); }
  }
  throw new OpenAIError("AI provider unavailable.", 502, true);
}

const textOf = (output: any[]): string =>
  output.filter((i) => i.type === "message").flatMap((i) => i.content ?? [])
    .map((c: any) => (c.type === "output_text" ? c.text : c.type === "refusal" ? c.refusal : "")).join("").trim();

export async function runToolLoop(o: LoopOptions): Promise<LoopResult> {
  const input = [...o.input];
  const events: ToolEvent[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let toolCalls = 0, rounds = 0, limitReached = false, model = o.model;

  while (true) {
    const allowTools = rounds < o.maxRounds;
    const resp = await callOpenAI(o, input, allowTools);
    model = resp.model ?? model;
    usage.input_tokens += resp.usage?.input_tokens ?? 0;
    usage.output_tokens += resp.usage?.output_tokens ?? 0;
    const output: any[] = Array.isArray(resp.output) ? resp.output : [];
    const calls = output.filter((i) => i.type === "function_call");

    if (!calls.length || !allowTools) {
      let text = textOf(output);
      if (calls.length && !allowTools) limitReached = true;
      if (!text) text = limitReached
        ? "I reached my step limit before finishing. Please narrow the request and try again."
        : resp.status === "incomplete" ? "The answer was cut off. Please ask again with a narrower question." : "I could not produce an answer. Please try again.";
      return { text, events, rounds, toolCalls, usage, limitReached, model };
    }

    rounds++;
    input.push(...output); // preserve reasoning + function_call items exactly as returned
    for (const call of calls) {
      let outcome: RunOutcome;
      if (toolCalls >= o.maxToolCalls) {
        limitReached = true;
        outcome = { output: JSON.stringify({ error: "Tool call limit reached for this request. Answer with what you have." }), event: { tool: call.name, status: "failed", summary: "Tool call limit reached" } };
      } else {
        toolCalls++;
        outcome = await o.execTool(call.name, call.arguments, call.call_id);
      }
      events.push(outcome.event);
      input.push({ type: "function_call_output", call_id: call.call_id, output: outcome.output });
    }
  }
}
