-- 1. "Generate PI" pipeline stage (sits between Negotiation and Advance Received)
alter table public.b2g_leads drop constraint if exists valid_pipeline_stage;
alter table public.b2g_leads add constraint valid_pipeline_stage check (
  (pipeline = 'brand_approval' and stage = any(array['new_lead','qualified_lead','meeting_scheduled','documents_requested','documents_received','proposal_submitted','negotiation','generate_pi','advance_received','project_started','submission_completed','under_process','approval_completed','final_payment_received','closed'])) or
  (pipeline = 'government_business_development' and stage = any(array['new_lead','business_assessment','opportunity_discussion','proposal_submitted','negotiation','generate_pi','agreement_signed','project_active','technical_presentation','opportunity_identification','tender_support','order_conversion','completed'])) or
  (pipeline = 'tender_consultancy' and stage = any(array['tender_identified','client_discussion','tender_evaluation','go_no_go_decision','proposal_submitted','generate_pi','work_order_received','bid_submission','result_awaited','order_received','completed']))
);

-- 2. Company details printed on every invoice
alter table public.invoice_company_settings
  add column if not exists pan_number text,
  add column if not exists bank_branch text,
  add column if not exists website text,
  add column if not exists tagline text;

update public.invoice_company_settings set
  company_name   = coalesce(nullif(company_name, ''), 'M K & Associates'),
  tagline        = coalesce(nullif(tagline, ''), 'Strategic B2G Consulting & Procurement'),
  email          = coalesce(nullif(email, ''), 'connect@mkassociatess.com'),
  phone          = coalesce(nullif(phone, ''), '+91 9821180856'),
  website        = coalesce(nullif(website, ''), 'www.mkassociatess.com'),
  address        = coalesce(nullif(address, ''), '247 Workspace, Mega Mall, Phase - I, Golf Course Road, Gurugram, Haryana'),
  gst_number     = coalesce(nullif(gst_number, ''), '06ACEFM6974B1Z7'),
  pan_number     = coalesce(nullif(pan_number, ''), 'ACEFM6974B'),
  account_name   = coalesce(nullif(account_name, ''), 'M K & Associates'),
  account_number = coalesce(nullif(account_number, ''), '142263200000072'),
  ifsc_code      = coalesce(nullif(ifsc_code, ''), 'YESB0001422'),
  bank_name      = coalesce(nullif(bank_name, ''), 'YES BANK LTD'),
  bank_branch    = coalesce(nullif(bank_branch, ''), 'Sector-56, Gurugram');

-- 3. Invoice fields: GST type, bill-to snapshot, proforma -> tax link
alter table public.proforma_invoices alter column company_id drop not null;
alter table public.tax_invoices alter column company_id drop not null;

alter table public.proforma_invoices
  add column if not exists gst_type text not null default 'igst' check (gst_type in ('igst','cgst_sgst','none')),
  add column if not exists bill_to_name text,
  add column if not exists bill_to_address text,
  add column if not exists bill_to_phone text,
  add column if not exists bill_to_email text;

alter table public.tax_invoices
  add column if not exists gst_type text not null default 'igst' check (gst_type in ('igst','cgst_sgst','none')),
  add column if not exists bill_to_name text,
  add column if not exists bill_to_address text,
  add column if not exists bill_to_phone text,
  add column if not exists bill_to_email text,
  add column if not exists proforma_invoice_id uuid references public.proforma_invoices(id) on delete set null;

create unique index if not exists tax_invoices_one_per_proforma
  on public.tax_invoices (proforma_invoice_id) where proforma_invoice_id is not null;
