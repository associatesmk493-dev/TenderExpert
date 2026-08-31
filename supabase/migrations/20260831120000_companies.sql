-- ============================================================================
-- MK & Associates / TenderExpert CRM
-- COMPANIES LAYER
--
-- Purpose: give every opportunity (b2g_leads row) a persistent parent "company"
-- record, so when the same client returns later, their new opportunity attaches
-- to the same company instead of being matched by a typed name string.
--
--   companies (client, created once)
--      -> b2g_leads.company_id      (opportunity #1, #2, #3 ... over time)
--           -> b2g_projects.lead_id (order(s) inside an opportunity)
--                -> b2g_payment_milestones.project_id
--
-- Additive - idempotent - reversible. Paste into Supabase SQL Editor, run once.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Helper: normalize a company name (case + whitespace insensitive).
--    Reused by the generated column below and by the app for find-or-create.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_company_name(raw text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(regexp_replace(btrim(raw), '\s+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------------------
-- 1. companies table
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  normalized_name  text generated always as (public.normalize_company_name(name)) stored,
  phone            text,
  email            text,
  website          text,
  industry         text,
  city             text,
  state            text,
  gst_number       text,
  notes            text,
  owner_id         uuid references auth.users(id) on delete set null,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.companies is
  'Persistent client/organization record. One company has many b2g_leads (opportunities).';

-- One client record per distinct (case/space-insensitive) name.
-- This is what stops a returning client from being split by "ABC Ltd" vs "ABC  Limited".
create unique index if not exists companies_normalized_name_key
  on public.companies (normalized_name);

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger
--    (public.set_updated_at already exists from the B2G platform migration;
--     re-created here so this file also works standalone.)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Link b2g_leads -> companies
-- ---------------------------------------------------------------------------
alter table public.b2g_leads
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists b2g_leads_company_idx on public.b2g_leads (company_id);

-- ---------------------------------------------------------------------------
-- 4. Backfill existing data
-- ---------------------------------------------------------------------------

-- 4a. Create one company per distinct organization_name.
--     Contact details are seeded from that client's most recently updated lead.
insert into public.companies (name, phone, email, website, industry, city, state, created_by)
select distinct on (public.normalize_company_name(l.organization_name))
       btrim(l.organization_name)     as name,
       nullif(btrim(l.phone), '')     as phone,
       nullif(btrim(l.email), '')     as email,
       nullif(btrim(l.website), '')   as website,
       nullif(btrim(l.industry), '')  as industry,
       nullif(btrim(l.city), '')      as city,
       nullif(btrim(l.state), '')     as state,
       l.created_by
from public.b2g_leads l
where coalesce(btrim(l.organization_name), '') <> ''
order by public.normalize_company_name(l.organization_name),
         l.updated_at desc nulls last
on conflict (normalized_name) do nothing;

-- 4b. Point every existing opportunity at its company.
update public.b2g_leads l
set company_id = c.id
from public.companies c
where l.company_id is null
  and coalesce(btrim(l.organization_name), '') <> ''
  and c.normalized_name = public.normalize_company_name(l.organization_name);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security  (mirrors the other b2g_* tables:
--    any authenticated team member has full access)
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;

do $$
begin
  drop policy if exists "authenticated_select_companies" on public.companies;
  create policy "authenticated_select_companies" on public.companies
    for select to authenticated using ((select auth.uid()) is not null);

  drop policy if exists "authenticated_insert_companies" on public.companies;
  create policy "authenticated_insert_companies" on public.companies
    for insert to authenticated with check ((select auth.uid()) is not null);

  drop policy if exists "authenticated_update_companies" on public.companies;
  create policy "authenticated_update_companies" on public.companies
    for update to authenticated using ((select auth.uid()) is not null)
    with check ((select auth.uid()) is not null);

  drop policy if exists "authenticated_delete_companies" on public.companies;
  create policy "authenticated_delete_companies" on public.companies
    for delete to authenticated using ((select auth.uid()) is not null);
end $$;

grant select, insert, update, delete on public.companies to authenticated;
grant execute on function public.normalize_company_name(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Rollup view — powers the Clients list and the company 360 page
-- ---------------------------------------------------------------------------
create or replace view public.company_rollup with (security_invoker = true) as
select
  c.id,
  c.name,
  c.phone,
  c.email,
  c.industry,
  c.city,
  c.state,
  c.owner_id,
  c.created_at,
  count(l.id)                                                          as opportunity_count,
  count(l.id) filter (where l.closed_at is null)                       as open_opportunity_count,
  count(l.id) filter (where l.stage in
      ('closed','completed','final_payment_received','order_received','order_conversion'))
                                                                       as won_opportunity_count,
  coalesce(sum(l.proposal_value), 0)                                   as total_proposal_value,
  coalesce(sum(l.expected_revenue), 0)                                 as total_expected_revenue,
  max(l.updated_at)                                                    as last_activity_at,
  min(l.next_follow_up_at) filter
      (where l.next_follow_up_at is not null and l.closed_at is null)  as next_follow_up_at,
  coalesce((
    select sum(greatest(m.amount + m.gst_amount - m.amount_received, 0))
    from public.b2g_leads ll
    join public.b2g_projects p            on p.lead_id = ll.id
    join public.b2g_payment_milestones m  on m.project_id = p.id
    where ll.company_id = c.id
  ), 0)                                                               as outstanding_amount
from public.companies c
left join public.b2g_leads l on l.company_id = c.id
group by c.id;

grant select on public.company_rollup to authenticated;

-- ============================================================================
-- VERIFY (run these after; all counts should reconcile)
-- ============================================================================
-- select count(*) as companies from public.companies;
-- select count(*) as leads_total,
--        count(company_id) as leads_linked,
--        count(*) filter (where company_id is null) as leads_unlinked
-- from public.b2g_leads;
-- select * from public.company_rollup order by opportunity_count desc limit 20;

-- ============================================================================
-- ROLLBACK (if ever needed)
-- ============================================================================
-- drop view if exists public.company_rollup;
-- alter table public.b2g_leads drop column if exists company_id;
-- drop table if exists public.companies;
-- drop function if exists public.normalize_company_name(text);
