/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Plus, Search, Upload, Pencil } from 'lucide-react';
import { leadState } from '@/lib/leadOptions';

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
  ['active', 'Active'],
  ['lost', 'Not interested / Lost'],
  ['closed', 'Closed'],
  ['all', 'All'],
] as const;

export default function Leads() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const pipelineFilter = params.get('pipeline');
  const campaignFilter = params.get('campaign');
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [view, setView] = useState<(typeof VIEWS)[number][0]>('active');
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
          (!pipelineFilter || x.pipeline === pipelineFilter) &&
          (!campaignFilter || x.campaign_name === campaignFilter) &&
          `${x.organization_name} ${x.contact_name} ${x.phone} ${x.industry}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [rows, q, pipelineFilter, campaignFilter],
  );
  const counts = useMemo(
    () => ({
      active: scoped.filter((x) => leadState(x) === 'active').length,
      lost: scoped.filter((x) => leadState(x) === 'lost').length,
      closed: scoped.filter((x) => leadState(x) === 'closed').length,
      all: scoped.length,
    }),
    [scoped],
  );
  const list = useMemo(() => (view === 'all' ? scoped : scoped.filter((x) => leadState(x) === view)), [scoped, view]);

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
          <Button key={key} size="sm" variant={view === key ? 'default' : 'outline'} onClick={() => setView(key)}>
            {label} <span className="ml-1.5 opacity-70">{counts[key]}</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="h-32 bg-white animate-pulse rounded-2xl" />
      ) : (
        <div className="grid xl:grid-cols-2 gap-3">
          {list.map((l) => {
            const state = leadState(l);
            return (
              <Card key={l.id} onClick={() => nav(`/leads/${l.id}`)} className="border-0 shadow-sm cursor-pointer">
                <CardContent className="p-5">
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
