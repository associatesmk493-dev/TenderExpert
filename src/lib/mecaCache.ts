import { supabase } from '@/integrations/supabase/client';
import { fetchAll } from '@/lib/fetchAll';

export interface DashLead {
  id: string;
  assigned_to: string | null;
  funnel_stage: string;
  walkin_date: string | null;
  booking_date: string | null;
  finance_updated_at: string | null;
  created_at: string;
  updated_at: string;
  quoted_amount: number | null;
  closed_amount: number | null;
  margin_percent: number | null;
  advance_amount: number | null;
  before_delivery_amount: number | null;
  after_delivery_amount: number | null;
}

export interface DashActivity {
  lead_id: string;
  activity_type: string;
  description: string | null;
  created_at: string;
}

// A "repeat / multi-branch" order tracked separately from the parent lead's
// own single closed_amount — see lead_orders table.
export interface DashOrder {
  id: string;
  lead_id: string;
  quoted_amount: number | null;
  closed_amount: number | null;
  advance_amount: number | null;
  before_delivery_amount: number | null;
  after_delivery_amount: number | null;
  created_at: string;
  updated_at: string;
}

// Lightweight, ALWAYS-complete id → assigned_to map (fetched via fetchAll, no
// 1000-row cap). dashLeads is capped to the newest 1000 for a fast first
// render — using it to resolve "who owns this lead" would silently drop
// activities/orders for older leads still loading in the background.
export interface LeadOwner {
  id: string;
  assigned_to: string | null;
}

interface MecaCacheData {
  dashLeads: DashLead[];
  dashActivities: DashActivity[];
  dashOrders: DashOrder[];
  leadOwners: LeadOwner[];
  platforms: { id: string; name: string }[];
  platformMembers: { user_id: string; platform_id: string }[];
}

interface CacheEntry {
  data: MecaCacheData;
  ts: number;
}

let _cache: CacheEntry | null = null;
// Resolves when the first page of data is ready (fast path for SalesDashboard)
let _phase1: Promise<void> | null = null;
// Resolves when ALL data is loaded
let _phase2: Promise<void> | null = null;
let _listeners: Array<() => void> = [];

const TTL = 5 * 60 * 1000;
const PAGE = 1000;

const LEADS_SELECT =
  'id, assigned_to, funnel_stage, walkin_date, booking_date, finance_updated_at, created_at, updated_at, quoted_amount, closed_amount, margin_percent, advance_amount, before_delivery_amount, after_delivery_amount';

const ORDERS_SELECT =
  'id, lead_id, quoted_amount, closed_amount, advance_amount, before_delivery_amount, after_delivery_amount, created_at, updated_at';

const ACTIVITY_FILTER =
  'description.ilike.%Walk-in Scheduled%,description.eq.Stage → need_analysis,description.ilike.%lost_rejected%,' +
  'description.eq.Stage → closure_order_1,description.eq.Stage → delivered,description.eq.Stage → post_sale,' +
  'description.ilike.%amount updated%';

function fresh(): MecaCacheData | null {
  if (!_cache) return null;
  if (Date.now() - _cache.ts > TTL) { _cache = null; return null; }
  return _cache.data;
}

function notify() {
  _listeners.forEach((fn) => fn());
}

async function doFetch(userId: string, isAdmin: boolean): Promise<void> {
  // ── Phase 1: first 1000 leads + activities + meta — all in parallel (~1s) ──
  let leadsQ = supabase
    .from('leads')
    .select(LEADS_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, PAGE - 1);
  if (!isAdmin) leadsQ = (leadsQ as any).eq('assigned_to', userId);

  const [leadsRes, dashActivities, dashOrders, leadOwners, platformsRes, pmRes] = await Promise.all([
    leadsQ as any,
    // No activity_type filter — payment-field edits from the Orders page log as
    // 'order_update' (not 'update'), and must be included for close-date resolution.
    fetchAll<DashActivity>(() =>
      supabase
        .from('lead_activities')
        .select('lead_id, activity_type, description, created_at')
        .or(ACTIVITY_FILTER)
    ),
    // RLS already scopes this to the team member's own leads' orders (or all, for admins)
    fetchAll<DashOrder>(() => supabase.from('lead_orders' as any).select(ORDERS_SELECT)),
    fetchAll<LeadOwner>(() => {
      let q = supabase.from('leads').select('id, assigned_to');
      if (!isAdmin) q = (q as any).eq('assigned_to', userId);
      return q as any;
    }),
    supabase.from('platforms' as any).select('*'),
    supabase.from('platform_members' as any).select('user_id, platform_id'),
  ]);

  const firstLeads: DashLead[] = leadsRes.data ?? [];
  const totalCount: number = leadsRes.count ?? firstLeads.length;

  _cache = {
    ts: Date.now(),
    data: {
      dashLeads: firstLeads,
      dashActivities,
      dashOrders,
      leadOwners,
      platforms: (platformsRes.data ?? []) as { id: string; name: string }[],
      platformMembers: (pmRes.data ?? []) as { user_id: string; platform_id: string }[],
    },
  };
  notify(); // ← SalesDashboard renders immediately with first 1000 leads

  // ── Phase 2: remaining pages in background — UI is already visible ──────────
  if (firstLeads.length < PAGE || totalCount <= PAGE) return;

  const accumulated: DashLead[] = [...firstLeads];
  let from = PAGE;
  while (from < totalCount) {
    let q = supabase
      .from('leads')
      .select(LEADS_SELECT)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (!isAdmin) q = (q as any).eq('assigned_to', userId);
    const { data } = await (q as any);
    if (!data || data.length === 0) break;
    accumulated.push(...(data as DashLead[]));
    from += PAGE;

    // Update cache + notify after each page so metrics update incrementally
    if (_cache) {
      _cache.data.dashLeads = accumulated;
      notify();
    }
  }
}

export const MecaCache = {
  prefetch(userId: string, isAdmin: boolean): Promise<void> {
    if (fresh()) return Promise.resolve();
    if (_phase1) return _phase1; // reuse in-flight — no duplicate request

    let resolvePhase1!: () => void;
    _phase1 = new Promise<void>((res) => { resolvePhase1 = res; });

    _phase2 = doFetch(userId, isAdmin)
      .then(() => { resolvePhase1(); })
      .catch(() => { resolvePhase1(); })
      .finally(() => { _phase1 = null; _phase2 = null; });

    // Phase 1 resolves as soon as first notify() fires (cache populated)
    const origNotify = notify;
    let phase1Done = false;
    _listeners.push(() => {
      if (!phase1Done) { phase1Done = true; resolvePhase1(); }
    });

    return _phase1;
  },

  awaitPrefetch(): Promise<void> | null { return _phase1; },

  // Subscribe to cache updates (called on every new page of data)
  onUpdate(fn: () => void): () => void {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter((f) => f !== fn); };
  },

  getDashLeads: (): DashLead[] | null => fresh()?.dashLeads ?? null,
  getDashActivities: (): DashActivity[] | null => fresh()?.dashActivities ?? null,
  getDashOrders: (): DashOrder[] | null => fresh()?.dashOrders ?? null,
  getLeadOwners: (): LeadOwner[] | null => fresh()?.leadOwners ?? null,
  getPlatforms: (): { id: string; name: string }[] | null => fresh()?.platforms ?? null,
  getPlatformMembers: (): { user_id: string; platform_id: string }[] | null => fresh()?.platformMembers ?? null,

  clear() { _cache = null; _phase1 = null; _phase2 = null; _listeners = []; },
};
