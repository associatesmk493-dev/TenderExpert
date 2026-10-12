-- Proposal GST on leads, campaign "interested" flag, client GST / contact on invoices.
alter table public.b2g_leads
  add column if not exists proposal_gst_rate numeric(5,2) not null default 0 check (proposal_gst_rate between 0 and 100),
  add column if not exists campaign_interested boolean not null default false;

create index if not exists b2g_leads_campaign_idx
  on public.b2g_leads (campaign_name, campaign_interested);

alter table public.proforma_invoices
  add column if not exists bill_to_gst text,
  add column if not exists bill_to_contact text;

alter table public.tax_invoices
  add column if not exists bill_to_gst text,
  add column if not exists bill_to_contact text;
