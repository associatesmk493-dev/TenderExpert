-- TenderExpert CRM: additive repair for an existing Supabase project.
-- Paste the complete file into Supabase Dashboard > SQL Editor and click Run.
-- Existing records are retained. The script can safely be run more than once.

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
  industry text not null default 'Other',
  pipeline public.b2g_pipeline not null default 'brand_approval',
  stage text not null default 'new_lead'
);

alter table public.b2g_leads
  add column if not exists organization_name text,
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists industry text default 'Other',
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists pipeline public.b2g_pipeline default 'brand_approval',
  add column if not exists stage text default 'new_lead',
  add column if not exists service_interest text[] not null default '{}',
  add column if not exists source text not null default 'manual_entry',
  add column if not exists campaign_name text,
  add column if not exists heat public.lead_heat not null default 'warm',
  add column if not exists ai_score smallint not null default 50,
  add column if not exists ai_summary text,
  add column if not exists next_best_action text,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists proposal_value numeric(14,2) not null default 0,
  add column if not exists expected_revenue numeric(14,2) not null default 0,
  add column if not exists probability smallint not null default 20,
  add column if not exists expected_close_date date,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists notes text,
  add column if not exists lost_reason text,
  add column if not exists closed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.b2g_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  activity_type text not null default 'note',
  subject text not null,
  description text,
  outcome text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.b2g_activities
  add column if not exists description text,
  add column if not exists outcome text,
  add column if not exists due_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.b2g_projects (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2g_leads(id) on delete restrict,
  project_name text not null,
  payment_model public.payment_model not null default '80_20',
  contract_value numeric(14,2) not null default 0,
  gst_rate numeric(5,2) not null default 18,
  gst_amount numeric(14,2) generated always as (round(contract_value * gst_rate / 100, 2)) stored
);

alter table public.b2g_projects
  add column if not exists scope text,
  add column if not exists payment_model public.payment_model default '80_20',
  add column if not exists contract_value numeric(14,2) not null default 0,
  add column if not exists gst_rate numeric(5,2) not null default 18,
  add column if not exists gst_amount numeric(14,2) generated always as (round(contract_value * gst_rate / 100, 2)) stored,
  add column if not exists start_date date,
  add column if not exists target_completion_date date,
  add column if not exists status text not null default 'planned',
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.b2g_payment_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.b2g_projects(id) on delete cascade,
  milestone_name text not null,
  amount numeric(14,2) not null default 0
);

alter table public.b2g_payment_milestones
  add column if not exists sequence_no smallint not null default 1,
  add column if not exists percentage numeric(5,2),
  add column if not exists gst_amount numeric(14,2) not null default 0,
  add column if not exists due_date date,
  add column if not exists amount_received numeric(14,2) not null default 0,
  add column if not exists received_at timestamptz,
  add column if not exists status public.collection_status not null default 'not_due',
  add column if not exists invoice_number text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.b2g_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.b2g_leads(id) on delete cascade,
  title text not null,
  due_at timestamptz not null
);

alter table public.b2g_tasks
  add column if not exists description text,
  add column if not exists task_type text not null default 'follow_up',
  add column if not exists priority text not null default 'medium',
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists completed_at timestamptz,
  add column if not exists escalation_level smallint not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.b2g_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid references public.b2g_leads(id) on delete cascade,
  task_id uuid references public.b2g_tasks(id) on delete cascade,
  notification_type text not null,
  title text not null
);

alter table public.b2g_notifications
  add column if not exists message text,
  add column if not exists severity text not null default 'info',
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.b2g_document_links (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  title text not null,
  url text not null check (url ~* '^https?://')
);

alter table public.b2g_document_links
  add column if not exists document_type text not null default 'drive_link',
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.tender_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.b2g_leads(id) on delete set null,
  tender_title text not null,
  authority_name text not null,
  tender_number text,
  department text,
  portal_url text,
  state text,
  category text,
  estimated_value numeric(16,2),
  emd_amount numeric(14,2),
  submission_deadline timestamptz,
  go_no_go text not null default 'pending',
  match_score smallint,
  ai_analysis text,
  status text not null default 'identified',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pipeline public.b2g_pipeline,
  subject_template text not null,
  body_template text not null,
  terms_template text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.b2g_proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  template_id uuid references public.proposal_templates(id) on delete set null,
  proposal_number text not null unique,
  subject text not null,
  scope text not null,
  commercial_terms text,
  payment_model public.payment_model not null default '80_20',
  subtotal numeric(14,2) not null default 0,
  gst_rate numeric(5,2) not null default 18,
  gst_amount numeric(14,2) generated always as (round(subtotal * gst_rate / 100, 2)) stored,
  status text not null default 'draft',
  valid_until date,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles add column if not exists phone text;
    alter table public.profiles add column if not exists email text;
    alter table public.profiles add column if not exists avatar_url text;
    alter table public.profiles add column if not exists date_of_birth date;
    alter table public.profiles add column if not exists date_of_joining date;
  end if;
end $$;

create index if not exists b2g_leads_owner_idx on public.b2g_leads(created_by, assigned_to);
create index if not exists b2g_leads_followup_idx on public.b2g_leads(next_follow_up_at)
  where next_follow_up_at is not null and closed_at is null;
create index if not exists b2g_leads_heat_score_idx on public.b2g_leads(heat, ai_score desc);
create index if not exists b2g_leads_campaign_idx on public.b2g_leads(campaign_name) where campaign_name is not null;
create index if not exists b2g_activities_lead_created_idx on public.b2g_activities(lead_id, created_at desc);
create index if not exists b2g_projects_lead_idx on public.b2g_projects(lead_id);
create index if not exists b2g_payment_milestones_project_idx on public.b2g_payment_milestones(project_id);
create index if not exists b2g_tasks_due_open_idx on public.b2g_tasks(due_at, priority) where completed_at is null;
create index if not exists b2g_tasks_assigned_idx on public.b2g_tasks(assigned_to);
create index if not exists b2g_document_links_lead_created_idx on public.b2g_document_links(lead_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.b2g_notifications(user_id, created_at desc) where read_at is null;
create index if not exists b2g_proposals_lead_idx on public.b2g_proposals(lead_id);
create index if not exists tender_opportunities_lead_idx on public.tender_opportunities(lead_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['b2g_leads','b2g_projects','b2g_payment_milestones','b2g_tasks','tender_opportunities','proposal_templates','b2g_proposals'] loop
    execute format('drop trigger if exists tenderexpert_updated_at on public.%I', table_name);
    execute format('create trigger tenderexpert_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

-- The application is currently a single-owner CRM. Policies restrict private
-- records to their creator/assignee while retaining unassigned legacy/demo rows.
-- Remove obsolete permissive policies first: PostgreSQL combines policies with OR.
do $$ declare existing_policy record; begin
  for existing_policy in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in (
        'b2g_leads','b2g_activities','b2g_projects','b2g_payment_milestones',
        'b2g_tasks','b2g_notifications','b2g_document_links',
        'tender_opportunities','proposal_templates','b2g_proposals'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  end loop;
end $$;

alter table public.b2g_leads enable row level security;
drop policy if exists tenderexpert_owner_leads on public.b2g_leads;
create policy tenderexpert_owner_leads on public.b2g_leads for all to authenticated
  using (created_by = (select auth.uid()) or assigned_to = (select auth.uid()) or (created_by is null and assigned_to is null))
  with check (created_by = (select auth.uid()) or assigned_to = (select auth.uid()));

alter table public.b2g_tasks enable row level security;
drop policy if exists tenderexpert_owner_tasks on public.b2g_tasks;
create policy tenderexpert_owner_tasks on public.b2g_tasks for all to authenticated
  using (created_by = (select auth.uid()) or assigned_to = (select auth.uid()) or (created_by is null and assigned_to is null))
  with check (created_by = (select auth.uid()) or assigned_to = (select auth.uid()));

alter table public.b2g_notifications enable row level security;
drop policy if exists tenderexpert_owner_notifications on public.b2g_notifications;
create policy tenderexpert_owner_notifications on public.b2g_notifications for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

do $$ declare table_name text; begin
  foreach table_name in array array['b2g_activities','b2g_projects','b2g_document_links','tender_opportunities','b2g_proposals'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists tenderexpert_owner_related on public.%I', table_name);
    execute format(
      'create policy tenderexpert_owner_related on public.%1$I for all to authenticated using ((lead_id is null and created_by = (select auth.uid())) or exists (select 1 from public.b2g_leads l where l.id = %1$I.lead_id and (l.created_by = (select auth.uid()) or l.assigned_to = (select auth.uid()) or (l.created_by is null and l.assigned_to is null)))) with check ((lead_id is null and created_by = (select auth.uid())) or exists (select 1 from public.b2g_leads l where l.id = %1$I.lead_id and (l.created_by = (select auth.uid()) or l.assigned_to = (select auth.uid()) or (l.created_by is null and l.assigned_to is null))))',
      table_name
    );
  end loop;
end $$;

alter table public.b2g_payment_milestones enable row level security;
drop policy if exists tenderexpert_owner_milestones on public.b2g_payment_milestones;
create policy tenderexpert_owner_milestones on public.b2g_payment_milestones for all to authenticated
  using (exists (select 1 from public.b2g_projects p where p.id = project_id))
  with check (exists (select 1 from public.b2g_projects p where p.id = project_id));

alter table public.proposal_templates enable row level security;
drop policy if exists tenderexpert_owner_templates on public.proposal_templates;
create policy tenderexpert_owner_templates on public.proposal_templates for all to authenticated
  using (created_by = (select auth.uid()) or created_by is null)
  with check (created_by = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.b2g_leads, public.b2g_activities, public.b2g_projects,
  public.b2g_payment_milestones, public.b2g_tasks, public.b2g_notifications,
  public.b2g_document_links, public.tender_opportunities,
  public.proposal_templates, public.b2g_proposals
to authenticated;

create or replace function public.refresh_b2g_escalations()
returns integer language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  update public.b2g_tasks
  set escalation_level = case when due_at < now() - interval '48 hours' then 2 else 1 end
  where completed_at is null and due_at < now()
    and escalation_level < case when due_at < now() - interval '48 hours' then 2 else 1 end;
  get diagnostics affected = row_count;

  insert into public.b2g_notifications(user_id, lead_id, task_id, notification_type, title, message, severity)
  select t.assigned_to, t.lead_id, t.id, 'overdue_follow_up', 'Overdue: ' || t.title,
    'Follow-up was due ' || to_char(t.due_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'),
    case when t.escalation_level >= 2 then 'urgent' else 'warning' end
  from public.b2g_tasks t
  where t.completed_at is null and t.due_at < now()
    and t.assigned_to = (select auth.uid())
    and not exists (
      select 1 from public.b2g_notifications n
      where n.task_id = t.id and n.notification_type = 'overdue_follow_up' and n.read_at is null
    );
  return affected;
end;
$$;

grant execute on function public.refresh_b2g_escalations() to authenticated;

-- Verification: the SQL Editor should return these tables and their columns.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'b2g_leads','b2g_activities','b2g_projects','b2g_payment_milestones',
    'b2g_tasks','b2g_notifications','b2g_document_links',
    'tender_opportunities','proposal_templates','b2g_proposals'
  )
order by table_name, ordinal_position;
