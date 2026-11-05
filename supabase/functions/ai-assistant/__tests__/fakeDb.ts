// Tiny in-memory stand-in for a PostgREST client. It simulates what matters for these tests:
// per-user RLS (ai_* tables are owner-only, business rows are visible only inside the user's tenant),
// unique constraints (error code 23505) and the filter/order/range chain the tools use.
// deno-lint-ignore-file no-explicit-any

export type Rows = Record<string, any[]>;
export interface FakeWorld {
  tables: Rows;
  uniques: Record<string, string[]>;
  failTables: Set<string>;                       // simulate a database outage per table
  tenantOf: Record<string, string>;              // user -> tenant
}

export const newWorld = (tables: Rows = {}): FakeWorld => ({
  tables: { ai_conversations: [], ai_messages: [], ai_action_log: [], ai_usage_log: [], b2g_leads: [], b2g_tasks: [], b2g_proposals: [], b2g_activities: [], b2g_projects: [], b2g_payment_milestones: [], tender_opportunities: [], companies: [], integration_settings: [], proposal_templates: [], ...tables },
  uniques: {
    ai_action_log: ["user_id", "idempotency_key"], b2g_proposals: ["proposal_number"], ai_messages: ["conversation_id", "request_id", "role"],
  },
  failTables: new Set(), tenantOf: {},
});

let seq = 0;
const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
export const newId = uid;

export function clientFor(world: FakeWorld, userId: string) {
  const owned = new Set(["ai_conversations", "ai_messages", "ai_action_log", "ai_usage_log"]);
  const visible = (table: string, row: any) => {
    if (owned.has(table)) return row.user_id === userId;
    if (row.tenant && world.tenantOf[userId] && row.tenant !== world.tenantOf[userId]) return false;
    return true;
  };

  return {
    from(table: string) {
      type Op = (r: any) => boolean;
      const preds: Op[] = [];
      let mode: "select" | "insert" | "update" | "delete" = "select";
      let payload: any; let orderBy: [string, boolean] | null = null; let range: [number, number] | null = null;
      let head = false, wantCount = false, returning = false;
      const api: any = {
        select(_cols?: string, o?: any) { if (mode === "select") { wantCount = !!o?.count; head = !!o?.head; } else returning = true; return api; },
        insert(p: any) { mode = "insert"; payload = p; return api; },
        update(p: any) { mode = "update"; payload = p; return api; },
        delete() { mode = "delete"; return api; },
        eq(c: string, v: any) { if (!c.includes(".")) preds.push((r) => r[c] === v); return api; },
        neq(c: string, v: any) { if (!c.includes(".")) preds.push((r) => r[c] !== v); return api; },
        gt(c: string, v: any) { preds.push((r) => r[c] > v); return api; },
        gte(c: string, v: any) { preds.push((r) => r[c] >= v); return api; },
        lt(c: string, v: any) { preds.push((r) => r[c] < v); return api; },
        lte(c: string, v: any) { preds.push((r) => r[c] <= v); return api; },
        ilike(c: string, v: string) { const n = v.replace(/%/g, "").toLowerCase(); preds.push((r) => String(r[c] ?? "").toLowerCase().includes(n)); return api; },
        in(c: string, vs: any[]) { preds.push((r) => vs.includes(r[c])); return api; },
        is(c: string, v: any) { preds.push((r) => (v === null ? r[c] == null : r[c] === v)); return api; },
        not(c: string, _op: string, v: any) { preds.push((r) => (v === null ? r[c] != null : r[c] !== v)); return api; },
        or() { return api; },
        order(c: string, o?: any) { orderBy = [c, o?.ascending !== false]; return api; },
        range(a: number, b: number) { range = [a, b]; return api; },
        limit(n: number) { range = [0, n - 1]; return api; },
        maybeSingle() { return run(true, false); },
        single() { return run(true, true); },
        then(res: any, rej: any) { return run(false, false).then(res, rej); },
      };

      async function run(single: boolean, strict: boolean): Promise<any> {
        if (world.failTables.has(table)) return { data: null, error: { code: "08006", message: "simulated database outage" }, count: null };
        const store = world.tables[table] ?? (world.tables[table] = []);
        const match = (r: any) => visible(table, r) && preds.every((p) => p(r));
        const fin = (rows: any[], count: number | null = null) => {
          if (!single) return { data: rows, error: null, count };
          if (rows.length === 0) return strict ? { data: null, error: { code: "PGRST116", message: "no rows" } } : { data: null, error: null };
          return { data: rows[0], error: null, count };
        };
        if (mode === "insert") {
          const rows = (Array.isArray(payload) ? payload : [payload]).map((r: any) => ({ id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r }));
          for (const r of rows) {
            if (owned.has(table) && r.user_id !== userId) return { data: null, error: { code: "42501", message: "row-level security violation" } };
            const u = world.uniques[table];
            if (u && store.some((s) => u.every((k) => s[k] === r[k] && r[k] != null))) return { data: null, error: { code: "23505", message: "duplicate key value" } };
          }
          store.push(...rows);
          return returning || single ? fin(rows) : { data: null, error: null };
        }
        if (mode === "update") {
          const hit = store.filter(match);
          hit.forEach((r) => Object.assign(r, payload, { updated_at: new Date().toISOString() }));
          return returning || single ? fin(hit.map((r) => ({ ...r }))) : { data: null, error: null };
        }
        if (mode === "delete") {
          const hit = store.filter(match);
          world.tables[table] = store.filter((r) => !hit.includes(r));
          return returning || single ? fin(hit) : { data: null, error: null };
        }
        let rows = store.filter(match).map((r) => ({ ...r }));
        const total = rows.length;
        if (orderBy) { const [c, asc] = orderBy; rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
        if (range) rows = rows.slice(range[0], range[1] + 1);
        if (head) return { data: null, error: null, count: total };
        return fin(rows, wantCount ? total : null);
      }
      return api;
    },
  };
}
