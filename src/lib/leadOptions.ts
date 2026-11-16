export const LEAD_SOURCES = [
  'manual_entry',
  'website',
  'whatsapp',
  'email',
  'referral',
  'indiamart',
  'justdial',
  'tender_portal',
  'event',
] as const;

const SOURCE_LABELS: Record<string, string> = {
  indiamart: 'IndiaMART',
  justdial: 'JustDial',
  whatsapp: 'WhatsApp',
};

export const sourceLabel = (value?: string | null) =>
  !value
    ? '—'
    : SOURCE_LABELS[value] || value.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase());

export const INDUSTRIES = [
  'Manufacturing',
  'Technology',
  'Water & Wastewater',
  'Infrastructure',
  'Contractor',
  'Engineering',
  'Healthcare',
  'Industrial Products',
  'Other',
];

export const SERVICES = [
  'Brand / Product Approval',
  'Brand Addition',
  'Government Market Entry',
  'Tender Consultancy',
  'Government Business Development',
  'CPWD Class Registration',
  'Technical Presentation',
  'BOQ & Specification Support',
  'Tender Intelligence',
];

export const LOST_REASONS = [
  'not_interested',
  'price',
  'competitor',
  'budget_freeze',
  'no_response',
  'timeline',
  'scope_mismatch',
  'project_cancelled',
  'lost_to_incumbent',
  'other',
];

// Leads that arrived through a campaign stay in Campaigns until someone marks them interested.
export const inLeadsList = (lead: { campaign_name?: string | null; campaign_interested?: boolean | null }) =>
  !lead.campaign_name || Boolean(lead.campaign_interested);

export const fromCampaign = (lead: { campaign_name?: string | null; campaign_interested?: boolean | null }) =>
  Boolean(lead.campaign_name && lead.campaign_interested);

export const CLOSED_STAGES =['closed', 'completed', 'final_payment_received'];

// "New" = just came in, not yet worked on. "Qualified" = any open lead that has moved past that first stage.
export const NEW_STAGES = ['new_lead', 'tender_identified'];
export const QUALIFIED_STAGE: Record<string, string> = {
  brand_approval: 'qualified_lead',
  government_business_development: 'business_assessment',
  tender_consultancy: 'client_discussion',
  collaboration: 'qualified_lead',
};
export const isNewLead = (lead: { stage?: string }) => NEW_STAGES.includes(lead.stage || '');

// A lead is "lost" when a lost reason is recorded; "closed" when it finished normally.
export const leadState = (lead: { lost_reason_code?: string | null; closed_at?: string | null; stage?: string }) =>
  lead.lost_reason_code ? 'lost' : lead.closed_at || CLOSED_STAGES.includes(lead.stage || '') ? 'closed' : 'active';
