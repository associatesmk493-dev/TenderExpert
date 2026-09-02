-- Final lead-centric multiple-order upgrade. Safe to rerun after base B2G CRM setup.

alter table public.b2g_leads
  add column if not exists decision_maker_name text,
  add column if not exists advance_amount numeric(14,2) not null default 0 check (advance_amount>=0),
  add column if not exists objection text,
  add column if not exists decision_deadline date,
  add column if not exists expected_collection_date date,
  add column if not exists lost_reason_code text,
  add column if not exists delay_reason text,
  add column if not exists stalled_since timestamptz,
  add column if not exists on_hold boolean not null default false,
  add column if not exists on_hold_reason text;

alter table public.b2g_leads
  add column if not exists department_client text,
  add column if not exists plant_capacity text,
  add column if not exists existing_problem text,
  add column if not exists sanctioned_budget numeric(14,2) not null default 0,
  add column if not exists proposed_technology text,
  add column if not exists boq_status text not null default 'not_started',
  add column if not exists tender_timeline date,
  add column if not exists commercial_model text,
  add column if not exists expected_profit numeric(14,2) not null default 0;

alter table public.b2g_projects
  add column if not exists order_number text,
  add column if not exists estimated_cost numeric(14,2) not null default 0 check (estimated_cost>=0),
  add column if not exists expected_close_date date,
  add column if not exists delay_reason text,
  add column if not exists closure_reason text,
  add column if not exists work_completed text,
  add column if not exists work_completed_at date;

create unique index if not exists b2g_projects_lead_order_number_key
  on public.b2g_projects(lead_id,order_number) where order_number is not null;

alter table public.b2g_payment_milestones
  add column if not exists invoice_date date,
  add column if not exists invoice_url text,
  add column if not exists responsible_person text,
  add column if not exists last_commitment text,
  add column if not exists next_escalation_date date;

alter table public.b2g_proposals
  add column if not exists project_id uuid references public.b2g_projects(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists version integer not null default 1 check(version>0),
  add column if not exists supersedes_id uuid references public.b2g_proposals(id) on delete set null,
  add column if not exists revision_reason text;

alter table public.b2g_tasks
  add column if not exists responsible_person text;

create index if not exists b2g_tasks_lead_followup_idx
  on public.b2g_tasks(lead_id,due_at desc) where task_type='follow_up';

create table if not exists public.b2g_payment_receipts(
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.b2g_payment_milestones(id) on delete cascade,
  amount numeric(14,2) not null check(amount>0),
  received_on date not null default current_date,
  mode text not null default 'bank_transfer',
  utr_ref text,notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.b2g_personal_scorecards(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  scorecard_date date not null default current_date,
  cash_collected numeric(14,2) not null default 0,
  advances_expected numeric(14,2) not null default 0,
  strongest_followups text,
  meetings_completed integer not null default 0,
  proposals_submitted integer not null default 0,
  deals_awaiting_decision integer not null default 0,
  outstanding_payments numeric(14,2) not null default 0,
  tomorrow_top_actions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,scorecard_date)
);
alter table public.b2g_personal_scorecards enable row level security;
drop policy if exists "users_manage_own_scorecards" on public.b2g_personal_scorecards;
create policy "users_manage_own_scorecards" on public.b2g_personal_scorecards for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.b2g_personal_scorecards to authenticated;

create table if not exists public.b2g_weekly_conversion_scorecards(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week_start date not null, week_end date not null,
  qualified_leads integer not null default 0, quotations integer not null default 0,
  quotation_value numeric(14,2) not null default 0, decision_dates integer not null default 0,
  advances integer not null default 0, cash_collected numeric(14,2) not null default 0,
  meetings integer not null default 0, deals_lost integer not null default 0,
  lost_reasons jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,week_start)
);
alter table public.b2g_weekly_conversion_scorecards enable row level security;
drop policy if exists "users_manage_own_weekly_scorecards" on public.b2g_weekly_conversion_scorecards;
create policy "users_manage_own_weekly_scorecards" on public.b2g_weekly_conversion_scorecards for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.b2g_weekly_conversion_scorecards to authenticated;

create table if not exists public.b2g_expenses(
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.b2g_projects(id) on delete set null,
  vendor text not null,description text,
  amount numeric(14,2) not null check(amount>0),
  gst numeric(14,2) not null default 0 check(gst>=0),
  paid_on date not null default current_date,
  mode text not null default 'bank_transfer',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table if not exists public.b2g_client_meetings(
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  meeting_at timestamptz not null default now(),
  language text not null default 'en-IN',
  transcript text not null,
  discussion_summary text,
  recorded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.b2g_client_meetings
  add column if not exists project_id uuid references public.b2g_projects(id) on delete set null;

do $$ declare t text; begin
  foreach t in array array['b2g_payment_receipts','b2g_expenses'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "team_full_%1$s" on public.%1$I',t);
    execute format('create policy "team_full_%1$s" on public.%1$I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

drop view if exists public.b2g_project_pnl;
create view public.b2g_project_pnl with(security_invoker=true) as
select p.id as project_id,p.lead_id,p.project_name,p.order_number,p.contract_value,p.estimated_cost,
  coalesce((select sum(r.amount) from public.b2g_payment_receipts r join public.b2g_payment_milestones m on m.id=r.milestone_id where m.project_id=p.id),0) as receipts,
  coalesce((select sum(e.amount+e.gst) from public.b2g_expenses e where e.project_id=p.id),0) as actual_cost,
  p.contract_value-coalesce((select sum(e.amount+e.gst) from public.b2g_expenses e where e.project_id=p.id),0) as margin_amount,
  case when p.contract_value=0 then 0 else round((p.contract_value-coalesce((select sum(e.amount+e.gst) from public.b2g_expenses e where e.project_id=p.id),0))*100/p.contract_value,2) end as margin_pct
from public.b2g_projects p;
grant select on public.b2g_project_pnl to authenticated;

drop view if exists public.b2g_collection_dashboard;
create view public.b2g_collection_dashboard with(security_invoker=true) as
select m.id as milestone_id,p.id as project_id,p.project_name,p.order_number,l.id as lead_id,l.organization_name as client,
  p.work_completed,m.invoice_number,m.invoice_date,m.amount+m.gst_amount as invoice_amount,m.amount_received,
  greatest(m.amount+m.gst_amount-m.amount_received,0) as balance_outstanding,
  m.responsible_person as person_responsible,m.last_commitment,m.next_escalation_date,m.due_date,m.status
from public.b2g_payment_milestones m
inner join public.b2g_projects p on p.id=m.project_id
inner join public.b2g_leads l on l.id=p.lead_id;
grant select on public.b2g_collection_dashboard to authenticated;

-- New leads automatically receive a next-day dashboard follow-up.
create or replace function public.schedule_new_b2g_lead_followup()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare followup_at timestamptz;
begin
  followup_at := coalesce(new.next_follow_up_at,((date_trunc('day',new.created_at at time zone 'Asia/Kolkata')+interval '1 day 10 hours') at time zone 'Asia/Kolkata'));
  if new.next_follow_up_at is null then
    update public.b2g_leads set next_follow_up_at=followup_at where id=new.id;
  end if;
  insert into public.b2g_tasks(lead_id,title,description,task_type,priority,due_at,assigned_to,created_by)
  values(new.id,'First follow-up: '||new.organization_name,'Review the new lead, contact the client and record the outcome.','follow_up',case when new.heat='hot' then 'high' else 'medium' end,followup_at,new.assigned_to,coalesce(new.created_by,(select auth.uid())));
  return new;
end $$;
drop trigger if exists b2g_new_lead_next_day_followup on public.b2g_leads;
create trigger b2g_new_lead_next_day_followup after insert on public.b2g_leads for each row execute function public.schedule_new_b2g_lead_followup();
