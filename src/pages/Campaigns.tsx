/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, ChevronRight, Megaphone, MapPin, Phone, Search, ThumbsUp, Undo2, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface Campaign {
  name: string;
  count: number;
  interested: number;
  latest: string | null;
}

const PAGE_SIZE = 50;
const FILTERS = [
  ['all', 'All'],
  ['interested', 'Interested'],
  ['na', 'NA'],
] as const;

const colorPalette = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];
const getColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colorPalette[Math.abs(hash) % colorPalette.length];
};
const clean = (value: string) => value.replace(/[%,()*\\]/g, ' ').trim();

const Campaigns = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const selected = params.get('campaign');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchCampaigns = async () => {
      setLoading(true);
      // The database returns at most 1000 rows per request, so read the campaign tags page by page —
      // otherwise only the first few campaigns (the ones with the most rows) would show up.
      const PAGE = 1000;
      const run = async (columns: string) => {
        const all: any[] = [];
        for (let from = 0; from < 200000; from += PAGE) {
          let q = supabase.from('b2g_leads' as any).select(columns).not('campaign_name', 'is', null).neq('campaign_name', '').order('id').range(from, from + PAGE - 1);
          if (!isAdmin) q = q.eq('assigned_to', user.id);
          const page: any = await q;
          if (page.error) return { error: page.error, data: null as any[] | null };
          all.push(...(page.data ?? []));
          if ((page.data ?? []).length < PAGE) break;
        }
        return { error: null, data: all };
      };
      let result: any = await run('id, campaign_name, created_at, campaign_interested');
      if (result.error) result = await run('id, campaign_name, created_at');
      if (result.error) {
        toast({ title: 'Failed to load campaigns', description: result.error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
      const map: Record<string, Campaign> = {};
      for (const row of result.data ?? []) {
        const key = row.campaign_name as string;
        if (!map[key]) map[key] = { name: key, count: 0, interested: 0, latest: null };
        map[key].count += 1;
        if (row.campaign_interested) map[key].interested += 1;
        if (!map[key].latest || (row.created_at && row.created_at > map[key].latest!)) map[key].latest = row.created_at;
      }
      setCampaigns(Object.values(map).sort((a, b) => b.count - a.count));
      setLoading(false);
    };
    fetchCampaigns();
  }, [user, isAdmin, selected === null]);

  const loadLeads = async (reset: boolean) => {
    if (!selected || !user) return;
    setLeadLoading(true);
    const from = reset ? 0 : leads.length;
    let q = supabase
      .from('b2g_leads' as any)
      .select('*')
      .eq('campaign_name', selected)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!isAdmin) q = q.eq('assigned_to', user.id);
    if (filter === 'interested') q = q.eq('campaign_interested', true);
    if (filter === 'na') q = q.eq('campaign_na', true);
    const term = clean(leadSearch);
    if (term) q = q.or(`organization_name.ilike.%${term}%,contact_name.ilike.%${term}%,phone.ilike.%${term}%`);
    const { data, error } = await q;
    setLeadLoading(false);
    if (error) {
      toast({
        title: 'Campaign leads could not load',
        description: /campaign_(interested|na)/.test(error.message) ? 'Run the latest database update (SQL) first.' : error.message,
        variant: 'destructive',
      });
      return;
    }
    const rows = (data as any[]) || [];
    setLeads(reset ? rows : [...leads, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
  };

  useEffect(() => {
    if (selected) loadLeads(true);
  }, [selected, filter, leadSearch, user, isAdmin]);

  // status: 'interested' | 'na' | 'pending'
  const setStatus = async (lead: any, status: 'interested' | 'na' | 'pending') => {
    const interested = status === 'interested';
    const patch = { campaign_interested: interested, campaign_na: status === 'na' };
    setBusyId(lead.id);
    const { error } = await supabase.from('b2g_leads' as any).update(patch).eq('id', lead.id);
    setBusyId('');
    if (error) {
      toast({
        title: 'Could not update',
        description: /campaign_(interested|na)/.test(error.message) ? 'Run the latest database update (SQL) first.' : error.message,
        variant: 'destructive',
      });
      return;
    }
    if (interested) {
      void supabase.from('b2g_activities' as any).insert({
        lead_id: lead.id,
        activity_type: 'note',
        subject: 'Marked interested from campaign',
        description: `Campaign: ${lead.campaign_name}`,
        created_by: user?.id,
      });
    }
    toast({
      title: interested ? 'Added to Leads' : status === 'na' ? 'Marked NA' : 'Moved back to review',
      description: interested ? `${lead.organization_name} now appears in the Leads list.` : undefined,
    });
    setLeads((current) =>
      filter === 'all' ? current.map((row) => (row.id === lead.id ? { ...row, ...patch } : row)) : current.filter((row) => row.id !== lead.id),
    );
  };

  const filtered = campaigns.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const totalLeads = campaigns.reduce((sum, c) => sum + c.count, 0);

  if (selected) {
    const color = getColor(selected);
    return (
      <div className="max-w-lg mx-auto lg:max-w-4xl pb-24">
        <div className="px-5 pt-8 pb-4">
          <button onClick={() => setParams({})} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            All campaigns
          </button>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: color }}>
              {selected.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">{selected}</h1>
              <p className="text-[14px] text-muted-foreground">Mark a lead “Interested” to move it into your Leads list.</p>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, contact or phone…" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} className="pl-10 h-11 rounded-xl bg-card" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map(([key, label]) => (
              <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} onClick={() => setFilter(key)}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="px-4 grid gap-3 lg:grid-cols-2">
          {leads.map((lead) => (
            <Card key={lead.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      {lead.organization_name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {[lead.contact_name, lead.industry].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {lead.campaign_interested && <Badge className="shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">In Leads</Badge>}
                  {lead.campaign_na && <Badge variant="secondary" className="shrink-0">NA</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {lead.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {lead.phone}
                    </span>
                  )}
                  {(lead.city || lead.state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[lead.city, lead.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {lead.campaign_interested ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/leads/${lead.id}`)}>
                        Open lead
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busyId === lead.id} onClick={() => setStatus(lead, 'pending')}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        Remove from Leads
                      </Button>
                    </>
                  ) : lead.campaign_na ? (
                    <Button size="sm" variant="outline" disabled={busyId === lead.id} onClick={() => setStatus(lead, 'pending')}>
                      <Undo2 className="h-3.5 w-3.5 mr-1" />
                      Undo NA
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" disabled={busyId === lead.id} onClick={() => setStatus(lead, 'interested')}>
                        <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                        Interested
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === lead.id} onClick={() => setStatus(lead, 'na')}>
                        NA
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {!leads.length && !leadLoading && (
            <div className="lg:col-span-2 rounded-2xl bg-white py-16 text-center text-sm text-muted-foreground">
              {filter === 'na' ? 'No leads marked NA.' : filter === 'interested' ? 'No interested leads yet.' : 'No leads found.'}
            </div>
          )}
        </div>
        {hasMore && (
          <div className="mt-4 text-center">
            <Button variant="outline" disabled={leadLoading} onClick={() => loadLeads(false)}>
              {leadLoading ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto lg:max-w-4xl">
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Campaigns</h1>
            <p className="text-[14px] text-muted-foreground">
              {campaigns.length} campaigns · {totalLeads.toLocaleString('en-IN')} total leads
            </p>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">Campaign leads stay here. Mark a lead “Interested” and it moves into the Leads list.</p>

        <div className="relative mt-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search campaign..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl bg-card border-border/60 shadow-sm text-[15px]" />
        </div>
      </div>

      <div className="px-4 space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 animate-in">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-2 text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-[15px] font-medium text-muted-foreground">No campaigns found</p>
            <p className="text-[13px] text-muted-foreground/70 mt-1">Import leads with a Sub-Category / Campaign Name to see them here</p>
          </div>
        ) : (
          filtered.map((campaign) => {
            const color = getColor(campaign.name);
            return (
              <button
                key={campaign.name}
                onClick={() => setParams({ campaign: campaign.name })}
                className="w-full text-left rounded-2xl p-4 card-interactive border border-border/20 bg-card/60 glass-subtle flex items-center gap-3"
              >
                <div className="h-12 w-12 rounded-xl flex items-center justify-center text-[15px] font-bold shrink-0 text-white" style={{ backgroundColor: color }}>
                  {campaign.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] text-foreground truncate">{campaign.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[13px] text-muted-foreground">
                      {campaign.count.toLocaleString('en-IN')} lead{campaign.count !== 1 ? 's' : ''} · {campaign.interested.toLocaleString('en-IN')} interested
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: color + '18', color }}>
                    {campaign.count}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-[13px] text-muted-foreground text-center py-4">
          {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default Campaigns;
