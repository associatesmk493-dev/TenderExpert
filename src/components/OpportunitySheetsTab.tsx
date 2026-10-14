/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronRight, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import LeadOpportunitySheet from '@/components/LeadOpportunitySheet';
import { skippedMessage, writeWithFallback } from '@/lib/writeWithFallback';

const clean = (value: string) => value.replace(/[%,()*\\]/g, ' ').trim();
const nice = (value?: string | null) => (value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Technical / commercial sheet and BOQ for an opportunity, kept apart from the Leads screens.
export default function OpportunitySheetsTab() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('sheet');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);

  useEffect(() => {
    if (selectedId) return;
    let active = true;
    setLoading(true);
    let q = supabase
      .from('b2g_leads' as any)
      .select('id,organization_name,contact_name,phone,industry,boq_status,stage')
      .order('updated_at', { ascending: false })
      .limit(40);
    const term = clean(query);
    if (term) q = q.or(`organization_name.ilike.%${term}%,contact_name.ilike.%${term}%,phone.ilike.%${term}%`);
    q.then(({ data }) => {
      if (!active) return;
      setRows((data as any[]) || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [query, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setLead(null);
      return;
    }
    supabase
      .from('b2g_leads' as any)
      .select('*')
      .eq('id', selectedId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast({ title: 'Opportunity could not be loaded', description: error?.message, variant: 'destructive' });
          setParams({ tab: 'sheets' }, { replace: true });
          return;
        }
        setLead(data);
      });
  }, [selectedId]);

  const update = async (patch: any) => {
    const { result, skipped } = await writeWithFallback((body) => supabase.from('b2g_leads' as any).update(body).eq('id', selectedId), patch);
    if (result.error) {
      toast({ title: 'Update failed', description: result.error.message, variant: 'destructive' });
      return;
    }
    setLead((current: any) => ({ ...current, ...patch }));
    toast({ title: 'Saved', description: skippedMessage(skipped) });
  };

  if (selectedId) {
    return (
      <div className="space-y-4">
        <button onClick={() => setParams({ tab: 'sheets' })} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          All opportunity sheets
        </button>
        {lead ? (
          <>
            <div>
              <h2 className="text-xl font-bold">{lead.organization_name}</h2>
              <p className="text-sm text-muted-foreground">{[lead.contact_name, lead.phone].filter(Boolean).join(' · ')}</p>
            </div>
            <LeadOpportunitySheet key={lead.id} lead={lead} update={update} />
          </>
        ) : (
          <div className="h-48 animate-pulse rounded-2xl bg-white" />
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Technical, commercial and BOQ details for an opportunity. Search a client and open its sheet.
      </p>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="bg-white pl-9" placeholder="Search client, contact or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <Card key={row.id} className="cursor-pointer border-0 shadow-sm" onClick={() => setParams({ tab: 'sheets', sheet: row.id })}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{row.organization_name}</p>
                <p className="truncate text-xs text-muted-foreground">{[row.contact_name, row.industry].filter(Boolean).join(' · ')}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">BOQ: {nice(row.boq_status) || 'Not Started'}</Badge>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </CardContent>
          </Card>
        ))}
        {!rows.length && !loading && <div className="rounded-2xl bg-white py-12 text-center text-sm text-muted-foreground lg:col-span-2">No clients found.</div>}
      </div>
    </div>
  );
}
