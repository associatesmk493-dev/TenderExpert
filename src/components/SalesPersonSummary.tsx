import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users2, TrendingUp } from 'lucide-react';

interface Lead {
  assigned_to: string | null;
  funnel_stage: string;
  quoted_amount?: number | null;
  closed_amount?: number | null;
}

interface PersonStat {
  userId: string;
  name: string;
  shortName: string;
  inquiry: number;
  won: number;
  lost: number;
  active: number;
  quoteAmt: number;
  wonAmt: number;
}

interface SalesPersonSummaryProps {
  members: { user_id: string; full_name: string }[];
  leads: Lead[];
  wonLeads: Lead[];
}

// Active = Lead + Qualified Lead + Proposal Sent + Negotiation
const ACTIVE_STAGES = ['lead_capture', 'qualification', 'proposal', 'negotiation'];
// A sale remains won while it progresses through delivery and post-sale.
// Keep this aligned with SalesDashboard's ORDER_WON_STAGES.
const WON_STAGES = ['closure_order_1', 'delivered', 'post_sale'];
const LOST_STAGE = 'lost_rejected';

const INR = (n: number): string => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
};

const NUM = (n: number): string =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

// ── 3D bar custom shape ──────────────────────────────────────────────────────
interface Bar3DProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  value?: number;
  fmt?: (v: number) => string;
}

function Bar3D({ x = 0, y = 0, width = 0, height = 0, fill = '#888', value = 0, fmt }: Bar3DProps) {
  if (height <= 0 || width <= 0) return null;
  const d = Math.min(width * 0.2, 7);
  const label = fmt ? fmt(value) : String(value);
  return (
    <g>
      {/* Front face */}
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      {/* Top cap — lighter */}
      <polygon
        points={`${x},${y} ${x + d},${y - d} ${x + width + d},${y - d} ${x + width},${y}`}
        fill="rgba(255,255,255,0.36)"
      />
      {/* Right side — darker */}
      <polygon
        points={`${x + width},${y} ${x + width + d},${y - d} ${x + width + d},${y + height - d} ${x + width},${y + height}`}
        fill="rgba(0,0,0,0.22)"
      />
      {/* Value label */}
      {height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={9}
          fontWeight="bold"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ── Legend pill ──────────────────────────────────────────────────────────────
function LegendItem({ label, color }: { label: string; color: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <span className="h-2.5 w-4 rounded-sm shrink-0" style={{ background: color }} />
      {label}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SalesPersonSummary({ members, leads, wonLeads }: SalesPersonSummaryProps) {
  const stats = useMemo<PersonStat[]>(() => {
    return members
      .map((m) => {
        const mLeads = leads.filter((l) => l.assigned_to === m.user_id);
        // Won leads use the dashboard's finance/close-date range rather than
        // the lead-created range used by Inquiry, Active, and Lost.
        const mWonLeads = wonLeads.filter(
          (l) => l.assigned_to === m.user_id && WON_STAGES.includes(l.funnel_stage),
        );
        // A lead can have been created before the selected range and won inside
        // it, so keep the salesperson row even when its Inquiry count is zero.
        if (mLeads.length === 0 && mWonLeads.length === 0) return null;
        return {
          userId:    m.user_id,
          name:      m.full_name,
          shortName: m.full_name.split(' ')[0],
          inquiry:   mLeads.length,
          won:       mWonLeads.length,
          lost:      mLeads.filter((l) => l.funnel_stage === LOST_STAGE).length,
          active:    mLeads.filter((l) => ACTIVE_STAGES.includes(l.funnel_stage)).length,
          quoteAmt:  mLeads.reduce((s, l) => s + (l.quoted_amount ?? 0), 0),
          wonAmt:    mWonLeads.reduce((s, l) => s + (l.closed_amount ?? 0), 0),
        };
      })
      .filter((p): p is PersonStat => p !== null && p.inquiry > 0)
      .sort((a, b) => b.inquiry - a.inquiry);
  }, [leads, members, wonLeads]);

  if (stats.length === 0) {
    return (
      <Card className="border-0 rounded-2xl shadow-card">
        <CardContent className="p-10 text-center">
          <Users2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[15px] font-medium text-muted-foreground">No lead assignments yet</p>
        </CardContent>
      </Card>
    );
  }

  const cntMinW = Math.max(stats.length * 130, 480);
  const amtMinW = Math.max(stats.length * 110, 400);

  const TABLE_COLS = [
    { key: 'inquiry',  label: 'Inquiry',   color: 'hsl(200 78% 50%)', hdrClr: 'hsl(200 78% 85%)' },
    { key: 'won',      label: 'Won',        color: 'hsl(155 72% 40%)', hdrClr: 'hsl(155 72% 80%)' },
    { key: 'lost',     label: 'Lost',       color: 'hsl(0 70% 55%)',   hdrClr: 'hsl(0 70% 85%)' },
    { key: 'active',   label: 'Active',     color: 'hsl(38 96% 50%)',  hdrClr: 'hsl(38 96% 82%)' },
    { key: 'quoteAmt', label: 'Quote Amt',  color: 'hsl(265 78% 58%)', hdrClr: 'hsl(265 78% 85%)', amt: true },
    { key: 'wonAmt',   label: 'Won Amt',    color: 'hsl(155 72% 40%)', hdrClr: 'hsl(155 72% 80%)', amt: true },
  ] as const;

  return (
    <div className="space-y-5">

      {/* ── Summary Table ── */}
      <Card className="border-0 rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--gradient-calling)' }}>
            <Users2 className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-[15px] lg:text-[16px] font-bold text-foreground">Sales Person — Summary</h3>
        </div>

        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr style={{ background: 'var(--gradient-calling)' }}>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold text-white/90 uppercase tracking-wider">
                  Sales Person
                </th>
                {TABLE_COLS.map((col) => (
                  <th
                    key={col.key}
                    className="text-center px-3 py-3.5 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: col.hdrClr }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {stats.map((p, i) => (
                <tr
                  key={p.userId}
                  className={`transition-colors ${i % 2 === 0 ? 'bg-background hover:bg-muted/20' : 'bg-muted/25 hover:bg-muted/40'}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[12px] font-bold bg-primary/10 text-primary shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <span className="text-[13px] font-semibold text-foreground">{p.name}</span>
                    </div>
                  </td>
                  {TABLE_COLS.map((col) => {
                    const raw = p[col.key as keyof PersonStat] as number;
                    return (
                      <td key={col.key} className="px-3 py-3 text-center">
                        <span
                          className={col.amt ? 'text-[13px] font-bold' : 'text-[15px] font-bold'}
                          style={{ color: col.color }}
                        >
                          {col.amt ? INR(raw) : NUM(raw)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Lead Distribution — 3D Grouped Bar Chart ── */}
      <Card className="border-0 rounded-2xl shadow-card">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--gradient-walkin)' }}>
                <Users2 className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-[14px] font-bold text-foreground">Lead Distribution</h3>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <LegendItem label="Inquiry" color="hsl(200,78%,50%)" />
              <LegendItem label="Won"     color="hsl(155,72%,40%)" />
              <LegendItem label="Lost"    color="hsl(0,70%,55%)"   />
              <LegendItem label="Active"  color="hsl(38,96%,50%)"  />
            </div>
          </div>

          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: `${cntMinW}px`, height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats}
                  margin={{ top: 14, right: 20, left: -8, bottom: 55 }}
                  barCategoryGap="28%"
                  barGap={3}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false}
                    stroke="hsl(var(--border))" strokeOpacity={0.45} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                    height={55}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 10,
                      fontSize: 12,
                      padding: '6px 12px',
                    }}
                    formatter={(val: number, name: string) => {
                      const labels: Record<string, string> = {
                        inquiry: 'Inquiry', won: 'Won', lost: 'Lost', active: 'Active',
                      };
                      return [NUM(val), labels[name] ?? name];
                    }}
                    labelFormatter={(lbl) => stats.find((s) => s.shortName === lbl)?.name ?? lbl}
                  />
                  <Bar dataKey="inquiry" fill="hsl(200,78%,50%)" shape={<Bar3D />} maxBarSize={30} />
                  <Bar dataKey="won"     fill="hsl(155,72%,40%)" shape={<Bar3D />} maxBarSize={30} />
                  <Bar dataKey="lost"    fill="hsl(0,70%,55%)"   shape={<Bar3D />} maxBarSize={30} />
                  <Bar dataKey="active"  fill="hsl(38,96%,50%)"  shape={<Bar3D />} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Amount Distribution — 3D Grouped Bar Chart ── */}
      <Card className="border-0 rounded-2xl shadow-card">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--gradient-delivery)' }}>
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-[14px] font-bold text-foreground">Amount Distribution</h3>
            </div>
            <div className="flex gap-4">
              <LegendItem label="Quote Amt" color="hsl(265,78%,58%)" />
              <LegendItem label="Won Amt"   color="hsl(155,72%,40%)" />
            </div>
          </div>

          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: `${amtMinW}px`, height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats}
                  margin={{ top: 14, right: 20, left: 14, bottom: 55 }}
                  barCategoryGap="32%"
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false}
                    stroke="hsl(var(--border))" strokeOpacity={0.45} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                    height={55}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={INR}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 10,
                      fontSize: 12,
                      padding: '6px 12px',
                    }}
                    formatter={(val: number, name: string) => [
                      INR(val),
                      name === 'quoteAmt' ? 'Quote Amt' : 'Won Amt',
                    ]}
                    labelFormatter={(lbl) => stats.find((s) => s.shortName === lbl)?.name ?? lbl}
                  />
                  <Bar dataKey="quoteAmt" fill="hsl(265,78%,58%)" shape={<Bar3D fmt={INR} />} maxBarSize={42} />
                  <Bar dataKey="wonAmt"   fill="hsl(155,72%,40%)" shape={<Bar3D fmt={INR} />} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
