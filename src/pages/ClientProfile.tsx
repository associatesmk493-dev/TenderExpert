import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Phone, Mail, Building2, MapPin, Briefcase, Tag, Calendar, Clock, TrendingUp, FileText, User, Layers, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  FUNNEL_STAGES, TEMPERATURE_OPTIONS, SOURCE_PORTALS, REGIONS, INDUSTRIES, BUSINESS_TYPES,
  CALL_OUTCOMES, LEAD_TYPES,
  type Lead,
} from '@/types/crm';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const formatINR = (v: unknown) => {
  const n = Number(v);
  if (!v || isNaN(n)) return null;
  return '₹' + n.toLocaleString('en-IN');
};

const formatDate = (d: string | null | undefined) => {
  if (!d) return null;
  try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; }
};

type InfoRowProps = { icon: React.ReactNode; label: string; value: string; accent?: boolean };
const InfoRow = ({ icon, label, value, accent }: InfoRowProps) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-border/20 last:border-0">
    <span className="mt-0.5 shrink-0 text-muted-foreground/60">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-none mb-1">{label}</p>
      <p className={cn('text-[15px] font-medium leading-snug break-words', accent && 'text-primary')}>{value}</p>
    </div>
  </div>
);

type SectionProps = { title: string; icon: React.ReactNode; children: React.ReactNode };
const Section = ({ title, icon, children }: SectionProps) => (
  <div className="rounded-2xl bg-card/70 border border-border/20 overflow-hidden shadow-sm">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border/15 bg-muted/30">
      <span className="text-muted-foreground/70">{icon}</span>
      <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    </div>
    <div className="px-4 py-1">{children}</div>
  </div>
);

const ClientProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('leads').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setLead(data as unknown as Lead);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-3 animate-in">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">Client not found</p>
        <button onClick={() => navigate(-1)} className="text-primary text-[15px] font-medium">Go back</button>
      </div>
    );
  }

  const l = lead as any;
  const stage = FUNNEL_STAGES.find((s) => s.value === lead.funnel_stage);
  const temp = TEMPERATURE_OPTIONS.find((t) => t.value === lead.temperature);
  const source = SOURCE_PORTALS.find((s) => s.value === lead.source_portal);
  const region = REGIONS.find((r) => r.value === l.region);
  const industry = INDUSTRIES.find((i) => i.value === l.industry);
  const bizType = BUSINESS_TYPES.find((b) => b.value === l.business_type);
  const leadType = LEAD_TYPES.find((t) => t.value === l.lead_type);
  const callOutcome = CALL_OUTCOMES.find((c) => c.value === lead.last_call_outcome);

  const hasFinance = l.proposed_amount != null || l.quoted_amount != null || l.closed_amount != null;
  const hasDates = lead.follow_up_date || lead.walkin_date || lead.booking_date || lead.delivery_date;

  return (
    <div className="max-w-2xl mx-auto pb-10 animate-in">
      {/* Hero Card */}
      <div
        className="relative overflow-hidden px-5 pb-8 rounded-b-[2.5rem]"
        style={{
          background: 'var(--gradient-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        }}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, hsl(200 70% 65%), transparent 70%)' }} />
        <div className="pointer-events-none absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(240 60% 70%), transparent 70%)' }} />

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-foreground/60 hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[15px] font-medium">Back</span>
        </button>

        {/* Avatar + Name */}
        <div className="flex items-center gap-4 mb-5">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 shadow-lg"
            style={{ backgroundColor: stage?.color + '22', color: stage?.color, border: `2px solid ${stage?.color}44` }}
          >
            {lead.customer_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight truncate">{lead.customer_name}</h1>
            {l.owner_name && (
              <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{l.owner_name}</p>
            )}
            {l.company && (
              <p className="text-[13px] text-muted-foreground/70 truncate">{l.company}</p>
            )}
          </div>
        </div>

        {/* Stage + Temp + Source badges */}
        <div className="flex flex-wrap gap-2 mb-5">
          <Badge
            className="text-[12px] font-semibold border-0 rounded-xl px-3 py-1"
            style={{ backgroundColor: stage?.color + '22', color: stage?.color }}
          >
            {stage?.label}
          </Badge>
          <Badge className="text-[12px] font-medium border-0 rounded-xl px-3 py-1 bg-muted/60 text-foreground/80">
            {temp?.emoji} {temp?.label}
          </Badge>
          {source && (
            <Badge className="text-[12px] font-medium border-0 rounded-xl px-3 py-1 bg-muted/40 text-muted-foreground">
              {source.label}
            </Badge>
          )}
          {leadType && (
            <Badge className="text-[12px] font-medium border-0 rounded-xl px-3 py-1 bg-muted/40 text-muted-foreground">
              {leadType.label}
            </Badge>
          )}
        </div>

        {/* Quick action pills */}
        <div className="flex gap-2 flex-wrap">
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 text-foreground text-[14px] font-semibold active:scale-95 transition-transform hover:bg-white/15"
          >
            <Phone className="h-4 w-4" />
            {lead.phone}
          </a>
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 text-foreground text-[14px] font-medium active:scale-95 transition-transform hover:bg-white/15"
            >
              <Mail className="h-4 w-4" />
              <span className="truncate max-w-[160px]">{lead.email}</span>
            </a>
          )}
          <button
            onClick={() => navigate(`/leads/${id}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/20 border border-primary/30 text-primary text-[14px] font-semibold active:scale-95 transition-transform hover:bg-primary/30"
          >
            <ExternalLink className="h-4 w-4" />
            Open Lead
          </button>
        </div>
      </div>

      {/* Content sections */}
      <div className="px-4 -mt-4 space-y-3 pt-6 relative z-10">

        {/* Business Details */}
        {(l.company || l.owner_name || lead.email || region || industry || bizType) && (
          <Section title="Business Details" icon={<Building2 className="h-4 w-4" />}>
            {l.company && <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company" value={l.company} />}
            {l.owner_name && <InfoRow icon={<User className="h-4 w-4" />} label="Owner" value={l.owner_name} />}
            {lead.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email} />}
            {region && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Region" value={region.label} />}
            {industry && <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Industry" value={industry.label} />}
            {bizType && <InfoRow icon={<Layers className="h-4 w-4" />} label="Business Type" value={bizType.label} />}
          </Section>
        )}

        {/* Interest & Budget */}
        {(lead.car_interest || lead.budget || l.sub_category) && (
          <Section title="Interest & Budget" icon={<Tag className="h-4 w-4" />}>
            {lead.car_interest && <InfoRow icon={<Tag className="h-4 w-4" />} label="Equipment Interest" value={lead.car_interest} />}
            {lead.budget && <InfoRow icon={<TrendingUp className="h-4 w-4" />} label="Budget" value={lead.budget} />}
            {l.sub_category && <InfoRow icon={<Layers className="h-4 w-4" />} label="Campaign" value={l.sub_category} />}
          </Section>
        )}

        {/* Finance */}
        {hasFinance && (
          <Section title="Finance" icon={<TrendingUp className="h-4 w-4" />}>
            {formatINR(l.proposed_amount) && (
              <InfoRow icon={<TrendingUp className="h-4 w-4" />} label="Proposed Amount" value={formatINR(l.proposed_amount)!} />
            )}
            {formatINR(l.quoted_amount) && (
              <InfoRow icon={<TrendingUp className="h-4 w-4" />} label="Quoted Amount" value={formatINR(l.quoted_amount)!} />
            )}
            {formatINR(l.closed_amount) && (
              <InfoRow icon={<TrendingUp className="h-4 w-4" />} label="Closed Amount" value={formatINR(l.closed_amount)!} accent />
            )}
            {l.advance_amount != null && (
              <InfoRow icon={<TrendingUp className="h-4 w-4" />} label="Advance" value={formatINR(l.advance_amount) ?? '—'} />
            )}
          </Section>
        )}

        {/* Pipeline Dates */}
        {hasDates && (
          <Section title="Pipeline Dates" icon={<Calendar className="h-4 w-4" />}>
            {lead.follow_up_date && (
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Follow-up Date" value={formatDate(lead.follow_up_date)!} />
            )}
            {lead.walkin_date && (
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Walk-in Date" value={formatDate(lead.walkin_date)!} />
            )}
            {lead.booking_date && (
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Booking Date" value={formatDate(lead.booking_date)!} />
            )}
            {lead.delivery_date && (
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Delivery Date" value={formatDate(lead.delivery_date)!} accent />
            )}
          </Section>
        )}

        {/* Last Interaction */}
        {(callOutcome || lead.rnr_count > 0) && (
          <Section title="Last Interaction" icon={<Phone className="h-4 w-4" />}>
            {callOutcome && (
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Last Call Outcome" value={callOutcome.label} />
            )}
            {(lead.rnr_count ?? 0) > 0 && (
              <InfoRow icon={<Phone className="h-4 w-4" />} label="RNR Attempts" value={`${lead.rnr_count} time${lead.rnr_count > 1 ? 's' : ''} — No Response`} />
            )}
            <InfoRow icon={<Clock className="h-4 w-4" />} label="Last Updated" value={formatDate(lead.updated_at)!} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Lead Created" value={formatDate(lead.created_at)!} />
          </Section>
        )}

        {/* Notes */}
        {lead.notes && (
          <Section title="Notes" icon={<FileText className="h-4 w-4" />}>
            <p className="text-[15px] text-foreground/80 leading-relaxed py-3 whitespace-pre-wrap">{lead.notes}</p>
          </Section>
        )}

        {/* Meta */}
        <Section title="Lead Info" icon={<Layers className="h-4 w-4" />}>
          <InfoRow icon={<Tag className="h-4 w-4" />} label="Source" value={source?.label ?? lead.source_portal} />
          {leadType && <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Lead Type" value={leadType.label} />}
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="Created On" value={formatDate(lead.created_at)!} />
        </Section>
      </div>
    </div>
  );
};

export default ClientProfile;
