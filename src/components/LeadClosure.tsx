/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Flag, GitBranch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { skippedMessage, writeWithFallback } from '@/lib/writeWithFallback';

const OUTCOMES = [
  { value: 'completed', label: 'Completed (won)' },
  { value: 'no_further', label: 'No further business' },
  { value: 'next_phase', label: 'Next phase started' },
];
// The business funnel: what a client can buy next. Each step opens as a new opportunity in New leads.
const FUNNEL = [
  { key: 'brand_approval', label: 'Brand Approval', pipeline: 'brand_approval', service: 'Brand / Product Approval' },
  { key: 'brand_addition', label: 'Brand Addition', pipeline: 'brand_approval', service: 'Brand Addition' },
  { key: 'business_development', label: 'Business Development', pipeline: 'government_business_development', service: 'Government Business Development' },
  { key: 'presentation', label: 'Presentation', pipeline: 'government_business_development', service: 'Technical Presentation' },
  { key: 'tender_consultancy', label: 'Tender Consultancy', pipeline: 'tender_consultancy', service: 'Tender Consultancy' },
  { key: 'collaboration', label: 'Collaboration', pipeline: 'collaboration', service: null },
] as const;

// Where this lead sits in the client's funnel: the step it came from and the steps that followed.
export function LeadPhases({ lead }: { lead: any }) {
  const navigate = useNavigate();
  const [parent, setParent] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const [p, c] = await Promise.all([
        lead.parent_lead_id ? supabase.from('b2g_leads' as any).select('id,organization_name,phase_no').eq('id', lead.parent_lead_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.from('b2g_leads' as any).select('id,organization_name,phase_no,stage').eq('parent_lead_id', lead.id).order('phase_no'),
      ]);
      if (!active) return;
      setParent(p.error ? null : p.data);
      setChildren(c.error ? [] : ((c.data as any[]) || []));
    })();
    return () => {
      active = false;
    };
  }, [lead.id, lead.parent_lead_id]);

  if (!parent && !children.length && !(Number(lead.phase_no) > 1)) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 px-4 py-2.5 text-sm text-violet-800">
      <GitBranch className="h-4 w-4 shrink-0" />
      <span className="font-semibold">Funnel step {Number(lead.phase_no) || 1}</span>
      {parent && (
        <button type="button" className="underline underline-offset-2" onClick={() => navigate(`/leads/${parent.id}`)}>
          came from step {parent.phase_no || 1}
        </button>
      )}
      {children.map((child) => (
        <button key={child.id} type="button" className="flex items-center gap-1 underline underline-offset-2" onClick={() => navigate(`/leads/${child.id}`)}>
          <ArrowRight className="h-3.5 w-3.5" />
          Next: step {child.phase_no || 2}
        </button>
      ))}
    </div>
  );
}

// Shown on a closed lead: how it ended, and the option to continue the relationship as the next phase.
export default function LeadClosure({ lead, onSave }: { lead: any; onSave: (patch: Record<string, any>) => Promise<void> | void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const startNextStep = async (option: (typeof FUNNEL)[number]) => {
    if (!window.confirm(`Open “${option.label}” as a new opportunity for ${lead.organization_name}?`)) return;
    const pipeline: string = option.pipeline;
    setBusy(true);
    const phase = (Number(lead.phase_no) || 1) + 1;
    const row: Record<string, any> = {
      organization_name: lead.organization_name,
      contact_name: lead.contact_name,
      contact_designation: lead.contact_designation || null,
      phone: lead.phone,
      email: lead.email || null,
      website: lead.website || null,
      gst_number: lead.gst_number || null,
      industry: lead.industry,
      city: lead.city || null,
      state: lead.state || null,
      contacts: lead.contacts || [],
      company_research: lead.company_research || null,
      company_id: lead.company_id || null,
      pipeline,
      stage: pipeline === 'tender_consultancy' ? 'tender_identified' : 'new_lead',
      source: lead.source,
      heat: lead.heat,
      service_interest: option.service ? [option.service] : [],
      notes: `Next funnel step: ${option.label}, following the earlier engagement with ${lead.organization_name}`,
      parent_lead_id: lead.id,
      phase_no: phase,
      proposal_value: 0,
      expected_revenue: 0,
      probability: 0,
      assigned_to: lead.assigned_to || user?.id,
      created_by: user?.id,
    };
    const { result, skipped } = await writeWithFallback((body) => supabase.from('b2g_leads' as any).insert(body).select('id').single(), row);
    setBusy(false);
    if (result.error) {
      toast({ title: 'Next step not created', description: result.error.message, variant: 'destructive' });
      return;
    }
    await onSave({ closure_outcome: 'next_phase' });
    toast({ title: `${option.label} opened`, description: skippedMessage(skipped) || 'It is in New leads, with the company details copied over.' });
    navigate(`/leads/${(result.data as any).id}`);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <Flag className="h-4 w-4" />
          How this lead ended
        </h2>
        <p className="text-xs text-muted-foreground">The agreed amount of a completed lead counts as booked revenue on the Dashboard.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Outcome</span>
            <Select value={lead.closure_outcome || undefined} onValueChange={(value) => onSave({ closure_outcome: value })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choose the outcome" /></SelectTrigger>
              <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Agreed amount</p>
            <p className="font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(lead.expected_revenue) || 0)}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border p-3">
          <p className="text-sm font-semibold">What does this client need next?</p>
          <p className="text-xs text-muted-foreground">Pick the next step in the funnel. It opens as a new opportunity in New leads, with company, contacts, GST and research copied over.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FUNNEL.map((option) => (
              <Button key={option.key} type="button" variant="outline" size="sm" disabled={busy} onClick={() => startNextStep(option)}>
                <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
