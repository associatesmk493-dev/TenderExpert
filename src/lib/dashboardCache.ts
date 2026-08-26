import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface DashAttendance {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
}

export interface DashUpcomingLead {
  id: string;
  customer_name: string;
  walkin_date?: string | null;
  follow_up_date?: string | null;
}

interface DashboardCacheData {
  counts: Record<string, number>;
  showrooms: { id: string; name: string }[];
  attendance: DashAttendance | null;
  walkins: DashUpcomingLead[];
  followups: DashUpcomingLead[];
}

interface CacheEntry {
  data: DashboardCacheData;
  ts: number;
  date: string; // invalidate on new day
}

let _cache: CacheEntry | null = null;
let _inflight: Promise<void> | null = null;
const TTL = 3 * 60 * 1000;

function fresh(): DashboardCacheData | null {
  if (!_cache) return null;
  const today = format(new Date(), 'yyyy-MM-dd');
  if (_cache.date !== today || Date.now() - _cache.ts > TTL) { _cache = null; return null; }
  // Invalidate if counts look empty (RPC previously failed)
  if (Object.keys(_cache.data.counts).length === 0 || (_cache.data.counts.total === 0 && _cache.data.counts.new_lead === undefined)) {
    _cache = null; return null;
  }
  return _cache.data;
}

async function doFetch(userId: string, isAdmin: boolean, showroom: string | null = null): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');

  const base = () => {
    let q = supabase.from('leads').select('*', { count: 'exact', head: true });
    if (!isAdmin) q = q.eq('assigned_to', userId);
    if (showroom) q = (q as any).eq('showroom_id', showroom);
    return q;
  };

  const stageCount = (stage: string) => base().eq('funnel_stage', stage);
  const tempCount  = (temp: string)  => base().eq('temperature', temp);

  const [
    totalRes, newLeadRes, leadRes, qualRes, needRes, proposalRes,
    negRes, wonRes, postSaleRes, lostRes, hotRes, warmRes, coldRes,
    walkinsRes, followupsRes, showroomsRes, attendanceRes,
  ] = await Promise.all([
    base(),
    stageCount('new_lead'),
    stageCount('lead_capture'),
    stageCount('qualification'),
    stageCount('need_analysis'),
    stageCount('proposal'),
    stageCount('negotiation'),
    stageCount('closure_order_1'),
    stageCount('post_sale'),
    stageCount('lost_rejected'),
    tempCount('hot'),
    tempCount('warm'),
    tempCount('cold'),
    (() => {
      let q = supabase.from('leads')
        .select('id, customer_name, walkin_date')
        .gte('walkin_date', today)
        .order('walkin_date')
        .limit(100);
      if (!isAdmin) q = q.eq('assigned_to', userId);
      return q;
    })(),
    (() => {
      let q = supabase.from('leads')
        .select('id, customer_name, follow_up_date')
        .gte('follow_up_date', today)
        .order('follow_up_date')
        .limit(100);
      if (!isAdmin) q = q.eq('assigned_to', userId);
      return q;
    })(),
    isAdmin
      ? supabase.from('showrooms').select('id, name')
      : Promise.resolve({ data: [] }),
    supabase.from('attendance_logs')
      .select('id, check_in_time, check_out_time')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),
  ]);

  const todayWalkins  = (walkinsRes.data ?? []).filter(l => l.walkin_date  === today).length;
  const todayFollowups = (followupsRes.data ?? []).filter(l => l.follow_up_date === today).length;

  _cache = {
    ts: Date.now(),
    date: today,
    data: {
      counts: {
        total:         totalRes.count    ?? 0,
        new_lead:      newLeadRes.count  ?? 0,
        lead:          leadRes.count     ?? 0,
        qualification: qualRes.count     ?? 0,
        need_analysis: needRes.count     ?? 0,
        proposal:      proposalRes.count ?? 0,
        negotiation:   negRes.count      ?? 0,
        won:           wonRes.count      ?? 0,
        activePipeline: postSaleRes.count ?? 0,
        lost:          lostRes.count     ?? 0,
        hot:           hotRes.count      ?? 0,
        warm:          warmRes.count     ?? 0,
        cold:          coldRes.count     ?? 0,
        today_walkins:  todayWalkins,
        today_followups: todayFollowups,
      },
      showrooms: (showroomsRes.data ?? []) as { id: string; name: string }[],
      attendance: (attendanceRes.data as DashAttendance | null) ?? null,
      walkins: (walkinsRes.data ?? []) as DashUpcomingLead[],
      followups: (followupsRes.data ?? []) as DashUpcomingLead[],
    },
  };
}

export const DashboardCache = {
  prefetch(userId: string, isAdmin: boolean, showroom: string | null = null): Promise<void> {
    if (fresh()) return Promise.resolve();
    if (_inflight) return _inflight;
    _inflight = doFetch(userId, isAdmin, showroom).finally(() => { _inflight = null; });
    return _inflight;
  },

  get: (): DashboardCacheData | null => fresh(),
  awaitPrefetch: (): Promise<void> | null => _inflight,

  // Call after check-in/out to keep cached attendance fresh
  updateAttendance(att: DashAttendance) {
    if (_cache) _cache.data.attendance = att;
  },

  clear() { _cache = null; _inflight = null; },
};
