create table if not exists public.proforma_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  company_id uuid not null references public.companies(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  gst_rate numeric(5,2) not null default 18 check (gst_rate between 0 and 100),
  notes text,
  status text not null default 'draft' check (status in ('draft','sent','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  company_id uuid not null references public.companies(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  gst_rate numeric(5,2) not null default 18 check (gst_rate between 0 and 100),
  notes text,
  status text not null default 'draft' check (status in ('draft','sent','paid','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proforma_invoices enable row level security;
alter table public.tax_invoices enable row level security;
do $$ declare t text; begin for t in select unnest(array['proforma_invoices','tax_invoices']) loop
  execute format('drop policy if exists invoice_select on public.%I', t);
  execute format('create policy invoice_select on public.%I for select to authenticated using (true)', t);
  execute format('drop policy if exists invoice_insert on public.%I', t);
  execute format('create policy invoice_insert on public.%I for insert to authenticated with check ((select auth.uid()) = created_by)', t);
  execute format('drop policy if exists invoice_update on public.%I', t);
  execute format('create policy invoice_update on public.%I for update to authenticated using (true) with check (true)', t);
end loop; end $$;
grant select, insert, update on public.proforma_invoices, public.tax_invoices to authenticated;

