/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { Landmark, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import BoqTable, { boqTotalOf, cleanBoqRows, toBoqRows, type BoqRow } from '@/components/BoqTable';
import CalcOptions, { cleanCalcOptions, netOf, toCalcOptions, type CalcOption } from '@/components/CalcOptions';
import CompanySheets from '@/components/CompanySheets';
import SuccessFees, { cleanFees, describeFeeChanges, feeTotals, toFees, type FeeRow } from '@/components/SuccessFees';
import LinkOrUpload from '@/components/LinkOrUpload';
import DeptNotes, { toDeptNotes, type DeptNote } from '@/components/DeptNotes';
import PartySheets from '@/components/PartySheets';
import TenderFeeSummary from '@/components/TenderFeeSummary';
import DictateButton from '@/components/DictateButton';
import TenderExcelTools from '@/components/TenderExcelTools';
import ListEditor from '@/components/ListEditor';
import { skippedMessage, writeWithFallback } from '@/lib/writeWithFallback';

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const nice = (value?: string | null) => (value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const BOQ_STATUS = ['not_started', 'preparation', 'submitted', 'revision', 'approved'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Where the project stands, from BOQ to the company being paid.
const STAGES = [
  { value: 'boq_submitted', label: 'BOQ submitted' },
  { value: 'sanction_awaited', label: 'Sanction awaited' },
  { value: 'approved', label: 'Approved' },
  { value: 'tender_called', label: 'Tender called' },
  { value: 'awarded', label: 'Awarded to contractor' },
  { value: 'under_process', label: 'Under process' },
  { value: 'payment_received', label: 'Payment received by company' },
];
const stageLabel = (value?: string | null) => STAGES.find((stage) => stage.value === value)?.label || nice(value);
const DOC_NAMES = ['BOQ', 'AR', 'Quote', 'PO', 'Approval'];
const DOC_STATUS = ['pending', 'done', 'awaited', 'not_required'];

type DocRow = { name: string; status: string };
type SheetForm = {
  month: string;
  site_name: string;
  division: string;
  tender_title: string;
  authority_name: string;
  estimated_value: string;
  approved_fund: string;
  contact_no: string;
  tender_timeline: string;
  conversation: string;
  plant_capacity: string;
  sanctioned_budget: string;
  existing_problem: string;
  proposed_technology: string;
  boq_status: string;
  decision_maker_name: string;
  next_action: string;
  company_name: string;
  project_stage: string;
  boq_link: string;
  mou_link: string;
};
const blankForm = (): SheetForm => ({
  month: MONTHS[new Date().getMonth()],
  site_name: '',
  division: '',
  tender_title: '',
  authority_name: '',
  estimated_value: '',
  approved_fund: '',
  contact_no: '',
  tender_timeline: '',
  conversation: '',
  plant_capacity: '',
  sanctioned_budget: '',
  existing_problem: '',
  proposed_technology: '',
  boq_status: 'not_started',
  decision_maker_name: '',
  next_action: '',
  company_name: '',
  project_stage: '',
  boq_link: '',
  mou_link: '',
});
const textList = (value: any): string[] => (Array.isArray(value) ? value.map((entry) => String(entry)) : []);
const clean = (items: string[]) => items.map((entry) => entry.trim()).filter(Boolean);
const numberText = (value: any) => (Number(value) > 0 ? String(value) : '');

export default function TenderOpportunities() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<SheetForm>(blankForm());
  const [offices, setOffices] = useState<string[]>(['']);
  const [statusLog, setStatusLog] = useState<string[]>(['']);
  const [parties, setParties] = useState<string[]>(['']);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [boq, setBoq] = useState<BoqRow[]>(toBoqRows([]));
  const [calcs, setCalcs] = useState<CalcOption[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [deptNotes, setDeptNotes] = useState<DeptNote[]>([]);
  const [partyFocus, setPartyFocus] = useState('');
  const [view, setView] = useState<'projects' | 'companies' | 'parties'>('projects');
  const [stageFilter, setStageFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('tender_opportunities' as any).select('*').order('created_at', { ascending: false });
    if (error) toast({ title: 'Tender opportunities could not load', description: error.message, variant: 'destructive' });
    setRows((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const months = useMemo(() => Array.from(new Set(rows.map((row) => String(row.month || '').trim()).filter(Boolean))), [rows]);
  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (monthFilter === 'all' || String(row.month || '').trim() === monthFilter) &&
        (stageFilter === 'all' || row.project_stage === stageFilter) &&
        (!term || [row.tender_title, row.authority_name, row.company_name, row.site_name, row.division, row.contact_no, (row.parties || []).join(' ')].join(' ').toLowerCase().includes(term)),
    );
  }, [rows, query, monthFilter, stageFilter]);

  const set = (key: keyof SheetForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const openNew = () => {
    setEditing(null);
    setForm(blankForm());
    setOffices(['']);
    setStatusLog(['']);
    setParties(['']);
    setDocuments(DOC_NAMES.slice(0, 4).map((name) => ({ name, status: 'pending' })));
    setBoq(toBoqRows([]));
    setCalcs([]);
    setFees([]);
    setDeptNotes([]);
    setOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      month: row.month || '',
      site_name: row.site_name || '',
      division: row.division || '',
      tender_title: row.tender_title || '',
      authority_name: row.authority_name || '',
      estimated_value: numberText(row.estimated_value),
      approved_fund: row.approved_fund || '',
      contact_no: row.contact_no || '',
      tender_timeline: row.tender_timeline || (row.submission_deadline ? String(row.submission_deadline).slice(0, 10) : ''),
      conversation: row.conversation || '',
      plant_capacity: row.plant_capacity || '',
      sanctioned_budget: numberText(row.sanctioned_budget),
      existing_problem: row.existing_problem || '',
      proposed_technology: row.proposed_technology || '',
      boq_status: row.boq_status || 'not_started',
      decision_maker_name: row.decision_maker_name || '',
      next_action: row.next_action || '',
      company_name: row.company_name || '',
      project_stage: row.project_stage || '',
      boq_link: row.boq_link || '',
      mou_link: row.mou_link || '',
    });
    setOffices(textList(row.offices).length ? textList(row.offices) : ['']);
    setStatusLog(textList(row.status_log).length ? textList(row.status_log) : ['']);
    setParties(textList(row.parties).length ? textList(row.parties) : ['']);
    setDocuments(Array.isArray(row.documents) ? row.documents.map((doc: any) => ({ name: doc.name || '', status: doc.status || 'pending' })) : []);
    setBoq(toBoqRows(row.boq_items));
    setCalcs(toCalcOptions(row.calculations));
    setFees(toFees(row.success_fees));
    setDeptNotes(toDeptNotes(row.dept_notes));
    setOpen(true);
  };

  // Every unpaid, agreed fee with a follow-up date becomes a reminder in Tasks & reminders (best effort).
  const syncFeeReminders = async (tenderId: string, site: string, company: string, feeLines: any[]) => {
    try {
      const marker = `tender-fee:${tenderId}:`;
      const { data: existing } = await supabase.from('b2g_tasks' as any).select('description,completed_at').like('description', `${marker}%`);
      const finished = new Set(((existing as any[]) || []).filter((task) => task.completed_at).map((task) => task.description));
      await supabase.from('b2g_tasks' as any).delete().like('description', `${marker}%`).is('completed_at', null);
      const reminders = feeLines
        .map((fee, index) => ({ fee, key: `${marker}${index}:${fee.due}:${fee.amount}` }))
        .filter(({ fee, key }) => fee.due && ['agreed', 'earned', 'invoiced', 'part_paid'].includes(fee.status) && fee.amount - fee.received > 0 && !finished.has(key))
        .map(({ fee, key }) => ({
          task_type: 'payment',
          title: `Collect fee: ${[company, site].filter(Boolean).join(' · ')} — ${fee.label || 'success fee'} (${money(fee.amount - fee.received)})`,
          description: key,
          priority: 'medium',
          due_at: new Date(`${fee.due}T10:00:00`).toISOString(),
          assigned_to: user?.id,
          created_by: user?.id,
        }));
      if (reminders.length) await supabase.from('b2g_tasks' as any).insert(reminders);
    } catch {
      /* reminders are a convenience; the tender itself is already saved */
    }
  };

  const save = async () => {
    const identity = form.site_name.trim() || form.authority_name.trim() || form.tender_title.trim();
    if (!identity) {
      toast({ title: 'Enter the site, department / client or scope of work', variant: 'destructive' });
      return;
    }
    const authority = form.authority_name.trim() || form.division.trim() || form.site_name.trim() || identity;
    const payload: Record<string, any> = {
      authority_name: authority,
      tender_title: form.tender_title.trim() || form.site_name.trim() || authority,
      month: form.month.trim() || null,
      site_name: form.site_name.trim() || null,
      division: form.division.trim() || null,
      offices: clean(offices),
      status_log: clean(statusLog),
      parties: clean(parties),
      documents: documents.filter((doc) => doc.name.trim()).map((doc) => ({ name: doc.name.trim(), status: doc.status })),
      approved_fund: form.approved_fund.trim() || null,
      estimated_value: Number(form.estimated_value) || 0,
      contact_no: form.contact_no.trim() || null,
      conversation: form.conversation.trim() || null,
      plant_capacity: form.plant_capacity.trim() || null,
      sanctioned_budget: Number(form.sanctioned_budget) || 0,
      existing_problem: form.existing_problem.trim() || null,
      proposed_technology: form.proposed_technology.trim() || null,
      boq_status: form.boq_status,
      decision_maker_name: form.decision_maker_name.trim() || null,
      tender_timeline: form.tender_timeline || null,
      submission_deadline: form.tender_timeline ? new Date(`${form.tender_timeline}T17:00:00`).toISOString() : null,
      next_action: form.next_action.trim() || null,
      boq_items: cleanBoqRows(boq),
      calculations: cleanCalcOptions(calcs),
      company_name: form.company_name.trim() || null,
      project_stage: form.project_stage || null,
      boq_link: form.boq_link.trim() || null,
      mou_link: form.mou_link.trim() || null,
      success_fees: cleanFees(fees),
      dept_notes: deptNotes,
    };
    // Keep a running history of every change to the fee lines.
    const feeChanges = describeFeeChanges(Array.isArray(editing?.success_fees) ? editing.success_fees : [], payload.success_fees);
    if (feeChanges.length) {
      const now = new Date().toISOString();
      const by = profile?.full_name || user?.email || '';
      payload.fee_history = [...(Array.isArray(editing?.fee_history) ? editing.fee_history : []), ...feeChanges.map((text) => ({ at: now, by, text }))].slice(-60);
    }
    setSaving(true);
    const { result, skipped } = await writeWithFallback(
      (body) =>
        editing
          ? supabase.from('tender_opportunities' as any).update(body).eq('id', editing.id).select('id')
          : supabase.from('tender_opportunities' as any).insert({ ...body, owner_id: user?.id }).select('id'),
      payload,
    );
    setSaving(false);
    if (result.error) {
      toast({ title: 'Tender not saved', description: result.error.message, variant: 'destructive' });
      return;
    }
    const savedId = editing?.id || (result.data as any)?.[0]?.id;
    if (savedId) await syncFeeReminders(savedId, form.site_name.trim() || form.tender_title.trim() || authority, form.company_name.trim(), payload.success_fees);
    toast({ title: editing ? 'Tender updated' : 'Tender added', description: skippedMessage(skipped) });
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!editing) return;
    if (!window.confirm(`Delete “${editing.site_name || editing.tender_title}”? This cannot be undone.`)) return;
    const { error } = await supabase.from('tender_opportunities' as any).delete().eq('id', editing.id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tender deleted' });
    setOpen(false);
    load();
  };

  const decision = async (id: string, value: string) => {
    await supabase.from('tender_opportunities' as any).update({ go_no_go: value, status: value === 'go' ? 'evaluation' : 'closed' }).eq('id', id);
    load();
  };

  const changeStage = async (id: string, value: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, project_stage: value } : row)));
    const { error } = await supabase.from('tender_opportunities' as any).update({ project_stage: value }).eq('id', id);
    if (error) {
      toast({ title: 'Stage not saved', description: /project_stage/.test(error.message) ? 'Run the latest Supabase SQL first.' : error.message, variant: 'destructive' });
      load();
    }
  };

  const setDoc = (index: number, patch: Partial<DocRow>) => setDocuments((current) => current.map((doc, i) => (i === index ? { ...doc, ...patch } : doc)));

  return (
    <div className="min-h-full bg-slate-50/60 p-4 md:p-7">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold tracking-wider text-primary">TENDER INTELLIGENCE</p>
          <h1 className="mt-1 text-3xl font-bold">Tender opportunities</h1>
          <p className="text-muted-foreground">Current sites — status, parties, documents, BOQ and project calculations in one place</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TenderExcelTools rows={rows} onImported={load} />
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add tender
          </Button>
        </div>
      </div>

      <TenderFeeSummary rows={rows} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="bg-white pl-9" placeholder="Search site, scope, division, party or contact" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="bg-white sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((stage) => <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {months.length > 0 && (
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="bg-white sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {months.map((month) => <SelectItem key={month} value={month}>{month}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mb-4 inline-flex rounded-xl bg-white p-1 shadow-sm">
        {(['projects', 'companies', 'parties'] as const).map((value) => (
          <button key={value} type="button" onClick={() => { setView(value); if (value !== 'parties') setPartyFocus(''); }} className={`rounded-lg px-4 py-1.5 text-sm font-medium ${view === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            {value === 'projects' ? 'Projects' : value === 'companies' ? 'By company' : 'Parties'}
          </button>
        ))}
      </div>

      {view === 'companies' && <CompanySheets rows={list} stageLabel={stageLabel} onOpen={openEdit} />}
      {view === 'parties' && <PartySheets rows={list} focus={partyFocus} stageLabel={stageLabel} onOpen={openEdit} />}

      <div className={`space-y-3 ${view !== 'projects' ? 'hidden' : ''}`}>
        {list.map((row) => {
          const statuses = textList(row.status_log);
          const latest = statuses[statuses.length - 1];
          const calc = toCalcOptions(row.calculations)[0];
          const net = calc ? netOf(calc.lines) : null;
          const timeline = row.tender_timeline || row.submission_deadline;
          const fee = feeTotals(Array.isArray(row.success_fees) ? row.success_fees : []);
          const late = timeline && new Date(timeline) < new Date() && row.go_no_go !== 'no_go';
          return (
            <Card key={row.id} className="cursor-pointer border-0 shadow-sm transition-shadow hover:shadow-md" onClick={() => openEdit(row)}>
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-bold">{row.site_name || row.tender_title}</h3>
                    {row.month && <Badge variant="outline">{row.month}</Badge>}
                    {row.company_name && <Badge variant="secondary">{row.company_name}</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {[row.site_name ? row.tender_title : '', row.division, row.authority_name !== row.tender_title ? row.authority_name : ''].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {latest && <span className="font-medium text-foreground">Status: {latest}</span>}
                    {row.approved_fund && <span>Fund: {Number(row.approved_fund) > 0 ? money(Number(row.approved_fund)) : row.approved_fund}</span>}
                    {Number(row.estimated_value) > 0 && <span>Tentative {money(Number(row.estimated_value))}</span>}
                    {textList(row.parties).length > 0 && (
                      <span className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
                        {textList(row.parties).slice(0, 3).map((party) => (
                          <button key={party} type="button" className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100" title="Show this party's projects" onClick={() => { setPartyFocus(party); setView('parties'); }}>
                            {party}
                          </button>
                        ))}
                        {textList(row.parties).length > 3 && (
                          <button type="button" className="text-[11px] font-medium text-violet-700 hover:underline" onClick={() => { setPartyFocus(textList(row.parties)[3]); setView('parties'); }}>
                            +{textList(row.parties).length - 3} more
                          </button>
                        )}
                      </span>
                    )}
                    {fee.potential > 0 && <span>Fee {money(fee.potential)} · received {money(fee.received)}</span>}
                    {row.contact_no && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {row.contact_no}
                      </span>
                    )}
                    {timeline && <span className={late ? 'font-semibold text-rose-600' : ''}>Timeline: {new Date(timeline).toLocaleDateString('en-IN')}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                  <Select value={row.project_stage || undefined} onValueChange={(value) => changeStage(row.id, value)}>
                    <SelectTrigger className="w-52"><SelectValue placeholder="Set stage" /></SelectTrigger>
                    <SelectContent>{STAGES.map((stage) => <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Badge variant="secondary">BOQ: {nice(row.boq_status) || 'Not Started'}</Badge>
                  {net !== null && <Badge variant="outline" className={net < 0 ? 'text-rose-700' : 'text-emerald-700'}>Net {money(net)}</Badge>}
                  <Select value={row.go_no_go} onValueChange={(value) => decision(row.id, value)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="go">Go</SelectItem>
                      <SelectItem value="no_go">No-Go</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!list.length && !loading && (
          <div className="rounded-2xl bg-white p-12 text-center">
            <Landmark className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
            <p className="font-semibold">No tender opportunities yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Click “Add tender” to record the first site.</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit tender opportunity' : 'New tender opportunity'}</DialogTitle>
            <p className="text-xs text-muted-foreground">One sheet per site — the same details you keep in your Current Sites sheet</p>
          </DialogHeader>

          <Section title="Site details">
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Label text="Project stage">
                <Select value={form.project_stage || undefined} onValueChange={(value) => set('project_stage', value)}>
                  <SelectTrigger><SelectValue placeholder="Where does this project stand?" /></SelectTrigger>
                  <SelectContent>{STAGES.map((stage) => <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>)}</SelectContent>
                </Select>
              </Label>
              <Label text="Department">
                <Input list="tender-departments" value={form.authority_name} onChange={(e) => set('authority_name', e.target.value)} placeholder="e.g. CPWD" />
                <datalist id="tender-departments">{Array.from(new Set(rows.map((row) => String(row.authority_name || '').trim()).filter(Boolean))).map((name) => <option key={name} value={name} />)}</datalist>
              </Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Label text="Month">
                <Input list="tender-months" value={form.month} onChange={(e) => set('month', e.target.value)} />
                <datalist id="tender-months">{MONTHS.map((month) => <option key={month} value={month} />)}</datalist>
              </Label>
              <Label text="Site (location)"><Input value={form.site_name} onChange={(e) => set('site_name', e.target.value)} /></Label>
              <Label text="Division"><Input value={form.division} onChange={(e) => set('division', e.target.value)} /></Label>
              <Label text="Scope of work"><Input value={form.tender_title} onChange={(e) => set('tender_title', e.target.value)} placeholder="e.g. STP plant 50 KLD" /></Label>
              <Label text="Plant capacity"><Input value={form.plant_capacity} onChange={(e) => set('plant_capacity', e.target.value)} placeholder="e.g. 135 KLD" /></Label>
              <Label text="Company we work for (manufacturer)">
                <Input list="tender-companies" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="e.g. TMVT" />
                <datalist id="tender-companies">{Array.from(new Set(rows.map((row) => String(row.company_name || '').trim()).filter(Boolean))).map((name) => <option key={name} value={name} />)}</datalist>
              </Label>
              <Label text="Contact no"><Input type="tel" value={form.contact_no} onChange={(e) => set('contact_no', e.target.value)} /></Label>
              <Label text="Tentative project cost"><Input type="number" min="0" value={form.estimated_value} onChange={(e) => set('estimated_value', e.target.value)} />{boqTotalOf(boq) > 0 && Number(form.estimated_value) !== boqTotalOf(boq) && (<button type="button" className="mt-1 text-xs font-medium text-primary hover:underline" onClick={() => set('estimated_value', String(boqTotalOf(boq)))}>Use BOQ total ({money(boqTotalOf(boq))})</button>)}</Label>
              <Label text="Approved fund"><Input value={form.approved_fund} onChange={(e) => set('approved_fund', e.target.value)} placeholder="Amount or “pending”" /></Label>
              <Label text="Tender timeline"><Input type="date" value={form.tender_timeline} onChange={(e) => set('tender_timeline', e.target.value)} /></Label>
            </div>
            <div className="mt-4">
              <ListEditor label="Office" hint="officials, e.g. EE – name, AE – name" items={offices} onChange={setOffices} placeholder="Designation – name" />
            </div>
          </Section>

          <Section title="Technical and decision details (optional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Label text="Sanctioned budget"><Input type="number" min="0" value={form.sanctioned_budget} onChange={(e) => set('sanctioned_budget', e.target.value)} /></Label>
              <Label text="Decision-maker"><Input value={form.decision_maker_name} onChange={(e) => set('decision_maker_name', e.target.value)} /></Label>
              <Label text="Existing problem"><Textarea rows={2} value={form.existing_problem} onChange={(e) => set('existing_problem', e.target.value)} /></Label>
              <Label text="Proposed technology"><Textarea rows={2} value={form.proposed_technology} onChange={(e) => set('proposed_technology', e.target.value)} /></Label>
              <Label text="BOQ status">
                <Select value={form.boq_status} onValueChange={(value) => set('boq_status', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BOQ_STATUS.map((value) => <SelectItem key={value} value={value}>{nice(value)}</SelectItem>)}</SelectContent>
                </Select>
              </Label>
              <Label text="Next action"><Input value={form.next_action} onChange={(e) => set('next_action', e.target.value)} /></Label>
            </div>
          </Section>

          <Section title="Status, parties and documents">
            <div className="grid gap-5 lg:grid-cols-2">
              <ListEditor label="Status" hint="oldest first — the last one shows on the card" items={statusLog} onChange={setStatusLog} placeholder="e.g. BOQ and AR submitted" />
              <ListEditor label="Parties" hint="vendors / companies involved" items={parties} onChange={setParties} placeholder="Party name" />
            </div>
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Documents</span>
                <Button type="button" size="icon" variant="outline" className="h-7 w-7" aria-label="Add document" onClick={() => setDocuments((current) => [...current, { name: '', status: 'pending' }])}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {documents.map((doc, index) => (
                  <div key={index} className="flex gap-2">
                    <Input list="tender-docs" value={doc.name} placeholder="BOQ / AR / Quote / PO" onChange={(e) => setDoc(index, { name: e.target.value })} />
                    <Select value={doc.status} onValueChange={(value) => setDoc(index, { status: value })}>
                      <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{DOC_STATUS.map((value) => <SelectItem key={value} value={value}>{nice(value)}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost" className="shrink-0" aria-label={`Remove document ${index + 1}`} onClick={() => setDocuments((current) => current.filter((_, i) => i !== index))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <datalist id="tender-docs">{DOC_NAMES.map((name) => <option key={name} value={name} />)}</datalist>
              </div>
            </div>
          </Section>

          <Section title="">
            <DeptNotes notes={deptNotes} onChange={setDeptNotes} author={profile?.full_name || user?.email || ''} />
          </Section>

          <Section title="">
            <BoqTable rows={boq} onChange={setBoq} />
            <div className="mt-3">
              <Label text="BOQ file — Drive link or upload (optional)">
                <LinkOrUpload value={form.boq_link} onChange={(value) => set('boq_link', value)} placeholder="Paste the Google Drive link, or upload the file" />
              </Label>
            </div>
          </Section>

          <Section title=""><CalcOptions options={calcs} onChange={setCalcs} boqTotal={boqTotalOf(boq)} /></Section>

          <Section title="">
            <SuccessFees fees={fees} onChange={setFees} boqTotal={boqTotalOf(boq)} history={Array.isArray(editing?.fee_history) ? editing.fee_history : []} />
            <div className="mt-3">
              <Label text="Signed MOU / agreement for this project — link (optional)">
                <LinkOrUpload value={form.mou_link} onChange={(value) => set('mou_link', value)} placeholder="Paste the Drive link, or upload the signed MOU (PDF)" />
              </Label>
            </div>
          </Section>

          <Section title="Conversation from party">
            <Textarea rows={3} value={form.conversation} onChange={(e) => set('conversation', e.target.value)} placeholder="What the party said — offers, advance, commitments…" />
            <div className="mt-2 flex justify-end">
              <DictateButton onText={(spoken) => set('conversation', form.conversation ? `${form.conversation.trimEnd()} ${spoken}` : spoken)} />
            </div>
          </Section>

          <DialogFooter className="gap-2 sm:gap-2">
            {editing && (
              <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={remove}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save tender'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 border-t pt-4 first:border-t-0 first:pt-0">
      {title && <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">{title}</h3>}
      {children}
    </section>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{text}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
