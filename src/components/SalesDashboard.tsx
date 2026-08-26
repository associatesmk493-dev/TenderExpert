import { useEffect, useState, useMemo } from 'react';
import SalesPersonSummary from '@/components/SalesPersonSummary';
import { supabase } from '@/integrations/supabase/client';
import { fetchAll } from '@/lib/fetchAll';
import { MecaCache, type DashLead, type DashActivity, type DashOrder, type LeadOwner } from '@/lib/mecaCache';
import { filterFinanceLeads, filterFinanceOrders, sumTotalSales } from '@/lib/salesFinancials';
import { differenceInDays, parseISO, isWithinInterval, startOfDay, endOfDay, format, isValid } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  TrendingUp, Users, Clock, DollarSign, Timer, Target, Activity,
  Trophy, XCircle, UserCheck, CalendarIcon, X, Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';


interface SalesDashboardProps {
  members: { user_id: string; full_name: string }[];
  selectedUserId: string;
  onSelectedUserIdChange: (userId: string) => void;
  startDate?: Date;
  endDate?: Date;
  onStartDateChange: (date?: Date) => void;
  onEndDateChange: (date?: Date) => void;
}

// A lead counts as "won" once it reaches Order Won and stays won through
// Delivered / Post Sale — those are downstream progress, not a loss of the sale.
const ORDER_WON_STAGES = ['closure_order_1', 'delivered', 'post_sale'];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));

const fmtDays = (n: number) => (isNaN(n) || !isFinite(n) ? '0.0' : n.toFixed(1));

function safeParseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

function inRange(dateStr: string | null | undefined, start: Date, end: Date): boolean {
  const d = safeParseISO(dateStr);
  if (!d) return false;
  return isWithinInterval(d, { start: startOfDay(start), end: endOfDay(end) });
}

export default function SalesDashboard({
  members,
  selectedUserId,
  onSelectedUserIdChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: SalesDashboardProps) {
  const [allLeads, setAllLeads] = useState<DashLead[]>([]);
  const [allActivities, setAllActivities] = useState<DashActivity[]>([]);
  const [allOrders, setAllOrders] = useState<DashOrder[]>([]);
  const [allLeadOwners, setAllLeadOwners] = useState<LeadOwner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Apply whatever is currently in cache to state
    const applyCache = () => {
      const leads = MecaCache.getDashLeads();
      const activities = MecaCache.getDashActivities();
      const orders = MecaCache.getDashOrders();
      const owners = MecaCache.getLeadOwners();
      if (leads && activities && !cancelled) {
        setAllLeads([...leads]);
        setAllActivities([...activities]);
        setAllOrders(orders ? [...orders] : []);
        setAllLeadOwners(owners ? [...owners] : []);
        setLoading(false);
      }
    };

    // Subscribe to progressive cache updates (fires on each new page of leads)
    const unsub = MecaCache.onUpdate(applyCache);

    const init = async () => {
      // Already cached — render instantly
      if (MecaCache.getDashLeads()) { applyCache(); return; }

      // Prefetch in-flight — wait for first page (fast path ~1s)
      const inflight = MecaCache.awaitPrefetch();
      if (inflight) {
        await inflight;
        applyCache();
        return;
      }

      // No prefetch started (rare: user hit MeCA before auth finished)
      if (cancelled) return;
      setLoading(true);
      const [leads, activities, orders] = await Promise.all([
        fetchAll<DashLead>(() =>
          supabase.from('leads').select(
            'id, assigned_to, funnel_stage, walkin_date, booking_date, finance_updated_at, created_at, updated_at, quoted_amount, closed_amount, margin_percent, advance_amount, before_delivery_amount, after_delivery_amount'
          )
        ),
        fetchAll<DashActivity>(() =>
          supabase.from('lead_activities')
            .select('lead_id, activity_type, description, created_at')
            .or('description.ilike.%Walk-in Scheduled%,description.eq.Stage → need_analysis,description.ilike.%lost_rejected%,' +
              'description.eq.Stage → closure_order_1,description.eq.Stage → delivered,description.eq.Stage → post_sale,' +
              'description.ilike.%amount updated%')
        ),
        fetchAll<DashOrder>(() =>
          supabase.from('lead_orders' as any).select(
            'id, lead_id, quoted_amount, closed_amount, advance_amount, before_delivery_amount, after_delivery_amount, created_at, updated_at'
          )
        ),
      ]);
      if (!cancelled) {
        setAllLeads(leads); setAllActivities(activities); setAllOrders(orders);
        setAllLeadOwners(leads.map((l) => ({ id: l.id, assigned_to: l.assigned_to })));
        setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; unsub(); };
  }, []); // eslint-disable-line

  const selectedMember = selectedUserId === 'all'
    ? { full_name: 'All Team' }
    : members.find((m) => m.user_id === selectedUserId);

  // All-time leads for selected user
  const userLeads = useMemo(
    () => selectedUserId === 'all'
      ? allLeads
      : allLeads.filter((l) => l.assigned_to === selectedUserId),
    [allLeads, selectedUserId],
  );

  // Date-range leads for selected user (filtered by created_at — for lead counts)
  const rangeLeads = useMemo(() => {
    if (!startDate || !endDate) return userLeads;
    return userLeads.filter((l) => inRange(l.created_at, startDate, endDate));
  }, [userLeads, startDate, endDate]);

  // Complete id → assigned_to map (from leadOwners, NOT dashLeads — dashLeads is
  // capped to the newest 1000 for a fast first render, so using it here would
  // silently drop activities/orders belonging to older leads still loading in
  // the background).
  const leadIdToAssignedTo = useMemo(
    () => new Map(allLeadOwners.map((l) => [l.id, l.assigned_to])),
    [allLeadOwners],
  );
  const userLeadIds = useMemo(
    () => new Set(
      selectedUserId === 'all'
        ? allLeadOwners.map((l) => l.id)
        : allLeadOwners.filter((l) => l.assigned_to === selectedUserId).map((l) => l.id)
    ),
    [allLeadOwners, selectedUserId],
  );

  // Repeat/multi-branch orders (lead_orders) for the selected salesperson, scoped
  // via the parent lead's assigned_to — these carry their own revenue on top of
  // the lead's own closed_amount and must be added in so Total Sales is accurate.
  const userOrders = useMemo(
    () => selectedUserId === 'all'
      ? allOrders
      : allOrders.filter((o) => leadIdToAssignedTo.get(o.lead_id) === selectedUserId),
    [allOrders, leadIdToAssignedTo, selectedUserId],
  );
  const rangeOrders = useMemo(() => {
    return filterFinanceOrders(userOrders, startDate, endDate);
  }, [userOrders, startDate, endDate]);

  // Activities for the selected salesperson's leads — used for Meetings/Lost,
  // which must reflect when the activity itself happened, not when the parent
  // lead was created and not the lead's *current* funnel_stage (a lead can move
  // on to Proposal/Negotiation/Won after its meeting and should still count).
  const userActivities = useMemo(
    () => allActivities.filter((a) => userLeadIds.has(a.lead_id)),
    [allActivities, userLeadIds],
  );
  const rangeActivities = useMemo(() => {
    if (!startDate || !endDate) return userActivities;
    return userActivities.filter((a) => inRange(a.created_at, startDate, endDate));
  }, [userActivities, startDate, endDate]);

  // Date-range leads for financial metrics — filtered by booking_date, or the
  // activity-log-derived close date, falling back to finance_updated_at (set
  // when the lead's own payment fields are edited going forward) and then
  // created_at for leads with no matching signal at all.
  const financeLeads = useMemo(() => {
    return filterFinanceLeads(userLeads, userActivities, startDate, endDate);
  }, [userLeads, userActivities, startDate, endDate]);

  const metrics = useMemo(() => {
    const baseLeads   = rangeLeads;   // for lead counts / meetings / lost
    const totalLeads  = baseLeads.length;

    // Meetings: distinct leads with a Walk-in Scheduled / Stage → need_analysis
    // activity logged within the range — from the activity log's own date, so a
    // lead created earlier (or since moved past need_analysis) still counts.
    const meetingLeadIds = new Set(
      rangeActivities
        .filter((a) =>
          (a.description?.includes('Walk-in Scheduled') ?? false) ||
          a.description === 'Stage → need_analysis'
        )
        .map((a) => a.lead_id)
    );
    // The current-stage fallback only makes sense with no date range selected —
    // there's no reliable date signal for a lead that was never logged.
    const meetings = (startDate && endDate)
      ? meetingLeadIds.size
      : meetingLeadIds.size > 0
        ? meetingLeadIds.size
        : baseLeads.filter((l) => l.funnel_stage === 'need_analysis').length;

    // Lost: distinct leads with a lost_rejected activity logged within the range
    const lostLeadIds = new Set(
      rangeActivities
        .filter((a) => a.description?.includes('lost_rejected') ?? false)
        .map((a) => a.lead_id)
    );
    const lostFromLogs = (startDate && endDate)
      ? lostLeadIds.size
      : lostLeadIds.size > 0
        ? lostLeadIds.size
        : baseLeads.filter((l) => l.funnel_stage === 'lost_rejected').length;

    // Won leads use financeLeads (filtered by booking_date/updated_at) so a lead
    // closed within the date range is counted even if it was created earlier.
    const allWonLeads = financeLeads.filter((l) => ORDER_WON_STAGES.includes(l.funnel_stage));
    // Active Leads = everything NOT yet won or lost (still in the sales pipeline)
    const CLOSED_STAGES = [...ORDER_WON_STAGES, 'lost_rejected'];
    const activeLeads   = baseLeads.filter((l) => !CLOSED_STAGES.includes(l.funnel_stage));

    // Financial metrics use financeLeads (filtered by booking_date/updated_at)
    // so that sales closed within the date range are captured even if the lead
    // was created before the range started. Repeat/multi-branch orders
    // (rangeOrders) carry their own separate revenue and are added on top.
    const transactionLeads  = financeLeads.filter((l) => (l.closed_amount ?? 0) > 0);
    const transactionOrders = rangeOrders.filter((o) => (o.closed_amount ?? 0) > 0);
    const totalTransactions = transactionLeads.length + transactionOrders.length;

    const quotationAmt    = financeLeads.reduce((s, l) => s + (l.quoted_amount ?? 0), 0)
      + rangeOrders.reduce((s, o) => s + (o.quoted_amount ?? 0), 0);
    const closedAmt       = sumTotalSales(financeLeads, rangeOrders);
    const paymentReceived = financeLeads.reduce((s, l) => s + (l.advance_amount ?? 0) + (l.before_delivery_amount ?? 0) + (l.after_delivery_amount ?? 0), 0)
      + rangeOrders.reduce((s, o) => s + (o.advance_amount ?? 0) + (o.before_delivery_amount ?? 0) + (o.after_delivery_amount ?? 0), 0);
    const avgSalesAmt     = totalTransactions > 0 ? closedAmt / totalTransactions : 0;
    // Conversion ratio must compare like-for-like: won count here is leads from
    // baseLeads (created within range) that are currently in a won stage — NOT
    // allWonLeads, which is scoped by close date and can pull in leads created
    // outside the range, letting won count exceed totalLeads (>100% conversion).
    const wonFromBaseLeads = baseLeads.filter((l) => ORDER_WON_STAGES.includes(l.funnel_stage)).length;
    const conversionRatio = totalLeads > 0 ? (wonFromBaseLeads / totalLeads) * 100 : 0;
    const salesAmt        = closedAmt;

    const grossProfit = financeLeads.reduce((s, l) => {
      if (l.closed_amount && l.margin_percent) return s + (l.closed_amount * l.margin_percent) / 100;
      return s;
    }, 0);

    const closingTimes = allWonLeads
      .filter((l) => l.booking_date || l.updated_at)
      .map((l) => {
        const closeDate = safeParseISO(l.booking_date) ?? safeParseISO(l.updated_at)!;
        return differenceInDays(closeDate, parseISO(l.created_at));
      })
      .filter((n) => n >= 0);
    const avgClosingTime =
      closingTimes.length > 0 ? closingTimes.reduce((a, b) => a + b, 0) / closingTimes.length : 0;

    const allCompanyWon = allLeads.filter((l) => ORDER_WON_STAGES.includes(l.funnel_stage));
    const companyTimes = allCompanyWon
      .filter((l) => l.booking_date || l.updated_at)
      .map((l) => {
        const closeDate = safeParseISO(l.booking_date) ?? safeParseISO(l.updated_at)!;
        return differenceInDays(closeDate, parseISO(l.created_at));
      })
      .filter((n) => n >= 0);
    const companyAvgClosingTime =
      companyTimes.length > 0 ? companyTimes.reduce((a, b) => a + b, 0) / companyTimes.length : 0;

    // rangeTotal / rangeWon are the same as baseLeads since we unified the base.
    // Kept for UI card compatibility.
    const rangeTotal           = totalLeads;
    const rangeWon             = allWonLeads;
    const rangeSalesAmt        = salesAmt;
    const rangeConversionRatio = conversionRatio;

    // Order Won / Total Closed Leads count WON LEADS, not transactions — a
    // repeat order (lead_orders) adds its revenue to the totals above, but it
    // doesn't make the same lead count as "won" twice.
    const wonCount = allWonLeads.length;

    return {
      // all-time
      totalLeads,
      meetings,
      activeLeads:  activeLeads.length,
      lostLeads:    lostFromLogs,
      orderWon:     wonCount,
      quotationAmt,
      avgSalesAmt,
      conversionRatio,
      salesAmt,
      closedAmt,
      paymentReceived,
      grossProfit,
      avgClosingTime,
      companyAvgClosingTime,
      // date-range
      rangeTotal,
      totalClosedRange: wonCount,   // ← Total Closed Leads (selected dt range)
      rangeSalesAmt,
      rangeConversionRatio,
    };
  }, [userLeads, rangeLeads, financeLeads, rangeOrders, rangeActivities, allLeads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-10 w-10 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Stat configs ─────────────────────────────────────────────────────────
  const total = metrics.totalLeads || 1;

  const leadsStats = [
    {
      label: 'Total Leads',
      value: metrics.totalLeads,
      pct: 100,
      icon: Users,
      color: 'hsl(200 78% 50%)',
      bg: 'var(--gradient-calling)',
      note: startDate && endDate ? 'Selected date range' : 'All time',
    },
    {
      label: 'Active Leads',
      value: metrics.activeLeads,
      pct: (metrics.activeLeads / total) * 100,
      icon: Target,
      color: 'hsl(155 72% 40%)',
      bg: 'var(--gradient-booking)',
      note: 'Excl. Won & Lost',
    },
    {
      label: 'Lost Leads',
      value: metrics.lostLeads,
      pct: (metrics.lostLeads / total) * 100,
      icon: XCircle,
      color: 'hsl(0 70% 55%)',
      bg: 'linear-gradient(135deg,hsl(0,72%,55%),hsl(15,70%,50%))',
      note: 'From activity logs',
    },
    {
      label: 'Order Won',
      value: metrics.orderWon,
      pct: (metrics.orderWon / total) * 100,
      icon: Trophy,
      color: 'hsl(38 96% 50%)',
      bg: 'linear-gradient(135deg,hsl(38,96%,50%),hsl(28,92%,55%))',
      note: startDate && endDate ? 'Selected date range' : 'All time',
    },
    {
      label: 'Total Closed Leads',
      value: metrics.totalClosedRange,
      pct: (metrics.totalClosedRange / total) * 100,
      icon: UserCheck,
      color: 'hsl(160 68% 42%)',
      bg: 'var(--gradient-delivery)',
      note: startDate && endDate ? 'Selected date range' : 'All time',
      highlight: true,
    },
  ] as const;

  const salesStats = [
    { label: 'Quotation Amt',     value: `₹${fmt(metrics.quotationAmt)}`,    color: 'hsl(200 78% 50%)', emoji: '📋', note: 'All time' },
    { label: 'Closed Amount',     value: `₹${fmt(metrics.closedAmt)}`,       color: 'hsl(155 72% 55%)', emoji: '💰', note: 'All time' },
    { label: 'Avg Order Value',   value: `₹${fmt(metrics.avgSalesAmt)}`,     color: 'hsl(265 78% 58%)', emoji: '📊', note: 'Total Sales / Leads with Payments' },
    { label: 'Payment Received',  value: `₹${fmt(metrics.paymentReceived)}`, color: 'hsl(38 96% 50%)',  emoji: '✅', note: 'Advance + Before + After delivery' },
  ] as const;

  const hasDateFilter = !!(startDate && endDate);
  const dateLabel = hasDateFilter
    ? `${format(startDate!, 'dd MMM yyyy')} – ${format(endDate!, 'dd MMM yyyy')}`
    : 'All time';

  return (
    <div className="space-y-4">

      {/* ── Controls card ── */}
      <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-border/10">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-calling)' }}>
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Sales Dashboard</p>
            {hasDateFilter && (
              <span className="ml-auto text-[11px] font-semibold text-primary bg-primary/10 rounded-lg px-2 py-0.5">
                {dateLabel}
              </span>
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-3 p-4 pt-3">
            {/* Sales Person selector — hide when only one member (team member view) */}
            {members.length > 1 && (
              <div className="w-full sm:w-52 shrink-0">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Sales Person</p>
                <Select value={selectedUserId} onValueChange={onSelectedUserIdChange}>
                  <SelectTrigger className="h-10 rounded-xl border-border/40 bg-background/60 text-[13px]">
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Date Range — flat (no nested popovers for mobile compatibility) */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Date Range</p>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('flex-1 h-10 rounded-xl border-border/40 bg-background/60 text-[13px] justify-start gap-1.5 font-normal min-w-0', !startDate && 'text-muted-foreground')}>
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{startDate ? format(startDate, 'dd MMM yy') : 'From'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-border/30" align="start" sideOffset={6}>
                    <Calendar mode="single" selected={startDate} onSelect={onStartDateChange} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('flex-1 h-10 rounded-xl border-border/40 bg-background/60 text-[13px] justify-start gap-1.5 font-normal min-w-0', !endDate && 'text-muted-foreground')}>
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{endDate ? format(endDate, 'dd MMM yy') : 'To'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-border/30" align="start" sideOffset={6}>
                    <Calendar mode="single" selected={endDate} onSelect={onEndDateChange} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {(startDate || endDate) && (
                  <button
                    onClick={() => { onStartDateChange(undefined); onEndDateChange(undefined); }}
                    className="h-10 w-10 rounded-xl border border-border/40 bg-background/60 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground active:bg-muted transition-colors"
                    aria-label="Clear date filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── User identity banner ── */}
      {selectedMember && (
        <div className="relative overflow-hidden rounded-2xl p-3 sm:p-4 lg:p-5 flex items-center gap-2 sm:gap-4 border border-border/10"
          style={{ background: 'var(--gradient-header)' }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, var(--blob-primary), transparent 70%)' }} />
          <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-2xl bg-primary/15 border border-primary/10 flex items-center justify-center text-[18px] sm:text-[24px] font-bold text-primary shrink-0">
            {selectedMember.full_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] sm:text-[18px] lg:text-[20px] font-bold text-foreground truncate">{selectedMember.full_name}</p>
            <p className="text-[11px] sm:text-[12px] text-muted-foreground mt-0.5 truncate">
              {dateLabel}&nbsp;·&nbsp;{metrics.totalLeads} leads&nbsp;·&nbsp;{metrics.totalClosedRange} closed
            </p>
          </div>
        </div>
      )}

      {/* ── Key Metrics ── */}
      <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-walkin)' }}>
            <Target className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Key Metrics</p>
        </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 px-3 sm:px-4">
          {/* Meetings */}
          <div className="rounded-2xl overflow-hidden ring-2 ring-purple-500/25" style={{ background: 'var(--gradient-walkin)' }}>
            <div className="p-3 sm:p-5 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[130px]">
              <Handshake className="h-5 w-5 sm:h-6 sm:w-6 text-white/70 mb-1.5" />
              <p className="text-[9px] sm:text-[12px] font-bold text-white/80 uppercase tracking-wider leading-tight">Meetings</p>
              <p className="text-[32px] sm:text-[44px] lg:text-[52px] font-extrabold text-white leading-none mt-1">{metrics.meetings}</p>
            </div>
          </div>
          {/* Conversion */}
          <div className="rounded-2xl overflow-hidden ring-2 ring-amber-500/25"
            style={{ background: 'linear-gradient(135deg, hsl(220 40% 14%), hsl(235 35% 20%))' }}>
            <div className="p-3 sm:p-5 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[130px]">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white/60 mb-1.5" />
              <p className="text-[9px] sm:text-[12px] font-bold text-white/55 uppercase tracking-wider leading-tight">Conversion</p>
              <p className="text-[28px] sm:text-[44px] lg:text-[52px] font-extrabold leading-none mt-1" style={{ color: 'hsl(38 96% 62%)' }}>
                {metrics.conversionRatio.toFixed(1)}%
              </p>
            </div>
          </div>
          {/* ASP */}
          <div className="rounded-2xl overflow-hidden ring-2 ring-teal-500/25" style={{ background: 'var(--gradient-delivery)' }}>
            <div className="p-3 sm:p-5 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[130px]">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white/70 mb-1.5" />
              <p className="text-[8px] sm:text-[12px] font-bold text-white/80 uppercase tracking-wider leading-tight">Avg Sales</p>
              <p className="text-[15px] sm:text-[22px] lg:text-[28px] font-extrabold text-white leading-none mt-1">₹{fmt(metrics.avgSalesAmt)}</p>
            </div>
          </div>
        </div>

        {/* Total Sales — full width */}
        <div className="px-3 sm:px-4 pb-5 mt-2 sm:mt-3">
          <div className="rounded-2xl overflow-hidden ring-2 ring-amber-500/25"
            style={{ background: 'linear-gradient(135deg, hsl(220 40% 14%), hsl(235 35% 20%))' }}>
            <div className="px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <DollarSign className="h-5 w-5 sm:h-7 sm:w-7 text-white/60 shrink-0" />
                <p className="text-[11px] sm:text-[14px] font-bold text-white/55 uppercase tracking-wider truncate">Total Sales</p>
              </div>
              <p className="text-[24px] sm:text-[36px] lg:text-[44px] font-extrabold leading-none shrink-0" style={{ color: 'hsl(38 96% 62%)' }}>
                ₹{fmt(metrics.closedAmt)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Leads Distribution ── */}
      <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-calling)' }}>
            <Users className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Leads Distribution</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 px-3 sm:px-4 pb-5">
          {leadsStats.map((s) => (
            <div
              key={s.label}
              className={cn(
                'rounded-2xl border border-border/20 bg-background/40 p-3 sm:p-4 flex flex-col transition-all duration-200 hover:scale-[1.02]',
                s.highlight && 'ring-2 ring-primary/25'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                  <s.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <span className="text-[18px] sm:text-[24px] font-bold tabular-nums leading-none" style={{ color: s.color }}>
                  {s.pct.toFixed(0)}%
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/60 font-medium leading-tight">{s.note}</p>
              <p className="text-[12px] sm:text-[13px] font-semibold text-muted-foreground leading-tight mt-0.5">{s.label}</p>
              <p className="text-[20px] sm:text-[26px] lg:text-[34px] font-bold mt-1 leading-none tracking-tight" style={{ color: s.color }}>
                {s.value}
              </p>
              <div className="mt-auto pt-2 sm:pt-3">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(s.pct, 100)}%`, background: s.color, opacity: 0.7 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Payment Status ── */}
      <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-booking)' }}>
            <TrendingUp className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Payment Status</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 px-4 pb-5">
          {salesStats.map((s) => {
            const isHighlight = 'highlight' in s && s.highlight;
            return (
              <div
                key={s.label}
                className={cn(
                  'rounded-2xl border border-border/20 bg-background/40 p-4 lg:p-5 transition-all duration-200 hover:scale-[1.02]',
                  isHighlight && 'ring-2 ring-primary/25'
                )}
              >
                <span className="text-[20px] mb-2 block">{s.emoji}</span>
                <p className="text-[11px] text-muted-foreground/60 font-medium">{s.note}</p>
                <p className="text-[13px] font-semibold text-muted-foreground leading-tight mt-0.5">{s.label}</p>
                <p className="text-[22px] lg:text-[26px] font-bold mt-1.5 leading-none tracking-tight" style={{ color: s.color }}>
                  {s.value}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Closing Time ── */}
      <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-orange-100 dark:bg-orange-900/30">
            <Clock className="h-3.5 w-3.5 text-orange-500" />
          </div>
          <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Lead Closing Time</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 px-4 pb-5">
          {/* Selected member closing time */}
          <div className="rounded-2xl border border-border/20 bg-background/40 p-4 lg:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-orange-100 dark:bg-orange-900/30">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Avg Closing Time</p>
                <p className="text-[12px] text-muted-foreground/70 truncate">{selectedMember?.full_name ?? '—'}</p>
              </div>
            </div>
            <p className="text-[26px] sm:text-[32px] lg:text-[36px] font-bold tracking-tight leading-none" style={{ color: 'hsl(0 70% 52%)' }}>
              {fmtDays(metrics.avgClosingTime)} <span className="text-[13px] sm:text-[16px] font-semibold text-muted-foreground">days</span>
            </p>
          </div>
          {/* Company avg */}
          <div className="rounded-2xl overflow-hidden relative border border-border/10"
            style={{ background: 'linear-gradient(135deg, hsl(220 40% 14%), hsl(235 35% 20%))' }}>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, hsl(200 75% 60%), transparent 70%)' }} />
            <div className="p-4 lg:p-5 relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-calling)' }}>
                  <Timer className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Kitchnrama</p>
                  <p className="text-[12px] text-white/40">Overall Avg</p>
                </div>
              </div>
              <p className="text-[26px] sm:text-[32px] lg:text-[36px] font-bold tracking-tight leading-none" style={{ color: 'hsl(38 96% 62%)' }}>
                {fmtDays(metrics.companyAvgClosingTime)} <span className="text-[13px] sm:text-[16px] font-semibold text-white/40">days</span>
              </p>
            </div>
          </div>
          {/* Gross Profit */}
          <div className="rounded-2xl overflow-hidden relative border border-border/10" style={{ background: 'var(--gradient-delivery)' }}>
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, hsl(160 70% 60%), transparent 70%)' }} />
            <div className="p-4 lg:p-5 relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Gross Profit</p>
                  <p className="text-[12px] text-white/40">Est. Margin</p>
                </div>
              </div>
              <p className="text-[22px] sm:text-[30px] lg:text-[36px] font-bold tracking-tight leading-none text-white">
                ₹{fmt(metrics.grossProfit)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Individual Performance ── */}
      <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-calling)' }}>
            <Users className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-[14px] lg:text-[16px] font-bold text-foreground">Individual Performance</p>
        </div>
        <div className="px-4 pb-5">
          <SalesPersonSummary members={members} leads={rangeLeads} wonLeads={financeLeads} />
        </div>
      </Card>
    </div>
  );
}
