/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Banknote, Bot, BrainCircuit, CalendarClock, Check, IndianRupee, Plus, Receipt, RefreshCw, Sparkles, Target, TrendingUp, TriangleAlert, WalletCards } from 'lucide-react';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const nice = (value: string) => value?.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

type Data = {
  tasks: any[]; leads: any[]; milestones: any[]; projects: any[]; pnl: any[];
  ageing: any[]; cashflow: any[]; expenses: any[]; categories: any[];
  receipts: any[]; insights: any[]; velocity: any[];
};

const emptyData: Data = { tasks: [], leads: [], milestones: [], projects: [], pnl: [], ageing: [], cashflow: [], expenses: [], categories: [], receipts: [], insights: [], velocity: [] };

export default function GrowthEngine() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [expense, setExpense] = useState({ project_id: '', category_id: '', vendor: '', description: '', amount: '', gst: '', paid_on: new Date().toISOString().slice(0, 10), mode: 'bank_transfer', is_billable: 'false' });
  const [receipt, setReceipt] = useState({ milestone_id: '', amount: '', received_on: new Date().toISOString().slice(0, 10), mode: 'bank_transfer', utr_ref: '', notes: '' });

  const load = async () => {
    setLoading(true); setError('');
    const results = await Promise.all([
      supabase.from('b2g_tasks' as any).select('*,b2g_leads(organization_name)').is('completed_at', null).order('due_at'),
      supabase.from('b2g_leads' as any).select('id,organization_name,pipeline,stage,proposal_value,expected_revenue,probability,ai_score,last_activity_at,next_follow_up_at,stalled_since,next_best_action').is('closed_at', null),
      supabase.from('b2g_payment_milestones' as any).select('*,b2g_projects(project_name,lead_id,b2g_leads(organization_name))').order('due_date'),
      supabase.from('b2g_projects' as any).select('id,project_name,contract_value,payment_model,delivery_risk,b2g_leads(organization_name)').order('created_at', { ascending: false }),
      supabase.from('b2g_project_pnl' as any).select('*').order('margin_pct'),
      supabase.from('b2g_ageing_receivables' as any).select('*').order('due_date'),
      supabase.from('b2g_cashflow_forecast' as any).select('*').order('forecast_month'),
      supabase.from('b2g_expenses' as any).select('*,expense_categories(name),b2g_projects(project_name)').order('paid_on', { ascending: false }).limit(100),
      supabase.from('expense_categories' as any).select('*').eq('is_active', true).order('name'),
      supabase.from('b2g_payment_receipts' as any).select('*,b2g_payment_milestones(milestone_name,b2g_projects(project_name))').order('received_on', { ascending: false }).limit(100),
      supabase.from('b2g_ai_insights' as any).select('*,b2g_leads(organization_name)').order('generated_at', { ascending: false }).limit(100),
      supabase.from('b2g_funnel_velocity' as any).select('*').order('pipeline'),
    ]);
    const firstError = results.find(result => result.error)?.error;
    if (firstError) setError(firstError.message);
    setData({
      tasks: results[0].data || [], leads: results[1].data || [], milestones: results[2].data || [], projects: results[3].data || [],
      pnl: results[4].data || [], ageing: results[5].data || [], cashflow: results[6].data || [], expenses: results[7].data || [],
      categories: results[8].data || [], receipts: results[9].data || [], insights: results[10].data || [], velocity: results[11].data || [],
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const actionRows = useMemo(() => {
    const tasks = data.tasks.map(row => ({ id: `task-${row.id}`, kind: 'Task', title: row.title, account: row.b2g_leads?.organization_name || 'Internal', due: row.due_at, value: 0, urgency: new Date(row.due_at) < new Date() ? 3 : 2 }));
    const payments = data.milestones.filter(row => Number(row.amount_received) < Number(row.amount) + Number(row.gst_amount)).map(row => ({ id: `payment-${row.id}`, kind: 'Collection', title: row.milestone_name, account: row.b2g_projects?.b2g_leads?.organization_name || row.b2g_projects?.project_name, due: row.due_date, value: Number(row.amount) + Number(row.gst_amount) - Number(row.amount_received), urgency: row.due_date && row.due_date < today ? 4 : 2 }));
    const followups = data.leads.filter(row => row.next_follow_up_at).map(row => ({ id: `lead-${row.id}`, kind: 'Follow-up', title: row.next_best_action || 'Client follow-up', account: row.organization_name, due: row.next_follow_up_at, value: Number(row.expected_revenue), urgency: row.next_follow_up_at?.slice(0, 10) <= today ? 3 : 1 }));
    return [...tasks, ...payments, ...followups].sort((a, b) => (b.value * b.urgency) - (a.value * a.urgency));
  }, [data, today]);

  const stats = useMemo(() => ({
    weighted: data.leads.reduce((sum, row) => sum + Number(row.expected_revenue || 0), 0),
    outstanding: data.ageing.reduce((sum, row) => sum + Number(row.outstanding || 0), 0),
    overdue: data.ageing.filter(row => row.ageing_bucket !== 'not_due').reduce((sum, row) => sum + Number(row.outstanding || 0), 0),
    receipts: data.receipts.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    expenses: data.expenses.reduce((sum, row) => sum + Number(row.amount || 0) + Number(row.gst || 0), 0),
    stalled: data.leads.filter(row => row.stalled_since).length,
  }), [data]);

  const saveExpense = async () => {
    const { error: saveError } = await supabase.from('b2g_expenses' as any).insert({ ...expense, project_id: expense.project_id || null, category_id: expense.category_id || null, amount: Number(expense.amount), gst: Number(expense.gst || 0), is_billable: expense.is_billable === 'true', created_by: user?.id });
    if (saveError) return toast({ title: 'Expense not saved', description: saveError.message, variant: 'destructive' });
    setExpenseOpen(false); toast({ title: 'Expense recorded' }); load();
  };

  const saveReceipt = async () => {
    const { error: saveError } = await supabase.from('b2g_payment_receipts' as any).insert({ ...receipt, amount: Number(receipt.amount), created_by: user?.id });
    if (saveError) return toast({ title: 'Receipt not saved', description: saveError.message, variant: 'destructive' });
    setReceiptOpen(false); toast({ title: 'Payment receipt recorded' }); load();
  };

  const runAutomations = async () => {
    setRunning(true);
    const [automation, insights] = await Promise.all([supabase.rpc('run_b2g_automations' as any), supabase.rpc('refresh_b2g_rule_based_insights' as any)]);
    setRunning(false);
    if (automation.error || insights.error) toast({ title: 'Automation failed', description: automation.error?.message || insights.error?.message, variant: 'destructive' });
    else { toast({ title: 'Automations completed', description: 'Escalations, reminders, expiry, stall detection and rescue insights refreshed.' }); load(); }
  };

  const createMilestones = async (projectId: string) => {
    const { data: count, error: rpcError } = await supabase.rpc('generate_payment_milestones' as any, { target_project: projectId });
    if (rpcError) toast({ title: 'Milestones not generated', description: rpcError.message, variant: 'destructive' });
    else { toast({ title: `${count || 0} milestone(s) generated` }); load(); }
  };

  const reviewInsight = async (id: string, status: 'approved' | 'dismissed' | 'acted') => {
    await supabase.from('b2g_ai_insights' as any).update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  if (loading) return <div className="p-7"><div className="h-96 rounded-2xl bg-muted/50 animate-pulse" /></div>;

  return <div className="min-h-full bg-slate-50/60 p-4 md:p-7 space-y-6">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div><p className="text-xs font-bold tracking-wider text-primary">CRM GROWTH ENGINE</p><h1 className="text-3xl font-bold mt-1">Decision cockpit</h1><p className="text-muted-foreground">Actions, cash flow, profitability, pipeline velocity and AI suggestions</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button><Button onClick={runAutomations} disabled={running}><Sparkles className="h-4 w-4 mr-2" />{running ? 'Running…' : 'Run automations'}</Button></div>
    </div>
    {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><TriangleAlert className="inline h-4 w-4 mr-2" />Deploy the growth-engine migration to unlock this screen: {error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <Metric icon={Target} label="Weighted pipeline" value={money(stats.weighted)} tone="indigo" />
      <Metric icon={WalletCards} label="Outstanding" value={money(stats.outstanding)} tone="amber" />
      <Metric icon={TriangleAlert} label="Overdue" value={money(stats.overdue)} tone="rose" />
      <Metric icon={Banknote} label="Receipts logged" value={money(stats.receipts)} tone="emerald" />
      <Metric icon={Receipt} label="Expenses" value={money(stats.expenses)} tone="slate" />
      <Metric icon={Activity} label="Stalled deals" value={String(stats.stalled)} tone="violet" />
    </div>

    <Tabs defaultValue="actions" className="space-y-4">
      <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="actions">Daily actions</TabsTrigger><TabsTrigger value="cash">Cash & ageing</TabsTrigger><TabsTrigger value="profit">Profitability</TabsTrigger><TabsTrigger value="funnel">Funnel velocity</TabsTrigger><TabsTrigger value="ai">AI review desk</TabsTrigger></TabsList>
      <TabsContent value="actions"><Card className="border-0 shadow-sm"><CardContent className="p-5"><h2 className="font-bold text-lg">Today, overdue and tomorrow</h2><p className="text-xs text-muted-foreground mb-4">Ranked by money at stake and urgency</p><div className="space-y-2">{actionRows.slice(0, 20).map(row => <div key={row.id} className="flex items-center gap-3 rounded-xl border p-3"><Badge variant={row.due?.slice(0, 10) < today ? 'destructive' : 'secondary'}>{row.kind}</Badge><div className="flex-1 min-w-0"><p className="font-semibold truncate">{row.account}</p><p className="text-xs text-muted-foreground truncate">{row.title} · {row.due?.slice(0, 10) === tomorrow ? 'Tomorrow' : date(row.due)}</p></div>{row.value > 0 && <p className="font-bold">{money(row.value)}</p>}</div>)}{!actionRows.length && <Empty text="No pending actions" />}</div></CardContent></Card></TabsContent>
      <TabsContent value="cash" className="space-y-4">
        <div className="flex flex-wrap gap-2"><ReceiptDialog open={receiptOpen} setOpen={setReceiptOpen} receipt={receipt} setReceipt={setReceipt} milestones={data.milestones} save={saveReceipt} /><ExpenseDialog open={expenseOpen} setOpen={setExpenseOpen} expense={expense} setExpense={setExpense} projects={data.projects} categories={data.categories} save={saveExpense} /></div>
        <div className="grid xl:grid-cols-2 gap-4"><Card className="border-0 shadow-sm"><CardContent className="p-5"><h2 className="font-bold">Cash-flow forecast</h2><div className="space-y-3 mt-4">{data.cashflow.map(row => <div key={row.forecast_month} className="grid grid-cols-4 items-center text-sm border-b pb-3"><span>{date(row.forecast_month)}</span><span className="text-emerald-700">+{money(row.expected_inflow)}</span><span className="text-rose-700">−{money(row.expected_outflow)}</span><strong>{money(row.net_cashflow)}</strong></div>)}{!data.cashflow.length && <Empty text="No forecast data" />}</div></CardContent></Card><Card className="border-0 shadow-sm"><CardContent className="p-5"><h2 className="font-bold">Ageing receivables</h2><div className="space-y-2 mt-4">{data.ageing.map(row => <div key={row.milestone_id} className="flex items-center gap-3 border-b pb-3"><Badge variant={row.ageing_bucket === '90_plus' ? 'destructive' : 'secondary'}>{nice(row.ageing_bucket)}</Badge><div className="flex-1"><p className="font-semibold">{row.organization_name}</p><p className="text-xs text-muted-foreground">{row.project_name} · due {date(row.due_date)}</p></div><strong>{money(row.outstanding)}</strong></div>)}{!data.ageing.length && <Empty text="No outstanding receivables" />}</div></CardContent></Card></div>
      </TabsContent>
      <TabsContent value="profit"><div className="space-y-3">{data.pnl.map(row => <Card key={row.project_id} className="border-0 shadow-sm"><CardContent className="p-5 grid md:grid-cols-6 gap-3 items-center"><div className="md:col-span-2"><p className="font-bold">{row.project_name}</p><p className="text-xs text-muted-foreground">Project profitability</p></div><Value label="Contract" value={money(row.contract_value)} /><Value label="Receipts" value={money(row.receipts)} /><Value label="Actual cost" value={money(row.actual_cost)} /><div><p className={`text-lg font-extrabold ${Number(row.margin_pct) < 20 ? 'text-rose-600' : 'text-emerald-600'}`}>{money(row.margin_amount)}</p><p className="text-xs text-muted-foreground">{row.margin_pct}% margin</p></div></CardContent></Card>)}{!data.pnl.length && <Empty text="Create projects to calculate profitability" />}</div></TabsContent>
      <TabsContent value="funnel"><div className="grid xl:grid-cols-2 gap-4"><Card className="border-0 shadow-sm"><CardContent className="p-5"><h2 className="font-bold">Average days in stage</h2><div className="space-y-3 mt-4">{data.velocity.map((row, index) => <div key={`${row.pipeline}-${row.stage}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 border-b pb-3"><div><p className="font-semibold">{nice(row.stage)}</p><p className="text-xs text-muted-foreground">{nice(row.pipeline)} · {row.entries} entries</p></div><strong>{row.avg_days_in_stage} days</strong></div>)}{!data.velocity.length && <Empty text="Velocity appears after stage changes" />}</div></CardContent></Card><Card className="border-0 shadow-sm"><CardContent className="p-5"><h2 className="font-bold">Milestone setup</h2><p className="text-xs text-muted-foreground mb-4">One click creates advance/balance schedules from each payment model.</p><div className="space-y-2">{data.projects.map(project => <div key={project.id} className="flex items-center gap-3 rounded-xl border p-3"><div className="flex-1"><p className="font-semibold">{project.project_name}</p><p className="text-xs text-muted-foreground">{project.b2g_leads?.organization_name} · {nice(project.payment_model)}</p></div><Button size="sm" variant="outline" onClick={() => createMilestones(project.id)}><Plus className="h-3.5 w-3.5 mr-1" />Generate</Button></div>)}</div></CardContent></Card></div></TabsContent>
      <TabsContent value="ai"><div className="space-y-3">{data.insights.map(insight => <Card key={insight.id} className="border-0 shadow-sm"><CardContent className="p-5"><div className="flex items-start gap-3"><div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center"><BrainCircuit className="h-5 w-5" /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{insight.title}</h3><Badge variant="secondary">{nice(insight.insight_type)}</Badge><Badge>{nice(insight.status)}</Badge></div><p className="text-sm text-muted-foreground mt-2">{insight.narrative}</p><p className="text-xs text-muted-foreground mt-2">Generated {date(insight.generated_at)} · human approval required</p>{insight.status === 'suggested' && <div className="flex gap-2 mt-4"><Button size="sm" onClick={() => reviewInsight(insight.id, 'approved')}><Check className="h-3.5 w-3.5 mr-1" />Approve</Button><Button size="sm" variant="outline" onClick={() => reviewInsight(insight.id, 'dismissed')}>Dismiss</Button></div>}</div></div></CardContent></Card>)}{!data.insights.length && <Empty text="Run automations to generate the first rescue insights" />}</div></TabsContent>
    </Tabs>
  </div>;
}

const toneClass: Record<string, string> = { indigo: 'text-indigo-600', amber: 'text-amber-600', rose: 'text-rose-600', emerald: 'text-emerald-600', slate: 'text-slate-600', violet: 'text-violet-600' };
function Metric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) { return <Card className="border-0 shadow-sm"><CardContent className="p-4"><Icon className={`h-5 w-5 ${toneClass[tone] || 'text-primary'}`} /><p className="font-extrabold text-lg mt-4 break-words">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>; }
function Value({ label, value }: { label: string; value: string }) { return <div><p className="font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center text-sm text-muted-foreground"><Bot className="h-7 w-7 mx-auto mb-2 opacity-40" />{text}</div>; }

function ReceiptDialog({ open, setOpen, receipt, setReceipt, milestones, save }: any) { return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Banknote className="h-4 w-4 mr-2" />Record receipt</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Record payment inflow</DialogTitle></DialogHeader><div className="space-y-3"><Select value={receipt.milestone_id} onValueChange={(value) => setReceipt({ ...receipt, milestone_id: value })}><SelectTrigger><SelectValue placeholder="Select milestone" /></SelectTrigger><SelectContent>{milestones.map((row: any) => <SelectItem key={row.id} value={row.id}>{row.b2g_projects?.project_name} — {row.milestone_name}</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-3"><Input type="number" placeholder="Amount received" value={receipt.amount} onChange={event => setReceipt({ ...receipt, amount: event.target.value })} /><Input type="date" value={receipt.received_on} onChange={event => setReceipt({ ...receipt, received_on: event.target.value })} /></div><Select value={receipt.mode} onValueChange={(value) => setReceipt({ ...receipt, mode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['bank_transfer', 'upi', 'cheque', 'cash', 'card', 'other'].map(value => <SelectItem key={value} value={value}>{nice(value)}</SelectItem>)}</SelectContent></Select><Input placeholder="UTR / reference" value={receipt.utr_ref} onChange={event => setReceipt({ ...receipt, utr_ref: event.target.value })} /><Textarea placeholder="Notes" value={receipt.notes} onChange={event => setReceipt({ ...receipt, notes: event.target.value })} /><Button className="w-full" disabled={!receipt.milestone_id || !receipt.amount} onClick={save}>Save receipt</Button></div></DialogContent></Dialog>; }

function ExpenseDialog({ open, setOpen, expense, setExpense, projects, categories, save }: any) { return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><Receipt className="h-4 w-4 mr-2" />Record expense</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Record business outflow</DialogTitle></DialogHeader><div className="space-y-3"><Select value={expense.project_id} onValueChange={(value) => setExpense({ ...expense, project_id: value })}><SelectTrigger><SelectValue placeholder="Project (optional)" /></SelectTrigger><SelectContent>{projects.map((row: any) => <SelectItem key={row.id} value={row.id}>{row.project_name}</SelectItem>)}</SelectContent></Select><Select value={expense.category_id} onValueChange={(value) => setExpense({ ...expense, category_id: value })}><SelectTrigger><SelectValue placeholder="Expense category" /></SelectTrigger><SelectContent>{categories.map((row: any) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select><Input placeholder="Vendor" value={expense.vendor} onChange={event => setExpense({ ...expense, vendor: event.target.value })} /><Textarea placeholder="Description" value={expense.description} onChange={event => setExpense({ ...expense, description: event.target.value })} /><div className="grid grid-cols-3 gap-3"><Input type="number" placeholder="Amount" value={expense.amount} onChange={event => setExpense({ ...expense, amount: event.target.value })} /><Input type="number" placeholder="GST" value={expense.gst} onChange={event => setExpense({ ...expense, gst: event.target.value })} /><Input type="date" value={expense.paid_on} onChange={event => setExpense({ ...expense, paid_on: event.target.value })} /></div><Button className="w-full" disabled={!expense.vendor || !expense.amount} onClick={save}>Save expense</Button></div></DialogContent></Dialog>; }
