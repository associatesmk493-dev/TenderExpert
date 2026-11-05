// Tool execution: validation, idempotency, confirmation binding and audit logging.
// deno-lint-ignore-file no-explicit-any
import { canonicalJson, parseAndValidate, sha256Hex } from "./schema.ts";
import { TOOL_MAP, ToolError, type ToolContext, type ToolDef } from "./tools.ts";

export type ToolEvent = {
  tool: string;
  status: "succeeded" | "failed" | "confirmation_required" | "duplicate";
  summary: string;
  link?: { label: string; url: string };
  action_id?: string;
  confirmation?: { reason: string; summary: string };
  invalidates?: string[];            // UI data areas to refresh
};

export type RunOutcome = { output: string; event: ToolEvent };

export const CONFIRMATION_TTL_MS = 30 * 60 * 1000;
const MAX_ERR = 400;

type BaseCtx = Omit<ToolContext, "idempotencyKey" | "confirmed">;

const INVALIDATES: Record<string, string[]> = {
  create_proposal_draft: ["proposals", "leads"], mark_proposal_sent: ["proposals"], update_lead: ["leads"],
  create_task: ["tasks", "leads"], delete_record: ["tasks", "proposals", "leads"],
};

function capOutput(value: unknown, max: number): string {
  const s = JSON.stringify(value);
  if (s.length <= max) return s;
  return JSON.stringify({ truncated: true, note: "Result too large; narrow the query (filters, columns, limit).", preview: s.slice(0, max - 200) });
}

const fail = (tool: string, message: string): RunOutcome => ({
  output: JSON.stringify({ error: message.slice(0, MAX_ERR) }),
  event: { tool, status: "failed", summary: message.slice(0, 160) },
});

async function logUpdate(db: any, userId: string, id: string, patch: Record<string, unknown>) {
  await db.from("ai_action_log").update(patch).eq("id", id).eq("user_id", userId);
}

/** Execute handler for an already-claimed action row and persist the outcome. */
async function execute(tool: ToolDef, ctx: ToolContext, args: Record<string, any>, actionId: string, maxChars: number, timeoutMs: number): Promise<RunOutcome> {
  try {
    const result = await Promise.race([
      tool.handler(ctx, args),
      new Promise<never>((_, rej) => setTimeout(() => rej(new ToolError(`${tool.name} timed out`)), timeoutMs)),
    ]);
    if ("confirmation" in result) {
      await logUpdate(ctx.db, ctx.userId, actionId, {
        status: "pending_confirmation", requires_confirmation: true, confirmation_reason: result.confirmation.reason,
        expires_at: new Date(Date.parse(ctx.nowIso) + CONFIRMATION_TTL_MS).toISOString(),
        result: { summary: result.confirmation.summary },
      });
      return {
        output: JSON.stringify({ status: "confirmation_required", action_id: actionId, reason: result.confirmation.reason, summary: result.confirmation.summary,
          instruction: "NOT executed. Tell the user exactly what needs approval; the app shows Confirm/Cancel buttons. Do not claim it was done." }),
        event: { tool: tool.name, status: "confirmation_required", summary: result.confirmation.summary, action_id: actionId, confirmation: result.confirmation },
      };
    }
    await logUpdate(ctx.db, ctx.userId, actionId, {
      status: "succeeded", result: { summary: result.summary, data: JSON.parse(capOutput(result.data, 6000)) },
      target_table: result.target?.table ?? null, target_id: result.target?.id ?? null, error: null,
    });
    const dup = (result.data as any)?.duplicate_request === true;
    return {
      output: capOutput({ status: "succeeded", ...(dup ? { note: "Identical request already handled; nothing new created." } : {}), result: result.data }, maxChars),
      event: { tool: tool.name, status: dup ? "duplicate" : "succeeded", summary: result.summary, link: result.link, action_id: actionId, invalidates: INVALIDATES[tool.name] },
    };
  } catch (e: any) {
    const message = e instanceof ToolError ? e.message : "Unexpected error while running the tool.";
    if (!(e instanceof ToolError)) console.error("tool_error", tool.name, String(e?.message ?? e).slice(0, 300));
    await logUpdate(ctx.db, ctx.userId, actionId, { status: "failed", error: message.slice(0, MAX_ERR) });
    return fail(tool.name, message);
  }
}

export async function runTool(base: BaseCtx, name: string, rawArgs: unknown, opts: { maxResultChars: number; timeoutMs: number }): Promise<RunOutcome> {
  const tool = TOOL_MAP.get(name);
  if (!tool) return fail(name, `Unknown tool '${name}'. Available: ${[...TOOL_MAP.keys()].join(", ")}`);
  const v = parseAndValidate(rawArgs, tool.parameters);
  if (!v.ok) return fail(name, `Invalid arguments: ${v.errors.join("; ")}`);
  const args = v.value;

  if (tool.kind === "read") {
    const ctx: ToolContext = { ...base, idempotencyKey: "", confirmed: false };
    try {
      const result = await Promise.race([
        tool.handler(ctx, args),
        new Promise<never>((_, rej) => setTimeout(() => rej(new ToolError(`${name} timed out`)), opts.timeoutMs)),
      ]);
      if ("confirmation" in result) return fail(name, "Read tool unexpectedly requested confirmation.");
      return { output: capOutput(result.data, opts.maxResultChars), event: { tool: name, status: "succeeded", summary: result.summary, link: result.link } };
    } catch (e: any) {
      if (!(e instanceof ToolError)) console.error("tool_error", name, String(e?.message ?? e).slice(0, 300));
      return fail(name, e instanceof ToolError ? e.message : "Unexpected error while reading data.");
    }
  }

  // ---- write: claim an idempotent action row first ----
  const argsHash = await sha256Hex(canonicalJson(args));
  const idemKey = await sha256Hex(`${base.conversationId}|${base.requestId}|${name}|${argsHash}`);
  const ctx: ToolContext = { ...base, idempotencyKey: idemKey, confirmed: false };
  const ins = await base.db.from("ai_action_log").insert({
    user_id: base.userId, conversation_id: base.conversationId, tool: name, arguments: args, arguments_hash: argsHash,
    idempotency_key: idemKey, status: "started",
  }).select("id").single();
  let actionId: string;
  if (ins.error) {
    if (ins.error.code !== "23505") return fail(name, "Could not record the action; nothing was executed.");
    const { data: prior } = await base.db.from("ai_action_log").select("id,status,result,confirmation_reason,error,updated_at").eq("user_id", base.userId).eq("idempotency_key", idemKey).maybeSingle();
    if (!prior) return fail(name, "Could not load the earlier attempt.");
    if (prior.status === "succeeded") {
      return { output: JSON.stringify({ status: "succeeded", note: "Identical request already handled; nothing new created.", result: prior.result?.data ?? prior.result }),
        event: { tool: name, status: "duplicate", summary: prior.result?.summary ?? "Already completed", action_id: prior.id } };
    }
    if (prior.status === "pending_confirmation") {
      const summary = prior.result?.summary ?? "Awaiting confirmation";
      return { output: JSON.stringify({ status: "confirmation_required", action_id: prior.id, reason: prior.confirmation_reason, summary }),
        event: { tool: name, status: "confirmation_required", summary, action_id: prior.id, confirmation: { reason: prior.confirmation_reason ?? "", summary } } };
    }
    if (prior.status === "started" && Date.parse(base.nowIso) - Date.parse(prior.updated_at) < 120_000) {
      return fail(name, "This exact action is already running; do not retry it.");
    }
    if (prior.status === "cancelled" || prior.status === "confirmed" || prior.status === "expired") return fail(name, `This action was already ${prior.status}; ask the user before trying again.`);
    // failed (or stale 'started'): safe to retry under the same key
    await logUpdate(base.db, base.userId, prior.id, { status: "started", error: null });
    actionId = prior.id;
  } else actionId = ins.data.id;

  return execute(tool, ctx, args, actionId, opts.maxResultChars, opts.timeoutMs);
}

/** User pressed Confirm/Cancel on a stored action. Arguments come from the stored row, never from the client. */
export async function resolveConfirmation(base: BaseCtx, actionId: string, decision: "confirm" | "cancel", opts: { maxResultChars: number; timeoutMs: number }): Promise<RunOutcome> {
  const { data: row } = await base.db.from("ai_action_log").select("*").eq("id", actionId).eq("user_id", base.userId).maybeSingle();
  if (!row) return fail("confirmation", "Action not found.");
  if (row.status !== "pending_confirmation") return fail(row.tool, `This action is already ${row.status}.`);
  if (decision === "cancel") {
    await logUpdate(base.db, base.userId, actionId, { status: "cancelled" });
    return { output: "{}", event: { tool: row.tool, status: "failed", summary: "Cancelled by you; nothing was changed.", action_id: actionId } };
  }
  if (row.expires_at && Date.parse(row.expires_at) < Date.parse(base.nowIso)) {
    await logUpdate(base.db, base.userId, actionId, { status: "expired" });
    return fail(row.tool, "Confirmation expired; ask the assistant to prepare the action again.");
  }
  const tool = TOOL_MAP.get(row.tool);
  if (!tool) return fail(row.tool, "Tool no longer exists.");
  // Bind confirmation to the exact stored arguments.
  if ((await sha256Hex(canonicalJson(row.arguments))) !== row.arguments_hash) {
    await logUpdate(base.db, base.userId, actionId, { status: "failed", error: "arguments hash mismatch" });
    return fail(row.tool, "Stored action no longer matches what was approved; it was not executed.");
  }
  // Stored args had nulls stripped; restore them so the strict schema re-validates.
  const full = { ...Object.fromEntries(Object.keys(tool.parameters.properties ?? {}).map((k) => [k, null])), ...row.arguments };
  const v = parseAndValidate(full, tool.parameters);
  if (!v.ok) return fail(row.tool, `Stored arguments invalid: ${v.errors.join("; ")}`);
  // Claim: only one concurrent confirm can move pending -> confirmed.
  const claim = await base.db.from("ai_action_log").update({ status: "confirmed" }).eq("id", actionId).eq("user_id", base.userId).eq("status", "pending_confirmation").select("id").maybeSingle();
  if (!claim.data) return fail(row.tool, "This action was already handled.");
  const ctx: ToolContext = { ...base, conversationId: row.conversation_id ?? base.conversationId, idempotencyKey: row.idempotency_key, confirmed: true };
  // Handler re-reads the records through the caller's RLS, so permissions are re-validated now.
  return execute(tool, ctx, v.value, actionId, opts.maxResultChars, opts.timeoutMs);
}
