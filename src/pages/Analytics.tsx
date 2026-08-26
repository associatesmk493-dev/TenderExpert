import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchAll } from '@/lib/fetchAll';
import { MecaCache } from '@/lib/mecaCache';
import { LeadsCache } from '@/lib/leadsCache';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { Lead, Profile, Showroom, FunnelStage } from '@/types/crm';
import { FUNNEL_STAGES } from '@/types/crm';
import { SOURCE_PORTALS, BUSINESS_TYPES, REGIONS, LEAD_TYPES } from '@/types/crm';
import { BarChart3, Building2, Target, CalendarIcon, X, MapPin, ListOrdered, Users2, UserCircle, Tag } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import SalesDashboard from '@/components/SalesDashboard';
import SalesSummary from '@/components/SalesSummary';
import SalesPersonSummary from '@/components/SalesPersonSummary';

// ── Wrapping X-axis tick (splits label words onto separate lines) ─────────────
function WrapAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = (payload?.value ?? '').split(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10} fontWeight={600}>
        {words.map((w, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 12 : 13}>{w}</tspan>
        ))}
      </text>
    </g>
  );
}

// ── 3D bar shape ─────────────────────────────────────────────────────────────
interface Bar3DProps {
  x?: number; y?: number; width?: number; height?: number;
  fill?: string; value?: number;
}
function Bar3D({ x = 0, y = 0, width = 0, height = 0, fill = '#888', value = 0 }: Bar3DProps) {
  if (height <= 0 || width <= 0) return null;
  const d = Math.min(width * 0.18, 6);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      <polygon points={`${x},${y} ${x+d},${y-d} ${x+width+d},${y-d} ${x+width},${y}`}
        fill="rgba(255,255,255,0.36)" />
      <polygon points={`${x+width},${y} ${x+width+d},${y-d} ${x+width+d},${y+height-d} ${x+width},${y+height}`}
        fill="rgba(0,0,0,0.22)" />
      {height >= 22 ? (
        <text x={x+width/2} y={y+height/2} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={10} fontWeight="bold" style={{ pointerEvents:'none' }}>
          {value}
        </text>
      ) : height > 0 ? (
        <text x={x+width/2} y={y-d-3} textAnchor="middle" dominantBaseline="auto"
          fill="hsl(var(--foreground))" fontSize={10} fontWeight="bold" style={{ pointerEvents:'none' }}>
          {value}
        </text>
      ) : null}
    </g>
  );
}

type StageCounts = Record<FunnelStage, number>;

interface TeamMemberStats {
  userId: string;
  name: string;
  total: number;
  stages: StageCounts;
  won: number;
  hot: number;
  warm: number;
  cold: number;
  platforms: string[];
}

interface ShowroomStats {
  id: string;
  name: string;
  total: number;
  stages: StageCounts;
  won: number;
}

const emptyStages = (): StageCounts =>
  FUNNEL_STAGES.reduce((acc, s) => ({ ...acc, [s.value]: 0 }), {} as StageCounts);

const countStages = (rows: Lead[]): StageCounts => {
  const out = emptyStages();
  rows.forEach((l) => { out[l.funnel_stage] = (out[l.funnel_stage] ?? 0) + 1; });
  return out;
};

const wonCount = (s: StageCounts) => s.closure_order_1 + s.post_sale;

// Aggregated stats returned by the server-side RPC — no row transfer
interface AnalyticsAgg {
  total: number;
  funnel:        Record<string, number>;
  source:        Record<string, number>;
  business_type: Record<string, number>;
  region:        Record<string, number>;
  lead_type:     Record<string, number>;
  team: {
    assigned_to: string; total: number; won: number;
    hot: number; warm: number; cold: number;
    total_sales: number; total_quoted: number;
    closed_count: number; meetings_count: number;
    stages: Record<string, number>;
  }[];
  showrooms: {
    showroom_id: string; total: number; won: number;
    stages: Record<string, number>;
  }[];
}

const Analytics = () => {
  const { isAdmin, role, user } = useAuth();
  // No more `leads` state — replaced by server-side aggregates
  const [agg, setAgg] = useState<AnalyticsAgg | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [platformMembers, setPlatformMembers] = useState<{ user_id: string; platform_id: string }[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'summary' | 'overview'>('dashboard');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  // ── Meta fetch (profiles, showrooms, platforms) — reads from cache first ────
  useEffect(() => {
    const mecaCached = MecaCache.getPlatforms();
    const metaCached = user?.id ? LeadsCache.getMeta(user.id) : null;

    if (mecaCached && metaCached) {
      setProfiles(metaCached.profiles as unknown as Profile[]);
      setShowrooms(metaCached.showrooms as unknown as Showroom[]);
      setPlatforms(mecaCached);
      setPlatformMembers(MecaCache.getPlatformMembers() ?? []);
      setLoading(false);
      return;
    }

    const fetchMeta = async () => {
      const [profilesRes, showroomsRes, platformsRes, pmRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name'),
        supabase.from('showrooms').select('id, name, city'),
        supabase.from('platforms' as any).select('*'),
        supabase.from('platform_members' as any).select('user_id, platform_id'),
      ]);
      if (profilesRes.data) setProfiles(profilesRes.data as unknown as Profile[]);
      if (showroomsRes.data) setShowrooms(showroomsRes.data as unknown as Showroom[]);
      if (platformsRes.data) setPlatforms(platformsRes.data as unknown as { id: string; name: string }[]);
      if (pmRes.data) setPlatformMembers(pmRes.data as unknown as { user_id: string; platform_id: string }[]);
      setLoading(false);
    };
    fetchMeta();
  }, [user?.id]); // eslint-disable-line

  // ── Aggregates RPC — re-runs when date range or user filter changes ─────────
  useEffect(() => {
    if (activeTab !== 'overview') return; // lazy: only fetch when overview tab is open
    const fetchAgg = async () => {
      setOverviewLoading(true);
      const userId = isAdmin ? (selectedUserId === 'all' ? null : selectedUserId) : (user?.id ?? null);
      const { data, error } = await supabase.rpc('get_analytics_aggregates', {
        p_date_from: dateFrom ? dateFrom.toISOString() : null,
        p_date_to:   dateTo   ? dateTo.toISOString()   : null,
        p_user_id:   userId,
      });
      if (error) {
        console.error('get_analytics_aggregates error:', error);
        alert('Overview RPC Error: ' + error.message);
      }
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('Overview data:', parsed);
        setAgg(parsed as AnalyticsAgg);
      }
      setOverviewLoading(false);
    };
    fetchAgg();
  }, [activeTab, selectedUserId, dateFrom, dateTo, isAdmin, user?.id]); // eslint-disable-line

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-8">
        <div className="h-10 w-10 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-[14px] text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // ── Derive stats from RPC aggregates (zero JS iteration over raw rows) ──────
  const f = agg?.funnel ?? {};
  const stageOrder: FunnelStage[] = ['lead_capture','qualification','need_analysis','proposal','negotiation','closure_order_1','post_sale'];
  const reachedFrom = (from: FunnelStage) => {
    const idx = stageOrder.indexOf(from);
    return stageOrder.slice(idx).reduce((s, k) => s + (f[k] ?? 0), 0);
  };
  const totalLeads   = agg?.total ?? 0;
  const qualified    = reachedFrom('qualification');
  const needsAnalysis= reachedFrom('need_analysis');
  const proposed     = reachedFrom('proposal');
  const won          = reachedFrom('closure_order_1');
  const safe = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  const conversions = [
    { label: 'Qualified → Meetings', value: safe(needsAnalysis, qualified),  from: qualified,    to: needsAnalysis, gradient: 'var(--gradient-calling)', emoji: '🎯' },
    { label: 'Meetings → Proposal',  value: safe(proposed, needsAnalysis),   from: needsAnalysis,to: proposed,      gradient: 'var(--gradient-walkin)',  emoji: '📐' },
    { label: 'Proposal → Won',       value: safe(won, proposed),             from: proposed,     to: won,           gradient: 'var(--gradient-booking)', emoji: '🤝' },
    { label: 'Overall Win',          value: safe(won, totalLeads),           from: totalLeads,   to: won,           gradient: 'var(--gradient-delivery)',emoji: '🏆' },
  ];

  const BT_COLORS: Record<string, string> = {
    projects:'hsl(0 72% 55%)', retail:'hsl(210 80% 55%)', spares:'hsl(38 96% 50%)',
    consumer_supplies:'hsl(155 72% 40%)', service:'hsl(265 78% 58%)', trainings:'hsl(180 70% 45%)',
  };
  const businessTypeCounts = BUSINESS_TYPES.map((bt) => ({
    label: bt.label, value: bt.value,
    count: agg?.business_type?.[bt.value] ?? 0,
    color: BT_COLORS[bt.value] ?? 'hsl(var(--primary))',
  }));
  const businessTypeMax = Math.max(1, ...businessTypeCounts.map((b) => b.count));

  const SP_COLORS: Record<string, string> = {
    existing_customer:'hsl(210 80% 55%)', customer_referral:'hsl(265 78% 58%)',
    whatsapp:'hsl(142 70% 40%)', website:'hsl(200 78% 50%)', calling:'hsl(38 96% 50%)',
    exhibition:'hsl(0 72% 55%)', facebook_instagram:'hsl(220 85% 60%)',
    indiamart:'hsl(22 90% 52%)', manual_entry:'hsl(155 55% 45%)',
  };
  const sourceCounts = SOURCE_PORTALS.map((sp) => ({
    label: sp.label, value: sp.value,
    count: agg?.source?.[sp.value] ?? 0,
    color: SP_COLORS[sp.value] ?? 'hsl(var(--primary))',
  }));
  const sourceMax = Math.max(1, ...sourceCounts.map((b) => b.count));

  const REGION_COLORS: Record<string, string> = {
    north_india:'hsl(210 80% 55%)', south_india:'hsl(155 72% 40%)',
    east_india:'hsl(38 96% 50%)', west_india:'hsl(265 78% 58%)', central_india:'hsl(0 72% 55%)',
  };
  const regionCounts = REGIONS.map((r) => ({
    label: r.label, value: r.value,
    count: agg?.region?.[r.value] ?? 0,
    color: REGION_COLORS[r.value] ?? 'hsl(var(--primary))',
  }));

  const LT_COLORS: Record<string, string> = {
    nbd_incoming:'hsl(200 78% 50%)', nbd_outgoing:'hsl(265 78% 58%)', nbd_crr:'hsl(38 96% 50%)',
  };
  const leadTypeCounts = LEAD_TYPES.map((lt) => ({
    label: lt.label, value: lt.value,
    count: agg?.lead_type?.[lt.value] ?? 0,
    color: LT_COLORS[lt.value] ?? 'hsl(var(--primary))',
  }));

  // Build teamStats from RPC team array (no JS filtering of 30k rows)
  const teamStats: TeamMemberStats[] = (agg?.team ?? [])
    .map((t) => {
      const profile = profiles.find((p) => p.user_id === t.assigned_to);
      if (!profile) return null;
      const userPlatformIds   = platformMembers.filter((pm) => pm.user_id === t.assigned_to).map((pm) => pm.platform_id);
      const userPlatformNames = platforms.filter((pl) => userPlatformIds.includes(pl.id)).map((pl) => pl.name);
      return {
        userId: t.assigned_to, name: profile.full_name,
        total: t.total, stages: t.stages as unknown as StageCounts,
        won: t.won, hot: t.hot, warm: t.warm, cold: t.cold,
        platforms: userPlatformNames,
      };
    })
    .filter((s): s is TeamMemberStats => s !== null && s.total > 0)
    .sort((a, b) => b.won - a.won);

  const showroomStats: ShowroomStats[] = (agg?.showrooms ?? [])
    .map((s) => {
      const room = showrooms.find((r) => r.id === s.showroom_id);
      if (!room) return null;
      return { id: s.showroom_id, name: room.name, total: s.total, stages: s.stages as unknown as StageCounts, won: s.won };
    })
    .filter((s): s is ShowroomStats => s !== null && s.total > 0)
    .sort((a, b) => b.total - a.total);

  const userReports = (agg?.team ?? [])
    .map((t) => {
      const profile = profiles.find((p) => p.user_id === t.assigned_to);
      if (!profile) return null;
      return {
        userId: t.assigned_to, name: profile.full_name,
        totalQuoted: Number(t.total_quoted), totalSales: Number(t.total_sales),
        leadCount: t.total, closedCount: t.closed_count,
        avgClosureDays: 0, // requires per-row data — skipped in RPC path
        meetingsCount: t.meetings_count,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && (r.totalQuoted > 0 || r.totalSales > 0))
    .sort((a, b) => b.totalSales - a.totalSales);

  const grandQuoted = userReports.reduce((s, r) => s + r.totalQuoted, 0);
  const grandSales  = userReports.reduce((s, r) => s + r.totalSales,  0);
  const fmtAmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

  const currentProfile = profiles.find((p) => p.user_id === user?.id);
  const dashboardMembers = isAdmin
    ? profiles.map((p) => ({ user_id: p.user_id, full_name: p.full_name }))
    : currentProfile ? [{ user_id: currentProfile.user_id, full_name: currentProfile.full_name }] : [];

  const clearFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasFilter = dateFrom || dateTo;
  const dateLabel = hasFilter
    ? `${dateFrom ? format(dateFrom, 'dd MMM') : 'Start'} – ${dateTo ? format(dateTo, 'dd MMM') : 'End'}`
    : 'All time';

  const MECA_TABS = [
    { id: 'dashboard' as const, short: 'Dashboard', full: 'Sales Dashboard', icon: BarChart3 },
    { id: 'summary'   as const, short: 'Summary',   full: 'Sales Summary',   icon: ListOrdered },
    { id: 'overview'  as const, short: 'Overview',  full: 'Overview',        icon: Target },
  ];

  return (
    <div className="max-w-lg mx-auto lg:max-w-7xl">
      {/* Header */}
      <div
        className="relative rounded-b-[2rem] px-4 pb-4 lg:rounded-2xl lg:mx-4 lg:mt-4"
        style={{ background: 'var(--gradient-header)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.75rem)' }}
      >
        {/* Blob — clipped independently so overflow-hidden doesn't block tab scroll */}
        <div className="absolute inset-0 rounded-b-[2rem] lg:rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, var(--blob-accent), transparent 70%)' }} />
        </div>

        {/* Title row + date filter */}
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/10 shrink-0">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] sm:text-xl font-bold text-foreground tracking-tight">MeCA</h1>
              <p className="text-muted-foreground text-[11px] sm:text-[13px] truncate">Performance & Analytics</p>
            </div>
          </div>
          {/* Filters shown on Summary + Overview tabs */}
          {(activeTab === 'overview' || activeTab === 'summary') && (
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 relative">
              {/* Sales Person filter — admins only */}
              {isAdmin && (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="h-8 sm:h-9 rounded-xl border-border/40 bg-card/50 backdrop-blur-sm text-[11px] sm:text-[12px] w-[80px] sm:w-[110px] gap-0.5 sm:gap-1">
                    <UserCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="All Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Date range filter — flat (no nested popovers) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('rounded-xl h-8 sm:h-9 gap-1 sm:gap-1.5 text-[11px] sm:text-[12px] border-border/40 bg-card/50 backdrop-blur-sm px-2 sm:px-3', !dateFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline max-w-[70px] truncate">{dateFrom ? format(dateFrom, 'dd MMM yy') : 'From'}</span>
                    {hasFilter && <span className="sm:hidden absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl border-border/30" align="end" sideOffset={6}>
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('rounded-xl h-8 sm:h-9 gap-1 sm:gap-1.5 text-[11px] sm:text-[12px] border-border/40 bg-card/50 backdrop-blur-sm px-2 sm:px-3', !dateTo && 'text-muted-foreground')}>
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline max-w-[70px] truncate">{dateTo ? format(dateTo, 'dd MMM yy') : 'To'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl border-border/30" align="end" sideOffset={6}>
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {hasFilter && (
                <button
                  onClick={clearFilter}
                  className="h-8 sm:h-9 w-8 sm:w-9 rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground active:bg-muted transition-colors"
                  aria-label="Clear filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Switcher — horizontally scrollable on mobile */}
        <div className="relative mt-4 overflow-x-auto scrollbar-none -mx-1 px-1">
          <div className="flex gap-1 p-1 bg-background/40 backdrop-blur-sm rounded-2xl border border-border/30 w-max min-w-full">
            {MECA_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-all shrink-0 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.full}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview tab spinner while RPC loads */}
      {overviewLoading && activeTab === 'overview' && (
        <div className="px-4 pt-3 flex items-center gap-2">
          <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-[11px] text-muted-foreground">Calculating…</span>
        </div>
      )}

      <div className="px-3 sm:px-4 mt-4 animate-in relative z-10" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}>
        {/* ── Sales Dashboard ── */}
        {activeTab === 'dashboard' && (
          <SalesDashboard
            members={dashboardMembers}
            selectedUserId={isAdmin ? selectedUserId : (user?.id ?? 'all')}
            onSelectedUserIdChange={setSelectedUserId}
            startDate={dateFrom}
            endDate={dateTo}
            onStartDateChange={setDateFrom}
            onEndDateChange={setDateTo}
          />
        )}

        {/* ── Sales Summary — respects same filters as Overview ── */}
        {activeTab === 'summary' && (
          <SalesSummary
            members={dashboardMembers}
            userId={user?.id}
            isAdmin={isAdmin}
            filterUserId={isAdmin ? (selectedUserId === 'all' ? undefined : selectedUserId) : user?.id}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )}

        {/* ── Overview: conversion metrics + charts ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">

            {/* Conversion Rate Cards — hidden for now */}
            {/* <div className="grid grid-cols-2 gap-2.5">
              {conversions.map((c) => (
                <Card key={c.label} className="border border-border/20 rounded-2xl overflow-hidden bg-card/60 glass-subtle">
                  <CardContent className="p-3.5">
                    <span className="text-lg">{c.emoji}</span>
                    <p className="text-[36px] font-bold text-foreground mt-1 tracking-tight">{c.value.toFixed(1)}%</p>
                    <p className="text-[20px] text-muted-foreground font-medium mt-0.5">{c.label}</p>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(c.value, 100)}%`, background: c.gradient }}
                      />
                    </div>
                    <p className="text-[15px] text-muted-foreground mt-1">{c.from} → {c.to}</p>
                  </CardContent>
                </Card>
              ))}
            </div> */}

            {/* Lead Type Bar Chart */}
        <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-walkin)' }}>
              <Tag className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Lead Type</p>
          </div>

          {/* Summary table */}
          <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full border-collapse text-center" style={{ minWidth: `${leadTypeCounts.length * 100}px` }}>
              <thead>
                <tr className="bg-muted/50">
                  {leadTypeCounts.map((lt) => (
                    <th key={lt.value} className="px-3 py-2.5 text-[13px] lg:text-[14px] font-semibold text-foreground border border-border/30 whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: lt.color }} />
                        {lt.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {leadTypeCounts.map((lt) => (
                    <td key={lt.value} className="px-3 py-3 border border-border/30">
                      <span className="text-[24px] lg:text-[28px] font-bold" style={{ color: lt.color }}>{lt.count}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3D Bar Chart */}
          <div className="px-3 pt-3 pb-5">
            <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: `${Math.max(leadTypeCounts.length * 120, 360)}px`, height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={leadTypeCounts}
                    margin={{ top: 18, right: 12, left: -16, bottom: 8 }}
                    barCategoryGap="36%"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false}
                      stroke="hsl(var(--border))" strokeOpacity={0.45} />
                    <XAxis
                      dataKey="label"
                      tick={<WrapAxisTick />}
                      interval={0}
                      height={55}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, padding: '6px 12px' }}
                      formatter={(val: number, _n: string, props: any) => [val, props.payload.label]}
                      labelFormatter={() => ''}
                    />
                    <Bar dataKey="count" shape={<Bar3D />} maxBarSize={80}>
                      {leadTypeCounts.map((lt) => (
                        <Cell key={lt.value} fill={lt.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>

        {/* Business Type Bar Chart */}
        <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-calling)' }}>
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Type of Business</p>
          </div>

          {/* Summary table */}
          <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full border-collapse text-center" style={{ minWidth: `${businessTypeCounts.length * 100}px` }}>
              <thead>
                <tr className="bg-muted/50">
                  {businessTypeCounts.map((bt) => (
                    <th key={bt.value} className="px-3 py-2.5 text-[13px] lg:text-[14px] font-semibold text-foreground border border-border/30 whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: bt.color }} />
                        {bt.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {businessTypeCounts.map((bt) => (
                    <td key={bt.value} className="px-3 py-3 border border-border/30">
                      <span className="text-[24px] lg:text-[28px] font-bold" style={{ color: bt.color }}>{bt.count}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3D Bar Chart */}
          <div className="px-3 pt-3 pb-5">
            <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: `${Math.max(businessTypeCounts.length * 80, 360)}px`, height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={businessTypeCounts}
                    margin={{ top: 18, right: 12, left: -16, bottom: 8 }}
                    barCategoryGap="36%"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false}
                      stroke="hsl(var(--border))" strokeOpacity={0.45} />
                    <XAxis
                      dataKey="label"
                      tick={<WrapAxisTick />}
                      interval={0}
                      height={55}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, padding: '6px 12px' }}
                      formatter={(val: number, _n: string, props: any) => [val, props.payload.label]}
                      labelFormatter={() => ''}
                    />
                    <Bar dataKey="count" shape={<Bar3D />} maxBarSize={56}>
                      {businessTypeCounts.map((bt) => (
                        <Cell key={bt.value} fill={bt.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>

        {/* Lead Source Bar Chart */}
        <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-booking)' }}>
              <Target className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Lead Source</p>
          </div>

          {/* Summary table */}
          <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full border-collapse text-center" style={{ minWidth: `${sourceCounts.length * 110}px` }}>
              <thead>
                <tr className="bg-muted/50">
                  {sourceCounts.map((sp) => (
                    <th key={sp.value} className="px-3 py-2.5 text-[13px] lg:text-[14px] font-semibold text-foreground border border-border/30 whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: sp.color }} />
                        {sp.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {sourceCounts.map((sp) => (
                    <td key={sp.value} className="px-3 py-3 border border-border/30">
                      <span className="text-[24px] lg:text-[26px] font-bold" style={{ color: sp.color }}>{sp.count}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3D Bar Chart */}
          <div className="px-4 pt-3 pb-5">
            <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: `${Math.max(sourceCounts.length * 100, 720)}px`, height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sourceCounts}
                    margin={{ top: 18, right: 16, left: -14, bottom: 8 }}
                    barCategoryGap="36%"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false}
                      stroke="hsl(var(--border))" strokeOpacity={0.45} />
                    <XAxis
                      dataKey="label"
                      tick={<WrapAxisTick />}
                      interval={0}
                      height={55}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, padding: '6px 12px' }}
                      formatter={(val: number, _n: string, props: any) => [val, props.payload.label]}
                      labelFormatter={() => ''}
                    />
                    <Bar dataKey="count" shape={<Bar3D />} maxBarSize={52}>
                      {sourceCounts.map((sp) => (
                        <Cell key={sp.value} fill={sp.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>

        {/* Region 3D Bar Chart */}
        <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 pt-5 pb-3">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-delivery)' }}>
              <MapPin className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Region</p>
          </div>

          {/* Summary table */}
          <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full border-collapse text-center" style={{ minWidth: `${regionCounts.length * 110}px` }}>
              <thead>
                <tr className="bg-muted/50">
                  {regionCounts.map((r) => (
                    <th key={r.value} className="px-4 py-2.5 text-[13px] lg:text-[14px] font-semibold text-foreground border border-border/30 whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                        {r.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {regionCounts.map((r) => (
                    <td key={r.value} className="px-4 py-3 border border-border/30">
                      <span className="text-[24px] lg:text-[28px] font-bold" style={{ color: r.color }}>{r.count}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3D Bar Chart */}
          <div className="px-4 pt-3 pb-5">
            <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: `${Math.max(regionCounts.length * 100, 380)}px`, height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={regionCounts}
                    margin={{ top: 18, right: 16, left: -14, bottom: 8 }}
                    barCategoryGap="36%"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false}
                      stroke="hsl(var(--border))" strokeOpacity={0.45} />
                    <XAxis
                      dataKey="label"
                      tick={<WrapAxisTick />}
                      interval={0}
                      height={55}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, padding: '6px 12px' }}
                      formatter={(val: number, _n: string, props: any) => [val, props.payload.label]}
                      labelFormatter={() => ''}
                    />
                    <Bar dataKey="count" shape={<Bar3D />} maxBarSize={72}>
                      {regionCounts.map((r) => (
                        <Cell key={r.value} fill={r.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>

          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
