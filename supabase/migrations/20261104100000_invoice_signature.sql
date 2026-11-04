-- Authorised signature image printed above "Authorised Signatory" on invoices.
alter table public.invoice_company_settings
  add column if not exists signature_url text;

notify pgrst, 'reload schema';
