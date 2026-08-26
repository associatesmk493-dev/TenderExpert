import { useEffect, useState, useMemo, ComponentType } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MecaCache } from '@/lib/mecaCache';
import { filterFinanceLeads, filterFinanceOrders, sumTotalSales } from '@/lib/salesFinancials';
import { Card, CardContent } from '@/components/ui/card';
import {
  LayoutList, Users2, Handshake, FileText, TrendingUp, Trophy, UserCheck, ArrowRight,
} from 'lucide-react';

interface SalesSummaryProps {
  members: { user_id: string; full_name: string }[];
  userId?: string;
  isAdmin?: boolean;
  /** When set, show data only for this sales person */
  filterUserId?: string;
  /** Optional date range filters */
  dateFrom?: Date;
  dateTo?: Date;
}

interface StageItem {
  label: string;
  sub: string;
  Icon: ComponentType<{ className?: string }>;
  color: string;
  gradientBg: string;
  count: number;
  amount: number;
}

interface NormalStep {
  merged: false;
  key: string;
  label: string;
  sub: string;
  Icon: ComponentType<{ className?: string }>;
  color: string;
  gradientBg: string;
  count: number;
  amount: number;
  crLabel: string | null;
  crNum: number | null;
  crDen: number | null;
}

interface MergedStep {
  merged: true;
  key: string;
  crLabel: string;
  crNum: number;
  crDen: number;
  items: StageItem[];
}

type Step = NormalStep | MergedStep;

function crRatio(num: number, den: number): number {
  if (den === 0) return 0;
  return (num / den) * 100;
}

function crColor(pct: number): string {
  if (pct >= 60) return 'hsl(155 72% 38%)';
  if (pct >= 30) return 'hsl(38 96% 48%)';
  return 'hsl(0 70% 52%)';
}

function crBadgeCls(pct: number): string {
  if (pct >= 60) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400';
  if (pct >= 30) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
}

function fmtINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function CRPanel({ label, num, den, ratio }: { label: string; num: number; den: number; ratio: number }) {
  return (
    <>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] sm:text-[13px] font-medium text-muted-foreground leading-tight">{label}</p>
        <p className="text-[12px] sm:text-[13px] text-muted-foreground/60 mt-0.5">{num} / {den}</p>
        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden w-full max-w-[60px]">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(ratio, 100)}%`, background: crColor(ratio) }} />
        </div>
      </div>
      <span className={`shrink-0 inline-block px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[20px] sm:text-[28px] font-bold ${crBadgeCls(ratio)}`}>
        {ratio.toFixed(1)}%
      </span>
    </>
  );
}

export default function SalesSummary({ members, userId, isAdmin = true, filterUserId, dateFrom, dateTo }: SalesSummaryProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [totalSalesPrice, setTotalSalesPrice] = useState(0);
  const [loading, setLoading] = useState(true);

  const hasFilter = !!(filterUserId || dateFrom || dateTo);

  // Use the exact same financial date and repeat-order rules as Sales Dashboard.
  useEffect(() => {
    let cancelled = false;

    const applySalesTotal = () => {
      const allLeads = MecaCache.getDashLeads();
      const allActivities = MecaCache.getDashActivities();
      const allOrders = MecaCache.getDashOrders();
      const leadOwners = MecaCache.getLeadOwners();
      if (!allLeads || !allActivities || !allOrders || !leadOwners || cancelled) return;

      const targetUserId = filterUserId ?? (isAdmin ? undefined : userId);
      const userLeads = targetUserId
        ? allLeads.filter((lead) => lead.assigned_to === targetUserId)
        : allLeads;
      const userLeadIds = new Set(userLeads.map((lead) => lead.id));
      const userActivities = allActivities.filter((activity) => userLeadIds.has(activity.lead_id));
      const ownerByLead = new Map(leadOwners.map((owner) => [owner.id, owner.assigned_to]));
      const userOrders = targetUserId
        ? allOrders.filter((order) => ownerByLead.get(order.lead_id) === targetUserId)
        : allOrders;

      const financeLeads = filterFinanceLeads(userLeads, userActivities, dateFrom, dateTo);
      const financeOrders = filterFinanceOrders(userOrders, dateFrom, dateTo);
      setTotalSalesPrice(sumTotalSales(financeLeads, financeOrders));
    };

    const unsubscribe = MecaCache.onUpdate(applySalesTotal);
    const initialize = async () => {
      if (!MecaCache.getDashLeads() && userId) {
        await MecaCache.prefetch(userId, isAdmin);
      } else {
        const pending = MecaCache.awaitPrefetch();
        if (pending) await pending;
      }
      applySalesTotal();
    };
    initialize();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, isAdmin, filterUserId, dateFrom, dateTo]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    if (hasFilter) {
      // Use get_analytics_aggregates when filters are active — supports user + date range
      const targetUser = filterUserId ?? (isAdmin ? null : userId);
      supabase.rpc('get_analytics_aggregates', {
        p_user_id:   targetUser ?? null,
        p_date_from: dateFrom ? dateFrom.toISOString() : null,
        p_date_to:   dateTo   ? dateTo.toISOString()   : null,
      }).then(({ data }) => {
        if (data) {
          const agg = data as any;
          const f: Record<string, number> = agg.funnel ?? {};
          const fa: Record<string, number> = agg.funnel_amount ?? {};
          // Map agg.funnel → same shape as get_lead_stage_counts
          const mapped: Record<string, number> = {
            all:             agg.total ?? 0,
            not_interested:  0,
            lead_capture:    f.lead_capture    ?? 0,
            qualification:   f.qualification   ?? 0,
            need_analysis:   f.need_analysis   ?? 0,
            proposal:        f.proposal        ?? 0,
            negotiation:     f.negotiation     ?? 0,
            closure_order_1: f.closure_order_1 ?? 0,
            delivered:       f.delivered       ?? 0,
            post_sale:       f.post_sale       ?? 0,
            lost_rejected:   f.lost_rejected   ?? 0,
          };
          setCounts(mapped);
          setAmounts({
            lead_capture:    Number(fa.lead_capture    ?? 0),
            qualification:   Number(fa.qualification   ?? 0),
            need_analysis:   Number(fa.need_analysis   ?? 0),
            proposal:        Number(fa.proposal        ?? 0),
            negotiation:     Number(fa.negotiation     ?? 0),
            closure_order_1: Number(fa.closure_order_1 ?? 0),
            delivered:       Number(fa.delivered       ?? 0),
            post_sale:       Number(fa.post_sale       ?? 0),
          });
        }
        setLoading(false);
      });
    } else {
      // No filters — use fast get_lead_stage_counts RPC (unchanged path)
      supabase.rpc('get_lead_stage_counts', { p_user_id: userId, p_is_admin: isAdmin })
        .then((countsRes) => {
        if (countsRes.data) {
          const { amounts: stageAmounts, ...stageCounts } = countsRes.data as Record<string, any>;
          setCounts(stageCounts as Record<string, number>);
          setAmounts((stageAmounts ?? {}) as Record<string, number>);
        }
        setLoading(false);
      });
    }
  }, [userId, isAdmin, filterUserId, dateFrom, dateTo]); // eslint-disable-line

  const c = useMemo(() => ({
    inquiry:        (counts['all'] ?? 0) + (counts['not_interested'] ?? 0),
    leadCapture:    counts['lead_capture']    ?? 0,
    qualification:  counts['qualification']   ?? 0,
    needAnalysis:   counts['need_analysis']   ?? 0,
    proposal:       counts['proposal']        ?? 0,
    negotiation:    counts['negotiation']     ?? 0,
    orderWon:       counts['closure_order_1'] ?? 0,
    activeCustomer: (counts['qualification'] ?? 0) + (counts['need_analysis'] ?? 0)
                  + (counts['proposal'] ?? 0) + (counts['negotiation'] ?? 0),
    lost:           counts['lost_rejected']   ?? 0,
  }), [counts]);

  // Revenue sitting at each stage — quoted_amount for pipeline stages, the
  // lead's own closed_amount for Order Won (see get_lead_stage_counts /
  // get_analytics_aggregates RPCs).
  const a = useMemo(() => ({
    leadCapture:    amounts['lead_capture']    ?? 0,
    qualification:  amounts['qualification']   ?? 0,
    needAnalysis:   amounts['need_analysis']   ?? 0,
    proposal:       amounts['proposal']        ?? 0,
    negotiation:    amounts['negotiation']     ?? 0,
    orderWon:       amounts['closure_order_1'] ?? 0,
    activeCustomer: (amounts['qualification'] ?? 0) + (amounts['need_analysis'] ?? 0)
                  + (amounts['proposal'] ?? 0) + (amounts['negotiation'] ?? 0),
  }), [amounts]);

  // ── 6 rows (last row merges Negotiation + Order Won) ──────────────────────
  const steps: Step[] = [
    {
      merged: false,
      key: 'inquiry',
      label: 'Inquiry',
      sub: 'All leads in pipeline',
      Icon: LayoutList,
      color: 'hsl(200 78% 50%)',
      gradientBg: 'var(--gradient-calling)',
      count: c.inquiry,
      amount: a.leadCapture + a.activeCustomer + a.orderWon,
      crLabel: 'Inquiry to Lead',
      crNum: c.leadCapture,
      crDen: c.inquiry,
    },
    {
      merged: false,
      key: 'leads',
      label: 'Leads',
      sub: 'Lead capture stage',
      Icon: Users2,
      color: 'hsl(200 80% 52%)',
      gradientBg: 'linear-gradient(135deg,hsl(200,80%,55%),hsl(215,80%,60%))',
      count: c.leadCapture,
      amount: a.leadCapture,
      crLabel: 'Lead to Active',
      crNum: c.activeCustomer,
      crDen: c.leadCapture,
    },
    {
      merged: false,
      key: 'active_customer',
      label: 'Active Leads',
      sub: 'Progressed past capture',
      Icon: UserCheck,
      color: 'hsl(160 68% 42%)',
      gradientBg: 'var(--gradient-delivery)',
      count: c.activeCustomer,
      amount: a.activeCustomer,
      crLabel: 'Active to Meeting / Needs Analysis',
      crNum: c.needAnalysis,
      crDen: c.activeCustomer,
    },
    {
      merged: false,
      key: 'need_analysis',
      label: 'Meeting / Needs Analysis',
      sub: 'Need analysis stage',
      Icon: Handshake,
      color: 'hsl(265 78% 58%)',
      gradientBg: 'var(--gradient-walkin)',
      count: c.needAnalysis,
      amount: a.needAnalysis,
      crLabel: 'Meeting to Proposal',
      crNum: c.proposal,
      crDen: c.needAnalysis,
    },
    {
      merged: false,
      key: 'proposal',
      label: 'Proposal Sent',
      sub: 'Proposal stage',
      Icon: FileText,
      color: 'hsl(38 96% 50%)',
      gradientBg: 'linear-gradient(135deg,hsl(38,96%,52%),hsl(28,92%,55%))',
      count: c.proposal,
      amount: a.proposal,
      crLabel: 'Proposal to Negotiation',
      crNum: c.negotiation,
      crDen: c.proposal,
    },
    {
      merged: true,
      key: 'negotiation_order_won',
      crLabel: 'Negotiation to Order Won',
      crNum: c.orderWon,
      crDen: c.negotiation || 1,
      items: [
        {
          label: 'Negotiation',
          sub: 'Negotiation stage',
          Icon: TrendingUp,
          color: 'hsl(25 92% 52%)',
          gradientBg: 'linear-gradient(135deg,hsl(25,92%,55%),hsl(15,88%,50%))',
          count: c.negotiation,
          amount: a.negotiation,
        },
        {
          label: 'Order Won',
          sub: 'Order won stage',
          Icon: Trophy,
          color: 'hsl(155 72% 40%)',
          gradientBg: 'var(--gradient-booking)',
          count: c.orderWon,
          amount: a.orderWon,
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-10 w-10 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4"
        style={{ background: 'var(--gradient-header)' }}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--blob-primary), transparent 70%)' }} />
        <div className="flex items-center gap-2 sm:gap-3 relative min-w-0">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary/15 flex items-center justify-center text-[16px] sm:text-[18px] font-bold text-primary shrink-0">
            👥
          </div>
          <div className="min-w-0">
            <p className="text-[15px] sm:text-[17px] font-bold text-foreground truncate">
              {filterUserId
                ? (members.find(m => m.user_id === filterUserId)?.full_name ?? 'Sales Person')
                : 'All Team'}
            </p>
            <p className="text-[11px] sm:text-[12px] text-muted-foreground mt-0.5 truncate">
              {dateFrom || dateTo
                ? `${dateFrom ? dateFrom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Start'} – ${dateTo ? dateTo.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Today'}`
                : 'All time'
              } &nbsp;·&nbsp;{c.inquiry} leads · {c.lost} lost
            </p>
          </div>
        </div>
        <div className="relative text-right shrink-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Sales</p>
          <p className="text-[22px] sm:text-[30px] font-bold text-primary">
            ₹{totalSalesPrice >= 1_00_00_000
              ? `${(totalSalesPrice / 1_00_00_000).toFixed(2)}Cr`
              : totalSalesPrice >= 1_00_000
              ? `${(totalSalesPrice / 1_00_000).toFixed(2)}L`
              : totalSalesPrice.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-2 gap-2.5 px-0.5">
        <div className="flex items-center gap-2 px-1">
          <div className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'var(--gradient-calling)' }}>
            <LayoutList className="h-3 w-3 text-white" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Sales Summary</span>
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'var(--gradient-booking)' }}>
            <ArrowRight className="h-3 w-3 text-white" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Conversion Ratio</span>
        </div>
      </div>

      {/* ── Step cards ── */}
      <div className="space-y-2.5">
        {steps.map((step) => {
          /* ── Merged card (Negotiation + Order Won) ── */
          if (step.merged) {
            const ratio = crRatio(step.crNum, step.crDen);
            return (
              <Card key={step.key}
                className="border-0 rounded-2xl shadow-sm overflow-hidden transition-transform hover:scale-[1.005]">
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 divide-x divide-border/40">
                    {/* Left — two stages stacked */}
                    <div className="px-4 py-3 space-y-3">
                      {step.items.map((item) => {
                        const ItemIcon = item.Icon;
                        return (
                          <div key={item.label} className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: item.gradientBg }}>
                              <ItemIcon className="h-4 w-4 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-medium text-muted-foreground truncate">{item.sub}</p>
                              <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{item.label}</p>
                              <p className="text-[20px] sm:text-[24px] font-bold leading-tight tracking-tight" style={{ color: item.color }}>
                                {item.count}
                              </p>
                              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground/70 truncate">{fmtINR(item.amount)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Right — single CR centred vertically */}
                    <div className="flex items-center justify-between gap-2 px-4 py-4">
                      <CRPanel label={step.crLabel} num={step.crNum} den={step.crDen} ratio={ratio} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }

          /* ── Normal card ── */
          const ratio = step.crNum !== null && step.crDen !== null
            ? crRatio(step.crNum, step.crDen)
            : null;
          const { Icon } = step;
          return (
            <Card key={step.key}
              className="border-0 rounded-2xl shadow-sm overflow-hidden transition-transform hover:scale-[1.005]">
              <CardContent className="p-0">
                <div className="grid grid-cols-2 divide-x divide-border/40 min-h-[88px]">
                  {/* Left — stage info */}
                  <div className="flex items-center gap-3.5 px-4 py-4">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: step.gradientBg }}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground truncate">{step.sub}</p>
                      <p className="text-[14px] font-semibold text-foreground leading-tight truncate">{step.label}</p>
                      <p className="text-[22px] sm:text-[28px] font-bold leading-tight tracking-tight" style={{ color: step.color }}>
                        {step.count}
                      </p>
                      <p className="text-[11px] font-medium text-muted-foreground/70 truncate">{fmtINR(step.amount)}</p>
                    </div>
                  </div>
                  {/* Right — CR panel or empty */}
                  <div className="flex items-center justify-between gap-2 px-4 py-4">
                    {ratio !== null && step.crNum !== null && step.crDen !== null && step.crLabel ? (
                      <CRPanel label={step.crLabel} num={step.crNum} den={step.crDen} ratio={ratio} />
                    ) : (
                      <div className="flex-1" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer summary */}
      <Card className="border-0 rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(220 40% 14%), hsl(235 35% 20%))' }}>
        <CardContent className="p-4 space-y-3">
          {/* Row 1: key totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
            {[
              { label: 'Total Leads',     value: c.inquiry,        color: 'hsl(200 78% 65%)' },
              { label: 'Order Won',       value: c.orderWon,       color: 'hsl(155 72% 55%)' },
              { label: 'Lost Leads',      value: c.lost,           color: 'hsl(0 70% 65%)' },
              { label: 'Active Pipeline', value: c.activeCustomer, color: 'hsl(38 96% 65%)' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{s.label}</p>
                <p className="text-[18px] sm:text-[22px] font-bold mt-0.5" style={{ color: s.color }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          {/* Divider */}
          <div className="border-t border-white/10" />
          {/* Row 2: per-stage breakdown */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Lead',          value: c.leadCapture,   color: 'hsl(200 80% 60%)' },
              { label: 'Qual. Lead',    value: c.qualification, color: 'hsl(215 80% 62%)' },
              { label: 'Needs Analysis',value: c.needAnalysis,  color: 'hsl(265 78% 68%)' },
              { label: 'Proposal',      value: c.proposal,      color: 'hsl(38 96% 62%)' },
              { label: 'Negotiation',   value: c.negotiation,   color: 'hsl(25 92% 62%)' },
              { label: 'Order Won',     value: c.orderWon,      color: 'hsl(155 72% 55%)' },
              { label: 'Post-Sale',     value: counts['post_sale'] ?? 0, color: 'hsl(180 60% 55%)' },
              { label: 'Lost',          value: c.lost,          color: 'hsl(0 70% 65%)' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[9px] font-medium uppercase tracking-wider text-white/35 leading-tight">{s.label}</p>
                <p className="text-[15px] sm:text-[17px] font-bold mt-0.5" style={{ color: s.color }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
