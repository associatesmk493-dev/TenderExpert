import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BadgeIndianRupee, CheckCircle2, Clock3, IndianRupee, Pencil, Plus, ReceiptText, WalletCards } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const nice = (s: string) => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const blankProject = { lead_id: '', project_name: '', payment_model: '80_20', contract_value: '', gst_rate: '18', start_date: '', target_completion_date: '', status: 'active' };
const blankMilestone = { project_id: '', milestone_name: 'Advance', sequence_no: '1', percentage: '80', amount: '', gst_amount: '', due_date: '' };
const splitModels: Record<string, number[]> = { '80_20': [80, 20], '70_30': [70, 30], '50_50': [50, 50] };

export default function Orders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [projectOpen, setProjectOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [receiptRow, setReceiptRow] = useState<any>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [project, setProject] = useState(blankProject);
  const [milestone, setMilestone] = useState(blankMilestone);
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([
    supabase.from('b2g_payment_milestones' as any).select('*,b2g_projects(project_name,payment_model,contract_value)').order('due_date'),
    supabase.from('b2g_projects' as any).select('*,b2g_leads(organization_name)').order('created_at', { ascending: false }),
    supabase.from('b2g_leads' as any).select('id,organization_name').order('organization_name'),
  ]).then(([m, p, l]) => { setRows(m.data || []); setProjects(p.data || []); setLeads(l.data || []); });
  useEffect(() => { load(); }, []);

  const openNewProject = () => { setEditingProjectId(null); setProject(blankProject); setProjectOpen(true); };
  const openEditProject = (p: any) => {
    setEditingProjectId(p.id);
    setProject({ lead_id: p.lead_id, project_name: p.project_name, payment_model: p.payment_model, contract_value: String(p.contract_value), gst_rate: String(p.gst_rate), start_date: p.start_date || '', target_completion_date: p.target_completion_date || '', status: p.status });
    setProjectOpen(true);
  };
  const saveProject = async () => {
    if (!project.lead_id || !project.project_name.trim() || Number(project.contract_value) <= 0) { toast({ title: 'Client, project name and valid contract value are required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = { ...project, contract_value: Number(project.contract_value || 0), gst_rate: Number(project.gst_rate || 18), start_date: project.start_date || null, target_completion_date: project.target_completion_date || null };
    const result = editingProjectId
      ? await supabase.from('b2g_projects' as any).update(payload).eq('id', editingProjectId)
      : await supabase.from('b2g_projects' as any).insert({ ...payload, created_by: user?.id }).select('id').single();
    if (result.error) { setSaving(false); toast({ title: 'Project could not be saved', description: result.error.message, variant: 'destructive' }); return; }
    const projectId = editingProjectId || (result.data as any)?.id;
    const split = splitModels[project.payment_model];
    if (!editingProjectId && projectId && split) {
      const contract = Number(project.contract_value || 0);
      const gstRate = Number(project.gst_rate || 18);
      const completionDate = project.target_completion_date || project.start_date || new Date().toISOString().slice(0, 10);
      const milestones = split.map((percentage, index) => {
        const amount = contract * percentage / 100;
        return { project_id: projectId, milestone_name: index === 0 ? 'Advance' : 'Completion Payment', sequence_no: index + 1, percentage, amount, gst_amount: amount * gstRate / 100, due_date: index === 0 ? (project.start_date || new Date().toISOString().slice(0, 10)) : completionDate, status: 'not_due' };
      });
      const { error: milestoneError } = await supabase.from('b2g_payment_milestones' as any).insert(milestones);
      if (milestoneError) { setSaving(false); toast({ title: 'Project saved, milestones failed', description: milestoneError.message, variant: 'destructive' }); setProjectOpen(false); load(); return; }
    }
    setSaving(false);
    toast({ title: editingProjectId ? 'Project updated' : split ? 'Project and payment schedule created' : 'Project created', description: !editingProjectId && !split ? 'Add milestones according to this payment model.' : undefined }); setProjectOpen(false); load();
  };

  const openNewMilestone = () => { setEditingMilestoneId(null); setMilestone(blankMilestone); setMilestoneOpen(true); };
  const openEditMilestone = (r: any) => {
    setEditingMilestoneId(r.id);
    setMilestone({ project_id: r.project_id, milestone_name: r.milestone_name, sequence_no: String(r.sequence_no), percentage: r.percentage == null ? '' : String(r.percentage), amount: String(r.amount), gst_amount: String(r.gst_amount), due_date: r.due_date || '' });
    setMilestoneOpen(true);
  };
  const saveMilestone = async () => {
    const p = projects.find(x => x.id === milestone.project_id);
    const base = milestone.amount ? Number(milestone.amount) : Number(p?.contract_value || 0) * Number(milestone.percentage || 0) / 100;
    const gst = milestone.gst_amount ? Number(milestone.gst_amount) : base * Number(p?.gst_rate || 18) / 100;
    const existing = rows.find(x => x.id === editingMilestoneId);
    if (existing && Number(existing.amount_received) > base + gst) { toast({ title: 'Total cannot be lower than amount already received', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = { ...milestone, sequence_no: Number(milestone.sequence_no), percentage: milestone.percentage ? Number(milestone.percentage) : null, amount: base, gst_amount: gst, due_date: milestone.due_date || null };
    const result = editingMilestoneId
      ? await supabase.from('b2g_payment_milestones' as any).update(payload).eq('id', editingMilestoneId)
      : await supabase.from('b2g_payment_milestones' as any).insert(payload);
    setSaving(false);
    if (result.error) toast({ title: 'Milestone could not be saved', description: result.error.message, variant: 'destructive' });
    else { toast({ title: editingMilestoneId ? 'Milestone updated' : 'Milestone added' }); setMilestoneOpen(false); load(); }
  };

  const openReceipt = (r: any) => { setReceiptRow(r); setReceiptAmount(String(Number(r.amount) + Number(r.gst_amount) - Number(r.amount_received))); setReceiptDate(new Date().toISOString().slice(0, 10)); setReceiptOpen(true); };
  const saveReceipt = async () => {
    const total = Number(receiptRow.amount) + Number(receiptRow.gst_amount);
    const addition = Number(receiptAmount);
    if (!addition || addition <= 0) { toast({ title: 'Enter a valid received amount', variant: 'destructive' }); return; }
    const received = Math.min(total, Number(receiptRow.amount_received) + addition);
    setSaving(true);
    const { error } = await supabase.from('b2g_payment_milestones' as any).update({ amount_received: received, received_at: `${receiptDate}T12:00:00+05:30`, status: received >= total ? 'paid' : 'partially_paid' }).eq('id', receiptRow.id);
    setSaving(false);
    if (error) toast({ title: 'Payment could not be recorded', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Payment recorded successfully' }); setReceiptOpen(false); load(); }
  };

  const received = rows.reduce((a, x) => a + Number(x.amount_received), 0);
  const due = rows.reduce((a, x) => a + Math.max(0, Number(x.amount) + Number(x.gst_amount) - Number(x.amount_received)), 0);
  const overdue = rows.filter(x => x.due_date && x.due_date < new Date().toISOString().slice(0, 10) && x.status !== 'paid').length;
  const proposalValue = projects.reduce((a, x) => a + Number(x.contract_value), 0);
  const advanceReceived = rows.filter(x => x.milestone_name?.toLowerCase().includes('advance')).reduce((a, x) => a + Number(x.amount_received), 0);
  const gstTotal = rows.reduce((a, x) => a + Number(x.gst_amount), 0);

  return <div className="min-h-full bg-slate-50/60 p-4 md:p-7">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-xs font-bold text-primary tracking-wider">FINANCE</p><h1 className="text-3xl font-bold mt-1">Payments</h1><p className="text-muted-foreground">Projects, payment milestones, GST and outstanding amounts</p></div><div className="grid grid-cols-2 sm:flex gap-2"><Button className="w-full sm:w-auto" variant="outline" onClick={openNewProject}><Plus className="h-4 w-4 mr-2"/>Project</Button><Button className="w-full sm:w-auto" onClick={openNewMilestone}><Plus className="h-4 w-4 mr-2"/>Milestone</Button></div></div>
    <Card className="border-0 bg-primary/5 shadow-none mt-5"><CardContent className="p-4"><p className="font-semibold text-sm">How advance and balance are maintained</p><div className="grid sm:grid-cols-3 gap-2 mt-3 text-xs text-muted-foreground"><p><span className="font-bold text-foreground">1. Create Project:</span> choose 80/20, 70/30 or 50/50 to create the payment schedule automatically.</p><p><span className="font-bold text-foreground">2. Record Payment:</span> enter each received advance or completion amount from its milestone.</p><p><span className="font-bold text-foreground">3. Auto calculation:</span> Balance = milestone amount + GST − amount received; collection status updates automatically.</p></div></CardContent></Card>
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 my-6">{[['Proposal Value', money(proposalValue), ReceiptText], ['Advance Received', money(advanceReceived), IndianRupee], ['Total Collected', money(received), CheckCircle2], ['Balance Due', money(due), BadgeIndianRupee], ['GST Amount', money(gstTotal), WalletCards], ['Overdue', String(overdue), Clock3]].map(([l, v, I]: any) => <Card key={l} className="border-0 shadow-sm"><CardContent className="p-4 sm:p-5"><I className="h-5 w-5 text-primary mb-4"/><p className="text-lg sm:text-xl font-extrabold break-words">{v}</p><p className="text-xs text-muted-foreground mt-1">{l}</p></CardContent></Card>)}</div>
    <div className="grid lg:grid-cols-3 gap-5"><div className="lg:col-span-2 space-y-3">{rows.map(r => { const total = Number(r.amount) + Number(r.gst_amount), balance = total - Number(r.amount_received), late = r.due_date && r.due_date < new Date().toISOString().slice(0, 10) && r.status !== 'paid'; return <Card key={r.id} className={`border-0 shadow-sm ${late ? 'ring-1 ring-rose-200' : ''}`}><CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex gap-3"><div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">{r.status === 'paid' ? <CheckCircle2 className="h-5 w-5"/> : <ReceiptText className="h-5 w-5"/>}</div><div><h3 className="font-bold">{r.b2g_projects?.project_name}</h3><p className="text-sm text-muted-foreground">{r.milestone_name} · Due {r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : 'not set'}</p></div></div><div className="md:text-right"><p className="font-bold">{money(total)}</p><p className="text-xs text-muted-foreground">Received {money(r.amount_received)} · Balance {money(balance)} · GST {money(r.gst_amount)}</p><div className="flex flex-wrap gap-2 md:justify-end mt-2"><Badge variant={r.status === 'paid' ? 'default' : late ? 'destructive' : 'secondary'}>{late ? 'Overdue' : nice(r.status)}</Badge><Button size="sm" variant="ghost" onClick={() => openEditMilestone(r)}><Pencil className="h-3.5 w-3.5 mr-1"/>Edit</Button>{balance > 0 && <Button size="sm" variant="outline" onClick={() => openReceipt(r)}><WalletCards className="h-3.5 w-3.5 mr-1"/>Record payment</Button>}</div></div></CardContent></Card> })}{!rows.length && <div className="py-16 text-center bg-white rounded-2xl"><ReceiptText className="h-10 w-10 mx-auto text-muted-foreground mb-3"/><h3 className="font-bold">No payment milestones yet</h3></div>}</div>
      <Card className="border-0 shadow-sm h-fit"><CardContent className="p-5"><h3 className="font-bold">Active projects</h3><div className="space-y-3 mt-4">{projects.map(p => <div key={p.id} className="p-3 bg-slate-50 rounded-xl"><div className="flex justify-between"><p className="font-semibold text-sm">{p.project_name}</p><Badge variant="secondary">{nice(p.status)}</Badge></div><p className="text-xs text-muted-foreground mt-1">{p.b2g_leads?.organization_name} · {nice(p.payment_model)}</p><div className="flex items-center justify-between mt-2"><p className="font-bold">{money(p.contract_value)} + {money(p.gst_amount)} GST</p><Button size="sm" variant="ghost" onClick={() => openEditProject(p)}><Pencil className="h-3.5 w-3.5 mr-1"/>Edit</Button></div></div>)}</div></CardContent></Card>
    </div>

    <Dialog open={projectOpen} onOpenChange={setProjectOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingProjectId ? 'Edit project' : 'Create project'}</DialogTitle><DialogDescription>Update the client engagement, commercial value and project timeline.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><Field label="Client"><Select value={project.lead_id} onValueChange={v => setProject({ ...project, lead_id: v })}><SelectTrigger><SelectValue placeholder="Select client"/></SelectTrigger><SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.organization_name}</SelectItem>)}</SelectContent></Select></Field><Field label="Project name"><Input value={project.project_name} onChange={e => setProject({ ...project, project_name: e.target.value })}/></Field><div className="grid grid-cols-2 gap-3"><Field label="Payment model"><Select value={project.payment_model} onValueChange={v => setProject({ ...project, payment_model: v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['80_20', '70_30', '50_50', 'milestone', 'monthly_retainer', 'success_fee'].map(x => <SelectItem key={x} value={x}>{nice(x)}</SelectItem>)}</SelectContent></Select></Field><Field label="Status"><Select value={project.status} onValueChange={v => setProject({ ...project, status: v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['planned', 'active', 'on_hold', 'completed', 'cancelled'].map(x => <SelectItem key={x} value={x}>{nice(x)}</SelectItem>)}</SelectContent></Select></Field><Field label="Contract value"><Input type="number" value={project.contract_value} onChange={e => setProject({ ...project, contract_value: e.target.value })}/></Field><Field label="GST %"><Input type="number" value={project.gst_rate} onChange={e => setProject({ ...project, gst_rate: e.target.value })}/></Field><Field label="Start date"><Input type="date" value={project.start_date} onChange={e => setProject({ ...project, start_date: e.target.value })}/></Field><Field label="Target completion"><Input type="date" value={project.target_completion_date} onChange={e => setProject({ ...project, target_completion_date: e.target.value })}/></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setProjectOpen(false)}>Cancel</Button><Button disabled={saving || !project.lead_id || !project.project_name} onClick={saveProject}>{saving ? 'Saving…' : 'Save project'}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}><DialogContent><DialogHeader><DialogTitle>{editingMilestoneId ? 'Edit payment milestone' : 'Add payment milestone'}</DialogTitle><DialogDescription>Set the agreed amount, GST and collection due date.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><Field label="Project"><Select value={milestone.project_id} onValueChange={v => setMilestone({ ...milestone, project_id: v })}><SelectTrigger><SelectValue placeholder="Select project"/></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}</SelectContent></Select></Field><Field label="Milestone name"><Input value={milestone.milestone_name} onChange={e => setMilestone({ ...milestone, milestone_name: e.target.value })}/></Field><div className="grid grid-cols-2 gap-3"><Field label="Sequence"><Input type="number" value={milestone.sequence_no} onChange={e => setMilestone({ ...milestone, sequence_no: e.target.value })}/></Field><Field label="Percentage"><Input type="number" value={milestone.percentage} onChange={e => setMilestone({ ...milestone, percentage: e.target.value })}/></Field><Field label="Base amount"><Input type="number" placeholder="Auto from percentage" value={milestone.amount} onChange={e => setMilestone({ ...milestone, amount: e.target.value })}/></Field><Field label="GST amount"><Input type="number" placeholder="Auto calculated" value={milestone.gst_amount} onChange={e => setMilestone({ ...milestone, gst_amount: e.target.value })}/></Field></div><Field label="Due date"><Input type="date" value={milestone.due_date} onChange={e => setMilestone({ ...milestone, due_date: e.target.value })}/></Field></div><DialogFooter><Button variant="outline" onClick={() => setMilestoneOpen(false)}>Cancel</Button><Button disabled={saving || !milestone.project_id || !milestone.milestone_name} onClick={saveMilestone}>{saving ? 'Saving…' : 'Save milestone'}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Record payment received</DialogTitle><DialogDescription>{receiptRow?.b2g_projects?.project_name} · {receiptRow?.milestone_name}</DialogDescription></DialogHeader><div className="rounded-xl bg-slate-50 p-4 grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">Total milestone</p><p className="font-bold">{money(Number(receiptRow?.amount) + Number(receiptRow?.gst_amount))}</p></div><div><p className="text-xs text-muted-foreground">Current balance</p><p className="font-bold text-amber-600">{money(Number(receiptRow?.amount) + Number(receiptRow?.gst_amount) - Number(receiptRow?.amount_received))}</p></div></div><div className="grid gap-4 py-2"><Field label="Amount received"><Input autoFocus type="number" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)}/></Field><Field label="Received date"><Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)}/></Field></div><DialogFooter><Button variant="outline" onClick={() => setReceiptOpen(false)}>Cancel</Button><Button disabled={saving || !receiptAmount} onClick={saveReceipt}><WalletCards className="h-4 w-4 mr-2"/>{saving ? 'Saving…' : 'Record payment'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
