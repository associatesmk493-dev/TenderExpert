create table if not exists public.invoice_company_settings (
  id uuid primary key default gen_random_uuid(), company_name text not null default '', email text, phone text,
  address text, gst_number text, logo_url text, bank_name text, account_name text, account_number text,
  ifsc_code text, terms_conditions text, qr_code_url text, updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.invoice_company_settings enable row level security;
drop policy if exists invoice_settings_select on public.invoice_company_settings;
create policy invoice_settings_select on public.invoice_company_settings for select to authenticated using (true);
drop policy if exists invoice_settings_write on public.invoice_company_settings;
create policy invoice_settings_write on public.invoice_company_settings for all to authenticated using (true) with check (true);
grant select, insert, update on public.invoice_company_settings to authenticated;
insert into public.invoice_company_settings (company_name) select '' where not exists (select 1 from public.invoice_company_settings);
