-- Voice-first daily meeting records, decision fields and collection dashboard.

alter table public.b2g_leads
  add column if not exists advance_amount numeric(14,2) not null default 0 check (advance_amount >= 0),
  add column if not exists objection text,
  add column if not exists decision_deadline date,
  add column if not exists expected_collection_date date;

alter table public.b2g_projects
  add column if not exists work_completed text,
  add column if not exists work_completed_at date;

alter table public.b2g_payment_milestones
  add column if not exists responsible_user_id uuid references auth.users(id) on delete set null,
  add column if not exists responsible_person text,
  add column if not exists last_commitment text,
  add column if not exists next_escalation_date date;

create table if not exists public.b2g_client_meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  project_id uuid references public.b2g_projects(id) on delete set null,
  meeting_at timestamptz not null default now(),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  language text not null default 'en-IN',
  transcript text not null check (length(btrim(transcript)) > 0),
  discussion_summary text,
  key_requirements text,
  client_commitments text,
  our_commitments text,
  outcome text,
  next_action text,
  decision_deadline date,
  expected_collection_date date,
  recorded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.b2g_client_meetings
  add column if not exists project_id uuid references public.b2g_projects(id) on delete set null;

create index if not exists b2g_client_meetings_day_idx on public.b2g_client_meetings(meeting_at desc);
create index if not exists b2g_client_meetings_lead_idx on public.b2g_client_meetings(lead_id,meeting_at desc);
drop trigger if exists b2g_client_meetings_updated_at on public.b2g_client_meetings;
create trigger b2g_client_meetings_updated_at before update on public.b2g_client_meetings
  for each row execute function public.set_updated_at();

alter table public.b2g_client_meetings enable row level security;
drop policy if exists "authenticated_select_b2g_client_meetings" on public.b2g_client_meetings;
create policy "authenticated_select_b2g_client_meetings" on public.b2g_client_meetings for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists "authenticated_insert_b2g_client_meetings" on public.b2g_client_meetings;
create policy "authenticated_insert_b2g_client_meetings" on public.b2g_client_meetings for insert to authenticated with check ((select auth.uid()) is not null);
drop policy if exists "authenticated_update_b2g_client_meetings" on public.b2g_client_meetings;
create policy "authenticated_update_b2g_client_meetings" on public.b2g_client_meetings for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
drop policy if exists "authenticated_delete_b2g_client_meetings" on public.b2g_client_meetings;
create policy "authenticated_delete_b2g_client_meetings" on public.b2g_client_meetings for delete to authenticated using ((select auth.uid()) is not null);
grant select,insert,update,delete on public.b2g_client_meetings to authenticated;

drop view if exists public.b2g_collection_dashboard;
create view public.b2g_collection_dashboard
with (security_invoker = true)
as
select
  m.id as milestone_id,
  p.id as project_id,
  p.project_name,
  l.id as lead_id,
  l.organization_name as client,
  p.work_completed,
  m.invoice_number,
  m.invoice_date,
  (m.amount + m.gst_amount) as invoice_amount,
  m.amount_received,
  greatest((m.amount + m.gst_amount - m.amount_received), 0) as balance_outstanding,
  m.responsible_user_id,
  m.responsible_person as person_responsible,
  m.last_commitment,
  m.next_escalation_date,
  m.due_date,
  m.status
from public.b2g_payment_milestones as m
inner join public.b2g_projects as p
  on p.id = m.project_id
inner join public.b2g_leads as l
  on l.id = p.lead_id;
grant select on public.b2g_collection_dashboard to authenticated;
