-- MK & Associates / TenderExpert - B2G CRM Platform
-- Safe, additive migration. Paste into Supabase SQL Editor and run once.

create extension if not exists pgcrypto;

do $$ begin
  create type public.b2g_pipeline as enum ('brand_approval','government_business_development','tender_consultancy');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.lead_heat as enum ('hot','warm','cold');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_model as enum ('80_20','70_30','50_50','milestone','monthly_retainer','success_fee');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.collection_status as enum ('not_due','partially_paid','paid','overdue','waived');
exception when duplicate_object then null; end $$;

create table if not exists public.b2g_leads (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  contact_name text not null,
  phone text not null,
  email text,
  website text,
  industry text not null,
  state text,
  city text,
  pipeline public.b2g_pipeline not null,
  stage text not null,
  service_interest text[] not null default '{}',
  source text not null default 'manual_entry',
  heat public.lead_heat not null default 'warm',
  ai_score smallint not null default 50 check (ai_score between 0 and 100),
  ai_summary text,
  next_best_action text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  proposal_value numeric(14,2) not null default 0 check (proposal_value >= 0),
  expected_revenue numeric(14,2) not null default 0 check (expected_revenue >= 0),
  probability smallint not null default 20 check (probability between 0 and 100),
  expected_close_date date,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  notes text,
  lost_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_pipeline_stage check (
    (pipeline = 'brand_approval' and stage = any(array['new_lead','qualified_lead','meeting_scheduled','documents_requested','documents_received','proposal_submitted','negotiation','advance_received','project_started','submission_completed','under_process','approval_completed','final_payment_received','closed'])) or
    (pipeline = 'government_business_development' and stage = any(array['new_lead','business_assessment','opportunity_discussion','proposal_submitted','negotiation','agreement_signed','project_active','technical_presentation','opportunity_identification','tender_support','order_conversion','completed'])) or
    (pipeline = 'tender_consultancy' and stage = any(array['tender_identified','client_discussion','tender_evaluation','go_no_go_decision','proposal_submitted','work_order_received','bid_submission','result_awaited','order_received','completed']))
  )
);

create table if not exists public.b2g_activities (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('call','email','whatsapp','meeting','note','task','stage_change','document','proposal')),
  subject text not null, description text, outcome text, due_at timestamptz, completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(), created_at timestamptz not null default now()
);

create table if not exists public.b2g_projects (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.b2g_leads(id) on delete restrict,
  project_name text not null, scope text, payment_model public.payment_model not null,
  contract_value numeric(14,2) not null default 0 check (contract_value >= 0), gst_rate numeric(5,2) not null default 18 check (gst_rate between 0 and 100),
  gst_amount numeric(14,2) generated always as (round(contract_value * gst_rate / 100, 2)) stored,
  start_date date, target_completion_date date, status text not null default 'planned' check (status in ('planned','active','on_hold','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.b2g_payment_milestones (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.b2g_projects(id) on delete cascade,
  milestone_name text not null, sequence_no smallint not null default 1, percentage numeric(5,2) check (percentage between 0 and 100),
  amount numeric(14,2) not null check (amount >= 0), gst_amount numeric(14,2) not null default 0 check (gst_amount >= 0),
  due_date date, amount_received numeric(14,2) not null default 0 check (amount_received >= 0), received_at timestamptz,
  status public.collection_status not null default 'not_due', invoice_number text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id, sequence_no), check (amount_received <= amount + gst_amount)
);

create table if not exists public.tender_opportunities (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.b2g_leads(id) on delete set null,
  tender_title text not null, tender_number text, authority_name text not null, department text, portal_url text,
  state text, category text, estimated_value numeric(16,2), emd_amount numeric(14,2), submission_deadline timestamptz,
  go_no_go text not null default 'pending' check (go_no_go in ('pending','go','no_go')),
  match_score smallint check (match_score between 0 and 100), ai_analysis text, status text not null default 'identified',
  owner_id uuid references auth.users(id) on delete set null, created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.b2g_documents (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.b2g_leads(id) on delete cascade,
  project_id uuid references public.b2g_projects(id) on delete cascade, document_type text not null, file_name text not null,
  storage_path text not null, version integer not null default 1, uploaded_by uuid references auth.users(id) on delete set null default auth.uid(), created_at timestamptz not null default now(),
  check (lead_id is not null or project_id is not null)
);

create index if not exists b2g_leads_assigned_stage_idx on public.b2g_leads(assigned_to, pipeline, stage);
create index if not exists b2g_leads_followup_idx on public.b2g_leads(next_follow_up_at) where next_follow_up_at is not null and closed_at is null;
create index if not exists b2g_leads_heat_score_idx on public.b2g_leads(heat, ai_score desc);
create index if not exists b2g_activities_lead_created_idx on public.b2g_activities(lead_id, created_at desc);
create index if not exists b2g_milestones_due_idx on public.b2g_payment_milestones(due_date) where status in ('not_due','partially_paid','overdue');
create index if not exists tender_deadline_idx on public.tender_opportunities(submission_deadline) where go_no_go <> 'no_go';

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists b2g_leads_updated_at on public.b2g_leads;
create trigger b2g_leads_updated_at before update on public.b2g_leads for each row execute function public.set_updated_at();
drop trigger if exists b2g_projects_updated_at on public.b2g_projects;
create trigger b2g_projects_updated_at before update on public.b2g_projects for each row execute function public.set_updated_at();
drop trigger if exists b2g_milestones_updated_at on public.b2g_payment_milestones;
create trigger b2g_milestones_updated_at before update on public.b2g_payment_milestones for each row execute function public.set_updated_at();
drop trigger if exists tender_updated_at on public.tender_opportunities;
create trigger tender_updated_at before update on public.tender_opportunities for each row execute function public.set_updated_at();

create or replace view public.b2g_revenue_summary with (security_invoker = true) as
select p.id project_id, p.project_name, p.contract_value, p.gst_amount,
  coalesce(sum(m.amount_received),0) received,
  coalesce(sum(m.amount + m.gst_amount - m.amount_received),0) outstanding,
  min(m.due_date) filter (where m.status in ('not_due','partially_paid','overdue')) next_due_date
from public.b2g_projects p left join public.b2g_payment_milestones m on m.project_id=p.id group by p.id;

alter table public.b2g_leads enable row level security;
alter table public.b2g_activities enable row level security;
alter table public.b2g_projects enable row level security;
alter table public.b2g_payment_milestones enable row level security;
alter table public.tender_opportunities enable row level security;
alter table public.b2g_documents enable row level security;

do $$ declare t text; begin
  foreach t in array array['b2g_leads','b2g_activities','b2g_projects','b2g_payment_milestones','tender_opportunities','b2g_documents'] loop
    execute format('drop policy if exists "team_select_%1$s" on public.%1$I', t);
    execute format('create policy "team_select_%1$s" on public.%1$I for select to authenticated using ((select auth.uid()) is not null)', t);
    execute format('drop policy if exists "team_insert_%1$s" on public.%1$I', t);
    execute format('create policy "team_insert_%1$s" on public.%1$I for insert to authenticated with check ((select auth.uid()) is not null)', t);
    execute format('drop policy if exists "team_update_%1$s" on public.%1$I', t);
    execute format('create policy "team_update_%1$s" on public.%1$I for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)', t);
    execute format('drop policy if exists "team_delete_%1$s" on public.%1$I', t);
    execute format('create policy "team_delete_%1$s" on public.%1$I for delete to authenticated using ((select auth.uid()) is not null)', t);
  end loop;
end $$;

grant select, insert, update, delete on public.b2g_leads, public.b2g_activities, public.b2g_projects, public.b2g_payment_milestones, public.tender_opportunities, public.b2g_documents to authenticated;
grant select on public.b2g_revenue_summary to authenticated;

