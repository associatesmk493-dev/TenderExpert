alter table public.proforma_invoices add column if not exists lead_id uuid references public.b2g_leads(id) on delete set null;
alter table public.tax_invoices add column if not exists lead_id uuid references public.b2g_leads(id) on delete set null;
create index if not exists proforma_invoices_lead_idx on public.proforma_invoices(lead_id);
create index if not exists tax_invoices_lead_idx on public.tax_invoices(lead_id);
