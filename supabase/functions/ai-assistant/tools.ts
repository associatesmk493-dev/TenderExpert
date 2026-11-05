// Tool registry for the assistant. Each tool = JSON schema (shown to the model) + server-side handler.
// The model only *requests* a call; runner.ts validates, authorises (RLS through the caller's own
// Supabase client), de-duplicates, enforces confirmations and executes. Add a tool by appending to TOOLS.
//
// deno-lint-ignore-file no-explicit-any
import { ENTITIES, ENTITY_NAMES, FILTER_OPS, catalogForModel } from "./catalog.ts";
import { calculateOption, discountNeedsConfirmation, median } from "./pricing.ts";
import { type JsonSchema, nullable, obj, str } from "./schema.ts";

export type Db = any; // user-scoped supabase-js client (never the service role)

export interface ToolContext {
  db: Db;
  userId: string;
  conversationId: string;
  requestId: string;
  idempotencyKey: string;     // stable per (conversation, request, tool, args); used to derive record numbers
  confirmed: boolean;         // true only when executing a user-confirmed stored action
  pageLeadId?: string;        // lead the user is looking at (a hint, verified through RLS like any id)
  nowIso: string;
}

export type ToolResult =
  | { data: unknown; summary: string; link?: { label: string; url: string }; target?: { table: string; id: string } }
  | { confirmation: { reason: string; summary: string } };

export interface ToolDef {
  name: string;
  description: string;
  parameters: JsonSchema;
  kind: "read" | "write";
  handler: (ctx: ToolContext, args: Record<string, any>) => Promise<ToolResult>;
}

export class ToolError extends Error {}

const MAX_TEXT = 400;
const MAX_ROWS = 25;
const AGG_ROW_CAP = 2000;
const uuid = (d: string) => str(d, { format: "uuid" });
const clip = (v: unknown) => (typeof v === "string" && v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…[truncated]` : v);
const clipRow = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, clip(v)]));
const safeTerm = (s: string) => s.replace(/[,()%*\\"'`;]/g, " ").trim().slice(0, 80);
const errMsg = (e: any) => String(e?.message ?? e ?? "unknown error").slice(0, 300);

async function must<T>(q: PromiseLike<{ data: T; error: any; count?: number | null }>, what: string) {
  const r = await q;
  if (r.error) throw new ToolError(`${what} failed: ${errMsg(r.error)}`);
  return r;
}

async function getLead(ctx: ToolContext, leadId: string | undefined, cols = "*") {
  const id = leadId ?? ctx.pageLeadId;
  if (!id) throw new ToolError("lead_id is required (no lead is open on the current page).");
  const { data } = await must(ctx.db.from("b2g_leads").select(cols).eq("id", id).maybeSingle(), "Lead lookup");
  if (!data) throw new ToolError("Lead not found or you do not have access to it.");
  return data as any;
}

// ---- shared filter handling ----
const filterSchema: JsonSchema = {
  type: "array", maxItems: 8,
  description: "Filters, ANDed. For op in use comma-separated values. is_null/not_null ignore value. Use '@me' as value for user-id columns (assigned_to, created_by, owner_id) to mean the current user. Dates: ISO strings.",
  items: obj({
    column: str("A column of the entity"),
    op: { type: "string", enum: [...FILTER_OPS] },
    value: nullable(str("Comparison value as text", { maxLength: 200 })),
  }),
};

function applyFilters(q: any, entityName: string, filters: any[] | undefined, search: string | undefined, userId: string) {
  const e = ENTITIES[entityName];
  for (const f of filters ?? []) {
    if (!e.columns.includes(f.column)) throw new ToolError(`Unknown column '${f.column}' for ${entityName}. Allowed: ${e.columns.join(", ")}`);
    const raw = f.value === null || f.value === undefined ? "" : String(f.value);
    const val = raw === "@me" ? userId : raw;
    switch (f.op) {
      case "eq": q = q.eq(f.column, val); break;
      case "neq": q = q.neq(f.column, val); break;
      case "gt": q = q.gt(f.column, val); break;
      case "gte": q = q.gte(f.column, val); break;
      case "lt": q = q.lt(f.column, val); break;
      case "lte": q = q.lte(f.column, val); break;
      case "contains": q = q.ilike(f.column, `%${safeTerm(val)}%`); break;
      case "in": q = q.in(f.column, val.split(",").map((s) => (s.trim() === "@me" ? userId : s.trim())).filter(Boolean).slice(0, 50)); break;
      case "is_null": q = q.is(f.column, null); break;
      case "not_null": q = q.not(f.column, "is", null); break;
      default: throw new ToolError(`Unsupported operator '${f.op}'`);
    }
  }
  const term = search ? safeTerm(search) : "";
  if (term) q = q.or(e.search.map((c) => `${c}.ilike.%${term}%`).join(","));
  return q;
}

const entityEnum = { type: "string", enum: ENTITY_NAMES, description: "Business entity" } as JsonSchema;

// ---- READ TOOLS ----
const search_business_data: ToolDef = {
  name: "search_business_data",
  kind: "read",
  description: `Search/list CRM records with filters, free-text search, sorting and pagination (max ${MAX_ROWS} rows per call; use offset to page). Only the entities below are available; each is already restricted to what the signed-in user may read.\n${catalogForModel()}`,
  parameters: obj({
    entity: entityEnum,
    search: nullable(str("Free text matched against the entity's name/title/notes columns", { maxLength: 100 })),
    filters: nullable(filterSchema),
    columns: nullable({ type: "array", items: str("column"), maxItems: 20, description: "Columns to return (default: a compact set)" }),
    sort_by: nullable(str("Column to sort by")),
    sort_dir: nullable({ type: "string", enum: ["asc", "desc"] }),
    limit: nullable({ type: "integer", minimum: 1, maximum: MAX_ROWS }),
    offset: nullable({ type: "integer", minimum: 0, maximum: 100000 }),
  }),
  async handler(ctx, a) {
    const e = ENTITIES[a.entity];
    const cols: string[] = a.columns?.length ? a.columns : e.columns.slice(0, 14);
    for (const c of cols) if (!e.columns.includes(c)) throw new ToolError(`Unknown column '${c}'. Allowed: ${e.columns.join(", ")}`);
    const sortBy = a.sort_by ?? e.defaultSort;
    if (!e.columns.includes(sortBy)) throw new ToolError(`Cannot sort by '${sortBy}'`);
    const limit = a.limit ?? 10, offset = a.offset ?? 0;
    let q = ctx.db.from(e.table).select(Array.from(new Set(["id", ...cols])).join(","), { count: "exact" });
    q = applyFilters(q, a.entity, a.filters, a.search, ctx.userId)
      .order(sortBy, { ascending: (a.sort_dir ?? "asc") === "asc", nullsFirst: false }).range(offset, offset + limit - 1);
    const { data, count } = await must(q, "Search");
    const rows = ((data as any[]) ?? []).map(clipRow);
    return {
      data: { entity: a.entity, total_matching: count ?? rows.length, returned: rows.length, offset, has_more: (count ?? 0) > offset + rows.length, rows,
        links: e.link ? rows.slice(0, 10).map((r) => ({ id: r.id, url: e.link!(String(r.id)) })) : undefined },
      summary: `Searched ${a.entity}: ${rows.length} of ${count ?? rows.length} rows`,
    };
  },
};

const get_record: ToolDef = {
  name: "get_record",
  kind: "read",
  description: "Fetch one record by id with all readable columns (long text is truncated).",
  parameters: obj({ entity: entityEnum, id: uuid("Record id") }),
  async handler(ctx, a) {
    const e = ENTITIES[a.entity];
    const { data } = await must(ctx.db.from(e.table).select(e.columns.join(",")).eq("id", a.id).maybeSingle(), "Record lookup");
    if (!data) throw new ToolError("Record not found or not accessible.");
    return { data: clipRow(data as any), summary: `Loaded ${a.entity} record`, link: e.link ? { label: a.entity, url: e.link(a.id) } : undefined };
  },
};

const aggregate_business_data: ToolDef = {
  name: "aggregate_business_data",
  kind: "read",
  description: `Count/sum/avg/min/max over an entity, optionally grouped (e.g. pipeline value by stage, overdue tasks per person). Computed server-side over at most ${AGG_ROW_CAP} matching rows; the result says if it was truncated.`,
  parameters: obj({
    entity: entityEnum,
    metric: { type: "string", enum: ["count", "sum", "avg", "min", "max"] },
    column: nullable(str("Numeric column (required for sum/avg/min/max)")),
    group_by: nullable(str("Column to group by")),
    filters: nullable(filterSchema),
    search: nullable(str("Free text filter", { maxLength: 100 })),
  }),
  async handler(ctx, a) {
    const e = ENTITIES[a.entity];
    if (a.metric !== "count") {
      if (!a.column || !e.numeric.includes(a.column)) throw new ToolError(`'column' must be one of: ${e.numeric.join(", ") || "(none, only count is available)"}`);
    }
    if (a.group_by && !e.groupable.includes(a.group_by)) throw new ToolError(`group_by must be one of: ${e.groupable.join(", ")}`);
    if (a.metric === "count" && !a.group_by) {
      const q = applyFilters(ctx.db.from(e.table).select("id", { count: "exact", head: true }), a.entity, a.filters, a.search, ctx.userId);
      const { count } = await must(q, "Aggregate");
      return { data: { entity: a.entity, metric: "count", value: count ?? 0 }, summary: `Counted ${a.entity}` };
    }
    const sel = Array.from(new Set(["id", a.group_by, a.column].filter(Boolean))).join(",");
    const q = applyFilters(ctx.db.from(e.table).select(sel, { count: "exact" }), a.entity, a.filters, a.search, ctx.userId).range(0, AGG_ROW_CAP - 1);
    const { data, count } = await must(q, "Aggregate");
    const rows = (data as any[]) ?? [];
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      const g = a.group_by ? String(r[a.group_by] ?? "(none)") : "all";
      const arr = groups.get(g) ?? []; arr.push(a.column ? Number(r[a.column]) : 1); groups.set(g, arr);
    }
    const calc = (xs: number[]) => {
      const n = xs.filter((x) => Number.isFinite(x));
      switch (a.metric) {
        case "count": return xs.length;
        case "sum": return Math.round(n.reduce((s, x) => s + x, 0) * 100) / 100;
        case "avg": return n.length ? Math.round((n.reduce((s, x) => s + x, 0) / n.length) * 100) / 100 : null;
        case "min": return n.length ? Math.min(...n) : null;
        default: return n.length ? Math.max(...n) : null;
      }
    };
    const out = [...groups.entries()].map(([group, xs]) => ({ group, rows: xs.length, value: calc(xs) })).sort((x, y) => (Number(y.value) || 0) - (Number(x.value) || 0)).slice(0, 50);
    return {
      data: { entity: a.entity, metric: a.metric, column: a.column ?? null, group_by: a.group_by ?? null, groups: out, rows_scanned: rows.length, truncated: (count ?? 0) > rows.length },
      summary: `Aggregated ${a.entity}`,
    };
  },
};

const get_lead_context: ToolDef = {
  name: "get_lead_context",
  kind: "read",
  description: "Everything known about one lead in a single call: the lead, its company, recent activity history, pending/overdue tasks, proposals, projects/payments, tenders, factual risk signals, and comparable past deals in the same industry. Use for summaries, overdue follow-ups, conversion obstacles and deal comparisons. If lead_id is null the lead open on the current page is used.",
  parameters: obj({ lead_id: nullable(uuid("Lead id")) }),
  async handler(ctx, a) {
    const lead = await getLead(ctx, a.lead_id);
    const id = lead.id as string;
    const now = Date.parse(ctx.nowIso);
    const [company, acts, pending, doneTasks, proposals, projects, tenders] = await Promise.all([
      lead.company_id ? ctx.db.from("companies").select(ENTITIES.companies.columns.join(",")).eq("id", lead.company_id).maybeSingle() : Promise.resolve({ data: null }),
      ctx.db.from("b2g_activities").select("activity_type,subject,description,outcome,created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(15),
      ctx.db.from("b2g_tasks").select("id,title,task_type,priority,due_at,responsible_person").eq("lead_id", id).is("completed_at", null).order("due_at").limit(25),
      ctx.db.from("b2g_tasks").select("title,task_type,due_at,completed_at").eq("lead_id", id).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(5),
      ctx.db.from("b2g_proposals").select("id,proposal_number,subject,status,subtotal,gst_amount,discount_amount,payment_model,valid_until,sent_at,accepted_at,version,created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
      ctx.db.from("b2g_projects").select("id,project_name,order_number,status,contract_value,estimated_cost,delivery_risk,delay_reason,payment_model").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
      ctx.db.from("tender_opportunities").select("id,tender_title,authority_name,estimated_value,submission_deadline,go_no_go,status").eq("lead_id", id).limit(5),
    ]);
    for (const r of [acts, pending, doneTasks, proposals, projects, tenders]) if ((r as any).error) throw new ToolError(`Lead context failed: ${errMsg((r as any).error)}`);
    const projectRows = (projects.data as any[]) ?? [];
    let milestones: any[] = [];
    if (projectRows.length) {
      const r = await ctx.db.from("b2g_payment_milestones").select("project_id,milestone_name,amount,gst_amount,amount_received,due_date,status")
        .in("project_id", projectRows.map((p) => p.id)).order("due_date").limit(30);
      milestones = r.data ?? [];
    }
    // Comparable deals: same-industry projects and lost-reason mix (facts, not predictions).
    let comparable: any = { industry: lead.industry, note: "Same-industry history from this CRM only." };
    if (lead.industry) {
      const [cp, lost] = await Promise.all([
        ctx.db.from("b2g_projects").select("project_name,contract_value,estimated_cost,payment_model,status,b2g_leads!inner(industry,organization_name)")
          .eq("b2g_leads.industry", lead.industry).neq("lead_id", id).neq("status", "cancelled").order("created_at", { ascending: false }).limit(20),
        ctx.db.from("b2g_leads").select("lost_reason_code").eq("industry", lead.industry).neq("id", id).not("lost_reason_code", "is", null).limit(100),
      ]);
      const deals = ((cp.data as any[]) ?? []);
      const lostCounts: Record<string, number> = {};
      for (const l of (lost.data as any[]) ?? []) lostCounts[l.lost_reason_code] = (lostCounts[l.lost_reason_code] ?? 0) + 1;
      comparable = {
        ...comparable,
        past_projects: deals.length,
        median_contract_value: median(deals.map((d) => Number(d.contract_value)).filter((n) => n > 0)),
        median_estimated_cost: median(deals.map((d) => Number(d.estimated_cost)).filter((n) => n > 0)),
        examples: deals.slice(0, 5).map((d) => ({ project: d.project_name, client: d.b2g_leads?.organization_name, contract_value: d.contract_value, estimated_cost: d.estimated_cost, status: d.status })),
        lost_reasons_same_industry: lostCounts,
      };
    }
    const pend = (pending.data as any[]) ?? [];
    const overdue = pend.filter((t) => Date.parse(t.due_at) < now);
    const lastAct = ((acts.data as any[]) ?? [])[0]?.created_at ?? lead.last_activity_at ?? lead.last_contacted_at;
    const daysSince = lastAct ? Math.floor((now - Date.parse(lastAct)) / 86400000) : null;
    const signals: string[] = [];
    if (lead.closed_at) signals.push("Lead is closed.");
    if (!lead.closed_at && !pend.some((t) => t.task_type === "follow_up") && !lead.next_follow_up_at) signals.push("No pending follow-up is scheduled.");
    if (lead.next_follow_up_at && Date.parse(lead.next_follow_up_at) < now) signals.push(`Follow-up date ${lead.next_follow_up_at} has passed.`);
    if (overdue.length) signals.push(`${overdue.length} overdue task(s); oldest due ${overdue[0].due_at}.`);
    if (daysSince !== null && daysSince > 14) signals.push(`No recorded activity for ${daysSince} days.`);
    if (lead.on_hold) signals.push(`On hold${lead.on_hold_reason ? `: ${lead.on_hold_reason}` : ""}.`);
    if (lead.objection) signals.push(`Recorded objection: ${clip(lead.objection)}`);
    if (lead.competitor) signals.push(`Competitor noted: ${lead.competitor}`);
    if (lead.decision_deadline) signals.push(`Decision deadline ${lead.decision_deadline}.`);
    if (Number(lead.sanctioned_budget) > 0 && Number(lead.proposal_value) > Number(lead.sanctioned_budget)) signals.push(`Proposal value ${lead.proposal_value} exceeds sanctioned budget ${lead.sanctioned_budget}.`);
    const props = (proposals.data as any[]) ?? [];
    if (!props.length && !lead.closed_at) signals.push("No proposal has been created for this lead.");
    const stale = props.find((p) => p.status === "sent" && p.sent_at && now - Date.parse(p.sent_at) > 7 * 86400000);
    if (stale) signals.push(`Proposal ${stale.proposal_number} was sent ${Math.floor((now - Date.parse(stale.sent_at)) / 86400000)} days ago with no response recorded.`);
    const outstanding = milestones.reduce((s, m) => s + Math.max(0, Number(m.amount) + Number(m.gst_amount) - Number(m.amount_received)), 0);
    if (outstanding > 0) signals.push(`Outstanding payment balance ${outstanding}.`);
    const leadOut = Object.fromEntries(Object.entries(lead).filter(([k]) => ENTITIES.leads.columns.includes(k)).map(([k, v]) => [k, clip(v)]));
    return {
      data: {
        now: ctx.nowIso, lead: leadOut, company: company.data ?? null,
        recent_activity: ((acts.data as any[]) ?? []).map(clipRow), pending_tasks: pend, overdue_task_count: overdue.length,
        recently_completed_tasks: doneTasks.data, proposals: props, projects: projectRows, payment_milestones: milestones,
        outstanding_balance: outstanding, tenders: tenders.data, days_since_last_activity: daysSince,
        risk_signals_from_records: signals, comparable_deals: comparable,
      },
      summary: `Loaded context for ${lead.organization_name}`,
      link: { label: lead.organization_name, url: `/leads/${id}` },
    };
  },
};

const optionSchema = obj({
  name: str("Option label, e.g. 'Standard' or 'Premium'", { maxLength: 60 }),
  list_price: { type: "number", minimum: 0, maximum: 1e10, description: "Price in INR before discount and GST" },
  discount_pct: nullable({ type: "number", minimum: 0, maximum: 100, description: "Discount percent. Only use a value the user stated; never invent one." }),
  cost: nullable({ type: "number", minimum: 0, maximum: 1e10, description: "Cost in INR excluding GST, only if known" }),
  gst_rate: nullable({ type: "number", minimum: 0, maximum: 100, description: "GST percent; omit to use the app default of 18%" }),
});

async function discountCeiling(ctx: ToolContext): Promise<number> {
  const { data } = await ctx.db.from("integration_settings").select("config").eq("provider", "openai").maybeSingle();
  const n = Number((data as any)?.config?.max_auto_discount_pct);
  return Number.isFinite(n) && n >= 0 ? n : 0; // no configured policy => every discount needs confirmation
}

const calculate_quote_options: ToolDef = {
  name: "calculate_quote_options",
  kind: "read",
  description: "Deterministically compute discount, taxable value, GST, total and margin for 1-4 pricing options, compared to the lead's sanctioned budget. The model must supply prices/costs/discounts only from the user or records; this tool never invents them. Also reports whether a discount would need confirmation under the configured policy.",
  parameters: obj({ lead_id: nullable(uuid("Lead id; null uses the open lead or none")), options: { type: "array", minItems: 1, maxItems: 4, items: optionSchema } }),
  async handler(ctx, a) {
    const lead = a.lead_id || ctx.pageLeadId ? await getLead(ctx, a.lead_id, "id,organization_name,sanctioned_budget,proposal_value,industry") : null;
    const ceiling = await discountCeiling(ctx);
    const budget = lead ? Number(lead.sanctioned_budget) : 0;
    const options = a.options.map((o: any) => ({
      ...calculateOption({ name: o.name, list_price: o.list_price, discount_pct: o.discount_pct ?? undefined, cost: o.cost ?? undefined, gst_rate: o.gst_rate ?? undefined }, budget || null),
    }));
    return {
      data: {
        lead: lead ? { id: lead.id, name: lead.organization_name, sanctioned_budget: budget || null, current_proposal_value: lead.proposal_value } : null,
        options,
        discount_policy: { max_auto_discount_pct: ceiling, configured: ceiling > 0, note: "Discounts above this need explicit user confirmation before a draft is saved. No other discount rules exist in the CRM." },
        needs_confirmation_if_saved: options.filter((o: any) => discountNeedsConfirmation(o.discount_pct, ceiling)).map((o: any) => o.name),
        assumptions: ["taxable_value = list_price - discount; GST applies to taxable_value", "margin = taxable_value - cost (cost excludes GST); not computed when cost is unknown"],
      },
      summary: `Calculated ${options.length} quote option(s)`,
    };
  },
};

// ---- WRITE TOOLS ----
const PAYMENT_MODELS = ["80_20", "70_30", "50_50", "milestone", "monthly_retainer", "success_fee"];

const create_proposal_draft: ToolDef = {
  name: "create_proposal_draft",
  kind: "write",
  description: "Save a DRAFT proposal for a lead (status 'draft'; never sent). Price maths is done by the server from list_price/discount/GST. Reuses a proposal template's terms when template_id is given. A discount above the configured automatic ceiling is not saved until the user confirms. Write personalised subject/scope text using only facts from the lead's records.",
  parameters: obj({
    lead_id: nullable(uuid("Lead id; null uses the open lead")),
    template_id: nullable(uuid("proposal template id (see entity 'templates')")),
    subject: str("Proposal subject line", { minLength: 3, maxLength: 200 }),
    scope: str("Scope / body text of the proposal", { minLength: 10, maxLength: 6000 }),
    commercial_terms: nullable(str("Commercial/payment terms; if null the template's terms are used", { maxLength: 3000 })),
    payment_model: { type: "string", enum: PAYMENT_MODELS },
    list_price: { type: "number", minimum: 0, maximum: 1e10, description: "INR before discount and GST" },
    discount_pct: nullable({ type: "number", minimum: 0, maximum: 100 }),
    gst_rate: nullable({ type: "number", minimum: 0, maximum: 100 }),
    valid_until: nullable(str("YYYY-MM-DD", { format: "date" })),
  }),
  async handler(ctx, a) {
    const lead = await getLead(ctx, a.lead_id, "id,organization_name");
    const calc = calculateOption({ name: "draft", list_price: a.list_price, discount_pct: a.discount_pct, gst_rate: a.gst_rate });
    if (!ctx.confirmed && discountNeedsConfirmation(a.discount_pct, await discountCeiling(ctx))) {
      return { confirmation: { reason: `Discount of ${a.discount_pct}% exceeds the automatic limit and needs your approval.`, summary: `Save draft proposal for ${lead.organization_name}: taxable ${calc.taxable_value}, GST ${calc.gst_amount}, total ${calc.total_with_gst} INR after ${a.discount_pct}% discount.` } };
    }
    let terms = a.commercial_terms as string | undefined;
    if (a.template_id) {
      const { data: t } = await ctx.db.from("proposal_templates").select("terms_template,is_active").eq("id", a.template_id).maybeSingle();
      if (!t || !(t as any).is_active) throw new ToolError("Template not found, inactive or not accessible.");
      terms = terms ?? (t as any).terms_template ?? undefined;
    }
    const number = `AI-${ctx.nowIso.slice(0, 4)}-${ctx.idempotencyKey.slice(0, 8).toUpperCase()}`;
    const row = {
      lead_id: lead.id, template_id: a.template_id ?? null, proposal_number: number, subject: a.subject, scope: a.scope,
      commercial_terms: terms ?? null, payment_model: a.payment_model, subtotal: calc.taxable_value, gst_rate: calc.gst_rate,
      discount_amount: calc.discount_amount, status: "draft", valid_until: a.valid_until ?? null, created_by: ctx.userId,
    };
    const ins = await ctx.db.from("b2g_proposals").insert(row).select("id,proposal_number,subtotal,gst_amount,status").single();
    let rec = ins.data as any; let duplicate = false;
    if (ins.error) {
      if (ins.error.code !== "23505") throw new ToolError(`Saving proposal failed: ${errMsg(ins.error)}`);
      const { data } = await must(ctx.db.from("b2g_proposals").select("id,proposal_number,subtotal,gst_amount,status").eq("proposal_number", number).maybeSingle(), "Proposal lookup");
      if (!data) throw new ToolError("Duplicate proposal number but the record is not visible.");
      rec = data; duplicate = true;
    } else {
      await ctx.db.from("b2g_activities").insert({ lead_id: lead.id, activity_type: "proposal", subject: `Draft proposal ${number} created by AI assistant`, description: `Taxable ${calc.taxable_value}, GST ${calc.gst_amount}, total ${calc.total_with_gst} INR`, created_by: ctx.userId });
    }
    return {
      data: { proposal: rec, pricing: calc, duplicate_request: duplicate, status: "draft", not_sent: true },
      summary: `Draft proposal ${rec.proposal_number} saved for ${lead.organization_name}`,
      link: { label: `Proposal ${rec.proposal_number}`, url: "/proposals" }, target: { table: "b2g_proposals", id: rec.id },
    };
  },
};

const LEAD_FIELD_PROPS: Record<string, JsonSchema> = {
  heat: nullable({ type: "string", enum: ["hot", "warm", "cold"] }),
  probability: nullable({ type: "integer", minimum: 0, maximum: 100, description: "Only a value the user states" }),
  proposal_value: nullable({ type: "number", minimum: 0, maximum: 1e10 }),
  expected_revenue: nullable({ type: "number", minimum: 0, maximum: 1e10 }),
  expected_close_date: nullable(str("YYYY-MM-DD", { format: "date" })),
  next_follow_up_at: nullable(str("ISO date-time", { format: "date-time" })),
  next_best_action: nullable(str("Short next action", { maxLength: 300 })),
  notes_append: nullable(str("Text appended to the lead's notes (existing notes are preserved)", { maxLength: 2000 })),
  objection: nullable(str("Customer objection", { maxLength: 500 })),
  on_hold: nullable({ type: "boolean" }),
  on_hold_reason: nullable(str("Reason the lead is on hold", { maxLength: 300 })),
};

const update_lead: ToolDef = {
  name: "update_lead",
  kind: "write",
  description: "Update permitted fields on a lead: heat, probability, proposal_value, expected_revenue, expected_close_date, next_follow_up_at, next_best_action, notes_append, objection, on_hold, on_hold_reason. Set only fields the user asked to change. Stage changes, closing, reassignment and deletion are NOT supported by this tool.",
  parameters: obj({ lead_id: nullable(uuid("Lead id; null uses the open lead")), fields: obj(LEAD_FIELD_PROPS) }),
  async handler(ctx, a) {
    const lead = await getLead(ctx, a.lead_id);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(a.fields ?? {})) {
      if (v === null || v === undefined) continue;
      if (!(k in LEAD_FIELD_PROPS)) throw new ToolError(`Field '${k}' cannot be updated.`);
      if (k === "notes_append") patch.notes = `${lead.notes ? `${lead.notes}\n` : ""}[${ctx.nowIso.slice(0, 10)} AI assistant] ${v}`;
      else patch[k] = v;
    }
    if (!Object.keys(patch).length) throw new ToolError("No fields to update.");
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, k === "notes" ? "(notes)" : lead[k]]));
    const { data } = await must(ctx.db.from("b2g_leads").update(patch).eq("id", lead.id).select("id").maybeSingle(), "Lead update");
    if (!data) throw new ToolError("Lead was not updated (not found or no permission).");
    const after = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, k === "notes" ? "(notes appended)" : v]));
    await ctx.db.from("b2g_activities").insert({ lead_id: lead.id, activity_type: "note", subject: "Lead updated by AI assistant", description: JSON.stringify({ before, after }).slice(0, 1500), created_by: ctx.userId });
    return { data: { updated: after, previous: before }, summary: `Updated ${Object.keys(patch).length} field(s) on ${lead.organization_name}`, link: { label: lead.organization_name, url: `/leads/${lead.id}` }, target: { table: "b2g_leads", id: lead.id } };
  },
};

async function syncNextFollowUp(ctx: ToolContext, leadId: string) {
  // Same rule as src/lib/followUps.ts: lead.next_follow_up_at = nearest pending follow_up task.
  const { data } = await ctx.db.from("b2g_tasks").select("due_at").eq("lead_id", leadId).eq("task_type", "follow_up").is("completed_at", null).order("due_at").limit(1);
  const next = (data as any[])?.[0]?.due_at ?? null;
  if (next) await ctx.db.from("b2g_leads").update({ next_follow_up_at: next }).eq("id", leadId);
}

const create_task: ToolDef = {
  name: "create_task",
  kind: "write",
  description: "Create a follow-up task (assigned to the current user). Use for follow-up calls, emails, meetings, documents. due_at must be a concrete future ISO date-time; ask the user if the time is unclear.",
  parameters: obj({
    lead_id: nullable(uuid("Lead id; null uses the open lead, or none for an internal task")),
    title: str("Task title", { minLength: 3, maxLength: 200 }),
    description: nullable(str("Details", { maxLength: 1500 })),
    task_type: { type: "string", enum: ["follow_up", "call", "meeting", "email", "whatsapp", "document", "payment", "tender", "other"] },
    priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
    due_at: str("ISO date-time (India time = +05:30)", { format: "date-time" }),
  }),
  async handler(ctx, a) {
    const leadId = a.lead_id ?? ctx.pageLeadId;
    const lead = leadId ? await getLead(ctx, leadId, "id,organization_name") : null;
    if (Date.parse(a.due_at) < Date.parse(ctx.nowIso) - 60_000) throw new ToolError("due_at is in the past; ask the user for a future date/time.");
    // Business-level duplicate guard on top of the action-log idempotency.
    let dup = ctx.db.from("b2g_tasks").select("id,title,due_at").eq("title", a.title).eq("due_at", new Date(a.due_at).toISOString()).is("completed_at", null).limit(1);
    dup = lead ? dup.eq("lead_id", lead.id) : dup.is("lead_id", null);
    const existing = ((await must(dup, "Duplicate check")).data as any[])?.[0];
    if (existing) return { data: { task: existing, duplicate_request: true }, summary: "An identical pending task already exists", link: { label: "Tasks", url: "/tasks" }, target: { table: "b2g_tasks", id: existing.id } };
    const { data } = await must(ctx.db.from("b2g_tasks").insert({
      lead_id: lead?.id ?? null, title: a.title, description: a.description ?? null, task_type: a.task_type, priority: a.priority,
      due_at: new Date(a.due_at).toISOString(), assigned_to: ctx.userId, created_by: ctx.userId,
    }).select("id,title,due_at,priority,task_type").single(), "Task creation");
    if (lead && a.task_type === "follow_up") await syncNextFollowUp(ctx, lead.id);
    return { data: { task: data }, summary: `Task "${a.title}" created`, link: lead ? { label: lead.organization_name, url: `/leads/${lead.id}` } : { label: "Tasks", url: "/tasks" }, target: { table: "b2g_tasks", id: (data as any).id } };
  },
};

const mark_proposal_sent: ToolDef = {
  name: "mark_proposal_sent",
  kind: "write",
  description: "Mark a DRAFT proposal as sent in the CRM (status 'sent'). ALWAYS requires user confirmation. This does NOT email or message the client: the assistant has no email/WhatsApp sending capability, so the user must send it themselves (e.g. via the Proposals page).",
  parameters: obj({ proposal_id: uuid("Proposal id") }),
  async handler(ctx, a) {
    const { data: p } = await must(ctx.db.from("b2g_proposals").select("id,proposal_number,status,lead_id").eq("id", a.proposal_id).maybeSingle(), "Proposal lookup");
    if (!p) throw new ToolError("Proposal not found or not accessible.");
    if ((p as any).status !== "draft") throw new ToolError(`Only draft proposals can be marked sent (this one is '${(p as any).status}').`);
    if (!ctx.confirmed) return { confirmation: { reason: "Marking a proposal as sent is an external-facing change.", summary: `Mark proposal ${(p as any).proposal_number} as sent (the client is NOT emailed by the assistant).` } };
    const { data } = await must(ctx.db.from("b2g_proposals").update({ status: "sent", sent_at: ctx.nowIso }).eq("id", a.proposal_id).eq("status", "draft").select("id").maybeSingle(), "Proposal update");
    if (!data) throw new ToolError("Proposal changed since it was loaded; nothing updated.");
    return { data: { proposal_number: (p as any).proposal_number, status: "sent", client_notified: false }, summary: `Proposal ${(p as any).proposal_number} marked as sent (client not notified)`, link: { label: "Proposals", url: "/proposals" }, target: { table: "b2g_proposals", id: a.proposal_id } };
  },
};

const delete_record: ToolDef = {
  name: "delete_record",
  kind: "write",
  description: "Delete a task or a DRAFT proposal. ALWAYS requires user confirmation. Other records cannot be deleted by the assistant.",
  parameters: obj({ kind: { type: "string", enum: ["task", "draft_proposal"] }, id: uuid("Record id") }),
  async handler(ctx, a) {
    const table = a.kind === "task" ? "b2g_tasks" : "b2g_proposals";
    const { data: rec } = await must(ctx.db.from(table).select(a.kind === "task" ? "id,title,lead_id,task_type" : "id,proposal_number,status").eq("id", a.id).maybeSingle(), "Record lookup");
    if (!rec) throw new ToolError("Record not found or not accessible.");
    if (a.kind === "draft_proposal" && (rec as any).status !== "draft") throw new ToolError("Only draft proposals can be deleted.");
    const label = a.kind === "task" ? (rec as any).title : (rec as any).proposal_number;
    if (!ctx.confirmed) return { confirmation: { reason: "Deleting a record cannot be undone.", summary: `Delete ${a.kind.replace("_", " ")} "${label}"` } };
    let q = ctx.db.from(table).delete().eq("id", a.id);
    if (a.kind === "draft_proposal") q = q.eq("status", "draft");
    const { data } = await must(q.select("id").maybeSingle(), "Delete");
    if (!data) throw new ToolError("Nothing was deleted (changed meanwhile or no permission).");
    if (a.kind === "task" && (rec as any).lead_id && (rec as any).task_type === "follow_up") await syncNextFollowUp(ctx, (rec as any).lead_id);
    return { data: { deleted: label }, summary: `Deleted ${label}`, target: { table, id: a.id } };
  },
};

export const TOOLS: ToolDef[] = [
  search_business_data, get_record, aggregate_business_data, get_lead_context,
  calculate_quote_options, create_proposal_draft, update_lead, create_task, mark_proposal_sent, delete_record,
];
export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));
