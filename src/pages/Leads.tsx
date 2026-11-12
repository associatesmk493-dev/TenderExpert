/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, LayoutGrid, List, Plus, Search, Upload, Pencil } from 'lucide-react';
import { fromCampaign, inLeadsList, isNewLead, leadState, QUALIFIED_STAGE } from '@/lib/leadOptions';
import { useToast } from '@/hooks/use-toast';
import { Megaphone } from 'lucide-react';

const nice = (v: string) => (v || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bPi\b/g, 'PI');
const exportCsv = (rows: any[]) => {
  const q = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = [
    ['Organization', 'Contact', 'Phone', 'Email', 'Industry', 'Pipeline', 'Stage', 'Source', 'Priority', 'Proposal Value', 'Follow-up Date'],
    ...rows.map((x) => [x.organization_name, x.contact_name, x.phone, x.email, x.industry, x.pipeline, x.stage, x.source, x.heat, x.proposal_value, x.next_follow_up_at]),
  ]
    .map((x) => x.map(q).join(','))
    .join('\n');
  const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = u;
  a.download = 'leads.csv';
  a.click();
  URL.revokeObjectURL(u);
};

const VIEWS = [
  ['all', 'All'],
  ['new', 'New leads'],
  ['qualified', 'Qualified leads'],
  ['lost', 'Not interested / Lost'],
  ['closed', 'Closed'],
  ['collaboration', 'Collaboration'],
] as const;

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const LAYOUT_KEY = 'tenderexpert_leads_layout';
const ROW_COLUMNS = 'md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]';

export default function Leads() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const pipelineFilter = params.get('pipeline');
  const campaignFilter = params.get('campaign');
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const { toast } = useToast();
  const [view, setView] = useState<(typeof VIEWS)[number][0]>('new');
  const [pickedView, setPickedView] = useState(false);
  const [layout, setLayout] = useState<'rows' | 'cards'>(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === 'cards' ? 'cards' : 'rows';
    } catch {
      return 'rows';
    }
  });
  const chooseLayout = (value: 'rows' | 'cards') => {
    setLayout(value);
    try {
      localStorage.setItem(LAYOUT_KEY, value);
    } catch {
      /* ignore */
    }
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('b2g_leads' as any)
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setRows(data || []);
        setLoading(false);
      });
  }, []);

  const scoped = useMemo(
    () =>
      rows.filter(
        (x) =>
          inLeadsList(x) &&
          (!pipelineFilter || x.pipeline === pipelineFilter) &&
          (!campaignFilter || x.campaign_name === campaignFilter) &&
          `${x.organization_name} ${x.contact_name} ${x.phone} ${x.industry}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [rows, q, pipelineFilter, campaignFilter],
  );
  const counts = useMemo(
    () => ({
      new: scoped.filter((x) => leadState(x) === 'active' && isNewLead(x)).length,
      qualified: scoped.filter((x) => leadState(x) === 'active' && !isNewLead(x)).length,
      lost: scoped.filter((x) => leadState(x) === 'lost').length,
      closed: scoped.filter((x) => leadState(x) === 'closed').length,
      all: scoped.length,
      collaboration: scoped.filter((x) => x.pipeline === 'collaboration').length,
    }),
    [scoped],
  );
  const list = useMemo(
    () =>
      view === 'all'
        ? scoped
        : view === 'collaboration'
          ? scoped.filter((x) => x.pipeline === 'collaboration')
          : view === 'new'
          ? scoped.filter((x) => leadState(x) === 'active' && isNewLead(x))
          : view === 'qualified'
            ? scoped.filter((x) => leadState(x) === 'active' && !isNewLead(x))
            : scoped.filter((x) => leadState(x) === view),
    [scoped, view],
  );

  // Open on Qualified when there is nothing new to triage.
  useEffect(() => {
    if (!loading && !pickedView && counts.new === 0 && counts.qualified > 0) setView('qualified');
  }, [loading, pickedView, counts.new, counts.qualified]);

  // A new lead that is keen to go ahead moves straight to its pipeline's first qualified stage.
  const moveToQualified = async (lead: any) => {
    const stage = QUALIFIED_STAGE[lead.pipeline] || 'qualified_lead';
    const { error } = await supabase.from('b2g_leads' as any).update({ stage }).eq('id', lead.id);
    if (error) return toast({ title: 'Could not move the lead', description: error.message, variant: 'destructive' });
    setRows((current) => current.map((row) => (row.id === lead.id ? { ...row, stage } : row)));
    toast({ title: 'Moved to Qualified leads', description: lead.organization_name });
  };

  return (
    <div className="min-h-full bg-slate-50/60 p-4 md:p-7">
      <div className="flex justify-between items-end gap-3 mb-6">
        <div>
          <p className="text-xs font-bold text-primary">BUSINESS PIPELINE</p>
          <h1 className="text-3xl font-bold">Opportunities</h1>
          <p className="text-muted-foreground">
            {list.length} leads
            {pipelineFilter ? ` · ${nice(pipelineFilter)}` : ''}
            {campaignFilter ? ` · ${campaignFilter}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="hidden overflow-hidden rounded-md border bg-white sm:flex">
            <Button variant={layout === 'rows' ? 'secondary' : 'ghost'} size="icon" className="rounded-none" onClick={() => chooseLayout('rows')} title="Row view" aria-label="Row view">
              <List className="h-4 w-4" />
            </Button>
            <Button variant={layout === 'cards' ? 'secondary' : 'ghost'} size="icon" className="rounded-none" onClick={() => chooseLayout('cards')} title="Card view" aria-label="Card view">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="icon" onClick={() => exportCsv(list)} title="Export leads" aria-label="Export leads">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => nav('/import')} title="Import leads">
            <Upload className="h-4 w-4" />
          </Button>
          <Button onClick={() => nav('/leads/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add opportunity
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9 bg-white" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organization, contact, phone or industry" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {VIEWS.map(([key, label]) => (
          <Button key={key} size="sm" variant={view === key ? 'default' : 'outline'} onClick={() => { setView(key); setPickedView(true); }}>
            {label} <span className="ml-1.5 opacity-70">{counts[key]}</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="h-32 bg-white animate-pulse rounded-2xl" />
      ) : layout === 'rows' ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className={`hidden items-center gap-3 border-b bg-slate-50 px-4 py-2.5 text-xs font-semibold text-muted-foreground md:grid ${ROW_COLUMNS}`}>
            <span>Organization</span>
            <span>Pipeline</span>
            <span>Stage</span>
            <span>Proposal</span>
            <span>Follow-up</span>
            <span className="w-[120px] text-right">Action</span>
          </div>
          {list.map((l) => {
            const state = leadState(l);
            const due = l.next_follow_up_at ? new Date(l.next_follow_up_at) : null;
            const overdue = Boolean(due && due.getTime() < Date.now() && state === 'active');
            return (
              <div key={l.id} onClick={() => nav(`/leads/${l.id}`)} className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-3 last:border-b-0 hover:bg-slate-50 md:grid ${ROW_COLUMNS}`}>
                <div className="w-full min-w-0 md:w-auto">
                  <p className="truncate font-semibold">{l.organization_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[l.contact_name, l.industry].filter(Boolean).join(' · ')}</p>
                  {fromCampaign(l) && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-indigo-600">
                      <Megaphone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{l.campaign_name}</span>
                    </p>
                  )}
                </div>
                <div className="min-w-0 max-w-full">
                  <Badge className="max-w-full truncate">{nice(l.pipeline)}</Badge>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  <Badge variant="secondary">{nice(l.stage)}</Badge>
                  {state === 'lost' && <Badge variant="destructive">{l.lost_reason_code === 'not_interested' ? 'Not interested' : 'Lost'}</Badge>}
                </div>
                <p className="text-sm">
                  <span className="mr-1 text-xs text-muted-foreground md:hidden">Proposal:</span>
                  {Number(l.proposal_value) > 0 ? money(Number(l.proposal_value)) : '—'}
                </p>
                <p className={`text-sm ${overdue ? 'font-semibold text-rose-600' : 'text-muted-foreground'}`}>
                  <span className="mr-1 text-xs md:hidden">Follow-up:</span>
                  {due ? due.toLocaleDateString('en-IN') : 'Not set'}
                </p>
                <div className="ml-auto flex items-center justify-end gap-2 md:ml-0 md:w-[120px]">
                  {state === 'active' && isNewLead(l) ? (
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={(e) => { e.stopPropagation(); moveToQualified(l); }}>
                      Qualify
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Edit ${l.organization_name}`} onClick={(e) => { e.stopPropagation(); nav(`/leads/${l.id}/edit`); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {!list.length && <div className="py-20 text-center">No leads found</div>}
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-3">
          {list.map((l) => {
            const state = leadState(l);
            return (
              <Card key={l.id} onClick={() => nav(`/leads/${l.id}`)} className="border-0 shadow-sm cursor-pointer">
                <CardContent className="p-5">
                  {fromCampaign(l) && (
                    <div className="-mt-1 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-[11px] font-medium text-indigo-700">
                      <Megaphone className="h-3 w-3" />
                      <span>Exported from campaign: {l.campaign_name}</span>
                      {l.event_name && l.event_name !== l.campaign_name && <span>· Event: {l.event_name}</span>}
                    </div>
                  )}
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-bold">{l.organization_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {l.contact_name} · {l.industry}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        nav(`/leads/${l.id}/edit`);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge>{nice(l.pipeline)}</Badge>
                    <Badge variant="secondary">{nice(l.stage)}</Badge>
                    {state === 'lost' && (
                      <Badge variant="destructive">{l.lost_reason_code === 'not_interested' ? 'Not interested' : `Lost · ${nice(l.lost_reason_code)}`}</Badge>
                    )}
                  </div>
                  {state === 'active' && isNewLead(l) && (
                    <Button size="sm" variant="outline" className="mt-4" onClick={(e) => { e.stopPropagation(); moveToQualified(l); }}>
                      Move to Qualified
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground mt-4">
                    Follow-up: {l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleDateString('en-IN') : 'Not set'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
          {!list.length && <div className="xl:col-span-2 bg-white rounded-2xl py-20 text-center">No leads found</div>}
        </div>
      )}
    </div>
  );
}
