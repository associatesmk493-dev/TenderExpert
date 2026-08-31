import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, IndianRupee, Percent, TrendingUp, Users } from 'lucide-react';

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const closed = ['closed', 'completed', 'final_payment_received', 'order_received', 'order_conversion', 'approval_completed'];

export default function MarginAnalytics({ embedded = false }: { embedded?: boolean }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  useEffect(() => { Promise.all([
    supabase.from('b2g_leads' as any).select('*'),
    supabase.from('b2g_payment_milestones' as any).select('*'),
    supabase.from('profiles').select('user_id,full_name'),
  ]).then(([l, p, u]) => { setLeads(l.data || []); setPayments(p.data || []); setProfiles(u.data || []); }); }, []);

  const months = useMemo(() => {
    const actual = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const key = d.toISOString().slice(0, 7);
      return { key, label: d.toLocaleDateString('en-IN', { month: 'short' }), amount: payments.filter(p => p.received_at?.slice(0, 7) === key).reduce((a, p) => a + Number(p.amount_received), 0) };
    });
    return actual;
  }, [payments]);
  const stats = useMemo(() => {
    const won = leads.filter(l => closed.includes(l.stage));
    return {
      proposal: leads.reduce((a, l) => a + Number(l.proposal_value), 0),
      expected: leads.reduce((a, l) => a + Number(l.expected_revenue), 0),
      outstanding: payments.reduce((a, p) => a + Math.max(0, Number(p.amount) + Number(p.gst_amount) - Number(p.amount_received)), 0),
      conversion: leads.length ? won.length / leads.length * 100 : 0,
    };
  }, [leads, payments]);
  const max = Math.max(...months.map(m => m.amount), 1);
  const cards = [
    ['Monthly Revenue', money(months[5]?.amount), IndianRupee], ['Pipeline Value', money(stats.proposal), BarChart3],
    ['Expected Revenue', money(stats.expected), TrendingUp], ['Outstanding Payments', money(stats.outstanding), TrendingUp],
    ['Conversion Ratio', `${stats.conversion.toFixed(1)}%`, Percent],
  ] as const;
  const liveTeam = profiles.map(p => { const own = leads.filter(l => l.assigned_to === p.user_id), won = own.filter(l => closed.includes(l.stage)); return { name: p.full_name, total: own.length, hot: own.filter(l => l.heat === 'hot').length, won: won.length, value: won.reduce((a, l) => a + Number(l.proposal_value), 0) }; }).filter(x => x.total).sort((a, b) => b.value - a.value);
  const team = liveTeam;

  return <div className={embedded?'space-y-3':'min-h-full bg-slate-50/60 p-4 pb-28 md:p-7'}><div className="flex items-center gap-2"><p className="text-xs font-bold text-primary tracking-wider">REVENUE ANALYTICS</p></div>{embedded?<h2 className="text-xl font-bold">Revenue Dashboard</h2>:<h1 className="text-2xl sm:text-3xl font-bold mt-1">Revenue Dashboard</h1>}<p className="text-sm sm:text-base text-muted-foreground mb-6">Monthly revenue, pipeline health, collections and conversion</p>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{cards.map(([label, value, Icon]) => <Card key={label} className="border-0 shadow-sm last:col-span-2 lg:last:col-span-1"><CardContent className="p-4"><Icon className="h-5 w-5 text-primary mb-4"/><p className="text-lg sm:text-xl font-extrabold break-words">{value}</p><p className="text-xs text-muted-foreground mt-1">{label}</p></CardContent></Card>)}</div>
    <div className="grid lg:grid-cols-5 gap-5 mt-5"><Card className="lg:col-span-3 border-0 shadow-sm overflow-hidden"><CardContent className="p-4 sm:p-5"><h2 className="font-bold">Monthly Revenue</h2><div className="overflow-x-auto"><div className="h-56 min-w-[520px] flex items-end gap-4 mt-5">{months.map(m => <div key={m.key} className="flex-1 h-full flex flex-col justify-end items-center"><p className="text-[10px] font-semibold mb-2">{money(m.amount)}</p><div className="w-full max-w-14 rounded-t-xl bg-primary" style={{ height: `${Math.max(4, m.amount / max * 85)}%` }}/><p className="text-xs text-muted-foreground mt-2">{m.label}</p></div>)}</div></div></CardContent></Card>
      <Card className="lg:col-span-2 border-0 shadow-sm"><CardContent className="p-4 sm:p-5"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/><h2 className="font-bold">Team performance</h2></div><div className="space-y-3 mt-4">{team.map((t, i) => <div key={t.name} className="p-3 bg-slate-50 rounded-xl"><div className="flex justify-between"><p className="font-semibold text-sm">{t.name}</p>{i === 0 && <Badge>Top</Badge>}</div><p className="text-xs text-muted-foreground mt-1">{t.total} leads · {t.hot} hot · {t.won} converted</p><p className="font-bold mt-1">{money(t.value)}</p></div>)}{!team.length && <p className="text-sm text-muted-foreground py-8 text-center">Assign leads to view team performance.</p>}</div></CardContent></Card></div>
  </div>;
}
