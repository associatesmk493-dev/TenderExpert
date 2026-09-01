-- TenderExpert / MK & Associates CRM growth engine (Phases 1-4)
-- Additive and idempotent. Existing CRM data is preserved.

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- Phase 1: account intelligence and opportunity discipline
-- --------------------------------------------------------------------------
alter table public.companies
  add column if not exists account_tier text not null default 'B'
    check (account_tier in ('A','B','C')),
  add column if not exists annual_potential_value numeric(14,2) not null default 0
    check (annual_potential_value >= 0),
  add column if not exists payment_reliability_score smallint
    check (payment_reliability_score between 0 and 100),
  add column if not exists relationship_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists birthday date,
  add column if not exists anniversary date;

alter table public.b2g_leads
  add column if not exists decision_maker_name text,
  add column if not exists decision_maker_designation text,
  add column if not exists qualification jsonb not null default
    '{"budget_confirmed":false,"authority_identified":false,"need_documented":false,"timeline_known":false}'::jsonb,
  add column if not exists competitor text,
  add column if not exists relationship_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists last_activity_at timestamptz,
  add column if not exists reengagement_due_at timestamptz,
  add column if not exists on_hold boolean not null default false,
  add column if not exists on_hold_reason text,
  add column if not exists lost_reason_code text
    check (lost_reason_code is null or lost_reason_code in
      ('price','competitor','budget_freeze','no_response','timeline','scope_mismatch','project_cancelled','lost_to_incumbent','other')),
  add column if not exists delay_reason text,
  add column if not exists stalled_since timestamptz;

create index if not exists b2g_leads_stale_open_idx
  on public.b2g_leads(last_activity_at, proposal_value desc)
  where closed_at is null and on_hold = false;
create index if not exists companies_tier_owner_idx
  on public.companies(account_tier, relationship_owner_id);

create or replace function public.sync_b2g_last_activity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.b2g_leads
     set last_activity_at = greatest(coalesce(last_activity_at, '-infinity'::timestamptz), new.created_at)
   where id = new.lead_id;
  return new;
end $$;
drop trigger if exists b2g_activity_sync_last_activity on public.b2g_activities;
create trigger b2g_activity_sync_last_activity
  after insert on public.b2g_activities for each row execute function public.sync_b2g_last_activity();

-- --------------------------------------------------------------------------
-- Phase 2: receipts, expenses, profitability, proposal revisions
-- --------------------------------------------------------------------------
alter table public.b2g_projects
  add column if not exists estimated_cost numeric(14,2) not null default 0 check (estimated_cost >= 0),
  add column if not exists delivery_risk text not null default 'low'
    check (delivery_risk in ('low','medium','high'));

alter table public.b2g_payment_milestones
  add column if not exists invoice_date date,
  add column if not exists invoice_url text,
  add column if not exists reminder_sent_at timestamptz;

alter table public.b2g_proposals
  add column if not exists project_id uuid references public.b2g_projects(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists supersedes_id uuid references public.b2g_proposals(id) on delete set null,
  add column if not exists discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  add column if not exists revision_reason text;

create table if not exists public.b2g_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.b2g_payment_milestones(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  received_on date not null default current_date,
  mode text not null default 'bank_transfer'
    check (mode in ('cash','cheque','bank_transfer','upi','card','other')),
  utr_ref text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_direct boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.expense_categories(name,is_direct) values
  ('Government fee',true),('EMD',true),('Travel',true),('Documentation',true),
  ('Consultant payout',true),('Office overhead',false)
on conflict (name) do nothing;

create table if not exists public.b2g_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.b2g_projects(id) on delete set null,
  category_id uuid references public.expense_categories(id) on delete set null,
  vendor text not null,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  gst numeric(14,2) not null default 0 check (gst >= 0),
  paid_on date not null default current_date,
  mode text not null default 'bank_transfer'
    check (mode in ('cash','cheque','bank_transfer','upi','card','other')),
  bill_url text,
  is_billable boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists b2g_receipts_milestone_date_idx
  on public.b2g_payment_receipts(milestone_id, received_on desc);
create index if not exists b2g_expenses_project_date_idx
  on public.b2g_expenses(project_id, paid_on desc);
create index if not exists b2g_proposals_revision_idx
  on public.b2g_proposals(lead_id, proposal_number, version desc);

drop trigger if exists b2g_expenses_updated_at on public.b2g_expenses;
create trigger b2g_expenses_updated_at before update on public.b2g_expenses
  for each row execute function public.set_updated_at();

create or replace function public.sync_milestone_receipts()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_id uuid;
begin
  target_id := coalesce(new.milestone_id, old.milestone_id);
  update public.b2g_payment_milestones m
     set amount_received = coalesce((select sum(r.amount) from public.b2g_payment_receipts r where r.milestone_id = target_id),0),
         received_at = (select max(r.received_on)::timestamptz from public.b2g_payment_receipts r where r.milestone_id = target_id),
         status = case
           when coalesce((select sum(r.amount) from public.b2g_payment_receipts r where r.milestone_id = target_id),0) >= m.amount + m.gst_amount then 'paid'::public.collection_status
           when coalesce((select sum(r.amount) from public.b2g_payment_receipts r where r.milestone_id = target_id),0) > 0 then 'partially_paid'::public.collection_status
           when m.due_date < current_date then 'overdue'::public.collection_status
           else 'not_due'::public.collection_status end
   where m.id = target_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists b2g_receipt_rollup on public.b2g_payment_receipts;
create trigger b2g_receipt_rollup after insert or update or delete on public.b2g_payment_receipts
  for each row execute function public.sync_milestone_receipts();

create or replace function public.generate_payment_milestones(target_project uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare p public.b2g_projects%rowtype; created_count integer := 0;
begin
  select * into p from public.b2g_projects where id = target_project;
  if not found then raise exception 'Project not found'; end if;
  if exists(select 1 from public.b2g_payment_milestones where project_id = target_project) then
    return 0;
  end if;
  if p.payment_model = '80_20' then
    insert into public.b2g_payment_milestones(project_id,milestone_name,sequence_no,percentage,amount,due_date)
      values (p.id,'Advance',1,80,round(p.contract_value*.8,2),p.start_date),
             (p.id,'Final balance',2,20,round(p.contract_value*.2,2),p.target_completion_date);
    created_count := 2;
  elsif p.payment_model = '70_30' then
    insert into public.b2g_payment_milestones(project_id,milestone_name,sequence_no,percentage,amount,due_date)
      values (p.id,'Advance',1,70,round(p.contract_value*.7,2),p.start_date),
             (p.id,'Final balance',2,30,round(p.contract_value*.3,2),p.target_completion_date);
    created_count := 2;
  elsif p.payment_model = '50_50' then
    insert into public.b2g_payment_milestones(project_id,milestone_name,sequence_no,percentage,amount,due_date)
      values (p.id,'Advance',1,50,round(p.contract_value*.5,2),p.start_date),
             (p.id,'Final balance',2,50,round(p.contract_value*.5,2),p.target_completion_date);
    created_count := 2;
  else
    insert into public.b2g_payment_milestones(project_id,milestone_name,sequence_no,percentage,amount,due_date)
      values (p.id,'Project payment',1,100,p.contract_value,p.target_completion_date);
    created_count := 1;
  end if;
  return created_count;
end $$;

drop view if exists public.b2g_project_pnl;
create view public.b2g_project_pnl with (security_invoker = true) as
select p.id as project_id, p.project_name, p.lead_id, p.contract_value, p.gst_amount,
       p.estimated_cost,
       coalesce((select sum(r.amount) from public.b2g_payment_receipts r
         join public.b2g_payment_milestones m on m.id=r.milestone_id where m.project_id=p.id),0) as receipts,
       coalesce((select sum(e.amount+e.gst) from public.b2g_expenses e where e.project_id=p.id),0) as actual_cost,
       p.contract_value - coalesce((select sum(e.amount+e.gst) from public.b2g_expenses e where e.project_id=p.id),0) as margin_amount,
       case when p.contract_value=0 then 0 else round((p.contract_value-coalesce((select sum(e.amount+e.gst) from public.b2g_expenses e where e.project_id=p.id),0))*100/p.contract_value,2) end as margin_pct
from public.b2g_projects p;

create or replace view public.b2g_ageing_receivables with (security_invoker = true) as
select m.id as milestone_id,p.id as project_id,p.project_name,l.organization_name,m.due_date,
  greatest(m.amount+m.gst_amount-m.amount_received,0) as outstanding,
  case when m.due_date is null or m.due_date>=current_date then 'not_due'
       when current_date-m.due_date<=30 then '0_30'
       when current_date-m.due_date<=60 then '31_60'
       when current_date-m.due_date<=90 then '61_90' else '90_plus' end as ageing_bucket
from public.b2g_payment_milestones m
join public.b2g_projects p on p.id=m.project_id join public.b2g_leads l on l.id=p.lead_id
where m.amount_received < m.amount+m.gst_amount;

create or replace view public.b2g_cashflow_forecast with (security_invoker = true) as
select date_trunc('month',forecast_date)::date as forecast_month,
       sum(expected_inflow) as expected_inflow,
       sum(expected_outflow) as expected_outflow,
       sum(expected_inflow)-sum(expected_outflow) as net_cashflow
from (
  select coalesce(m.due_date,current_date)::date as forecast_date,
         greatest(m.amount+m.gst_amount-m.amount_received,0) as expected_inflow,
         0::numeric as expected_outflow
  from public.b2g_payment_milestones m where m.amount_received<m.amount+m.gst_amount
  union all
  select e.paid_on as forecast_date,0::numeric as expected_inflow,e.amount+e.gst as expected_outflow from public.b2g_expenses e
) x group by 1;

-- --------------------------------------------------------------------------
-- Phase 3: stage history, gates and database automations
-- --------------------------------------------------------------------------
create table if not exists public.b2g_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users(id) on delete set null default auth.uid(),
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  reason text
);
create index if not exists b2g_stage_history_lead_entered_idx
  on public.b2g_stage_history(lead_id,entered_at desc);

create or replace function public.track_b2g_stage_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.stage is distinct from new.stage then
    update public.b2g_stage_history set exited_at=now()
      where id=(select id from public.b2g_stage_history where lead_id=new.id and exited_at is null order by entered_at desc limit 1);
    insert into public.b2g_stage_history(lead_id,from_stage,to_stage,changed_by,reason)
      values(new.id,old.stage,new.stage,auth.uid(),coalesce(new.delay_reason,new.lost_reason));
    insert into public.b2g_activities(lead_id,activity_type,subject,description,created_by)
      values(new.id,'stage_change','Stage changed to '||replace(new.stage,'_',' '),old.stage||' → '||new.stage,auth.uid());
    if not exists(select 1 from public.b2g_tasks where lead_id=new.id and completed_at is null) then
      insert into public.b2g_tasks(lead_id,title,task_type,priority,due_at,assigned_to,created_by)
        values(new.id,'Follow up after stage change','follow_up','medium',now()+interval '1 day',new.assigned_to,auth.uid());
    end if;
  end if;
  return new;
end $$;
drop trigger if exists b2g_stage_change_tracking on public.b2g_leads;
create trigger b2g_stage_change_tracking after update of stage on public.b2g_leads
  for each row execute function public.track_b2g_stage_change();

create or replace function public.enforce_b2g_qualification_gate()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.stage in ('proposal_submitted','negotiation','agreement_signed','work_order_received','advance_received') then
    if new.expected_close_date is null or
       not coalesce((new.qualification->>'budget_confirmed')::boolean,false) or
       not coalesce((new.qualification->>'authority_identified')::boolean,false) or
       not coalesce((new.qualification->>'need_documented')::boolean,false) or
       not coalesce((new.qualification->>'timeline_known')::boolean,false) then
      raise exception 'Expected close date and all qualification checks are required before proposal/negotiation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists b2g_qualification_gate on public.b2g_leads;
create trigger b2g_qualification_gate before insert or update of stage,qualification,expected_close_date on public.b2g_leads
  for each row execute function public.enforce_b2g_qualification_gate();

create or replace function public.run_b2g_automations()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare created_notifications integer := 0; created_drafts integer := 0; expired_proposals integer := 0;
begin
  perform public.refresh_b2g_escalations();
  update public.b2g_payment_milestones set status='overdue'
    where due_date<current_date and amount_received<amount+gst_amount and status<>'overdue';
  update public.b2g_proposals set status='expired'
    where valid_until<current_date and status in ('sent','viewed');
  get diagnostics expired_proposals = row_count;
  insert into public.b2g_notifications(user_id,lead_id,notification_type,title,message,severity)
  select coalesce(p.created_by,l.assigned_to),l.id,'payment_due','Payment follow-up: '||l.organization_name,
    m.milestone_name||' — '||greatest(m.amount+m.gst_amount-m.amount_received,0)::text||' outstanding',
    case when m.due_date<current_date then 'urgent' else 'warning' end
  from public.b2g_payment_milestones m join public.b2g_projects p on p.id=m.project_id join public.b2g_leads l on l.id=p.lead_id
  where m.amount_received<m.amount+m.gst_amount and m.due_date between current_date-interval '90 days' and current_date+interval '3 days'
    and not exists(select 1 from public.b2g_notifications n where n.notification_type='payment_due' and n.lead_id=l.id and n.created_at::date=current_date);
  get diagnostics created_notifications = row_count;
  insert into public.communication_drafts(lead_id,channel,purpose,body,generated_by)
  select l.id,'whatsapp','payment_reminder','Namaste '||l.contact_name||', this is a reminder regarding the pending payment for '||p.project_name||'. Please share an update at your convenience.','automation'
  from public.b2g_payment_milestones m join public.b2g_projects p on p.id=m.project_id join public.b2g_leads l on l.id=p.lead_id
  where m.amount_received<m.amount+m.gst_amount and m.due_date<=current_date+interval '3 days'
    and not exists(select 1 from public.communication_drafts d where d.lead_id=l.id and d.purpose='payment_reminder' and d.created_at::date=current_date);
  get diagnostics created_drafts = row_count;
  update public.b2g_leads set stalled_since=coalesce(stalled_since,now())
    where closed_at is null and on_hold=false and coalesce(last_activity_at,updated_at)<now()-interval '21 days';
  return jsonb_build_object('notifications',created_notifications,'drafts',created_drafts,'expired_proposals',expired_proposals);
end $$;

create or replace view public.b2g_funnel_velocity with (security_invoker = true) as
select l.pipeline,h.to_stage as stage,count(*) as entries,
  round(avg(extract(epoch from (coalesce(h.exited_at,now())-h.entered_at))/86400)::numeric,1) as avg_days_in_stage
from public.b2g_stage_history h join public.b2g_leads l on l.id=h.lead_id group by l.pipeline,h.to_stage;

-- --------------------------------------------------------------------------
-- Phase 4: human-approved AI suggestions and insight persistence
-- --------------------------------------------------------------------------
create table if not exists public.b2g_ai_insights (
  id uuid primary key default gen_random_uuid(),
  insight_type text not null check (insight_type in ('daily_priority','weekly_performance','forecast','cross_sell','rescue')),
  lead_id uuid references public.b2g_leads(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  narrative text not null,
  evidence jsonb not null default '{}',
  status text not null default 'suggested' check (status in ('suggested','approved','dismissed','acted')),
  generated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);
create index if not exists b2g_ai_insights_open_idx
  on public.b2g_ai_insights(status,generated_at desc) where status='suggested';

create or replace function public.refresh_b2g_rule_based_insights()
returns integer language plpgsql security invoker set search_path = '' as $$
declare inserted_count integer;
begin
  insert into public.b2g_ai_insights(insight_type,lead_id,company_id,title,narrative,evidence)
  select 'rescue',l.id,l.company_id,'Rescue '||l.organization_name,
    'High-potential opportunity has been quiet for more than 21 days. Review the last conversation and approve a re-engagement task.',
    jsonb_build_object('proposal_value',l.proposal_value,'probability',l.probability,'last_activity_at',l.last_activity_at,'ai_score',l.ai_score)
  from public.b2g_leads l
  where l.closed_at is null and l.proposal_value>0 and coalesce(l.last_activity_at,l.updated_at)<now()-interval '21 days'
    and not exists(select 1 from public.b2g_ai_insights i where i.lead_id=l.id and i.insight_type='rescue' and i.generated_at>now()-interval '7 days');
  get diagnostics inserted_count = row_count;
  insert into public.b2g_ai_insights(insight_type,lead_id,company_id,title,narrative,evidence)
  select 'daily_priority',l.id,l.company_id,'Priority action: '||l.organization_name,
    coalesce(l.next_best_action,'Confirm the decision maker, next milestone and expected close date.'),
    jsonb_build_object('weighted_value',l.expected_revenue,'score',l.ai_score,'stage',l.stage,'follow_up',l.next_follow_up_at)
  from public.b2g_leads l where l.closed_at is null
    and (l.heat='hot' or l.ai_score>=70 or l.next_follow_up_at<=now()+interval '1 day')
    and not exists(select 1 from public.b2g_ai_insights i where i.lead_id=l.id and i.insight_type='daily_priority' and i.generated_at::date=current_date)
  order by (l.expected_revenue*(1+l.ai_score/100.0)) desc limit 5;

  insert into public.b2g_ai_insights(insight_type,company_id,title,narrative,evidence)
  select 'cross_sell',c.id,'Cross-sell review: '||c.name,
    'This account has used '||count(distinct l.pipeline)::text||' of 3 service pipelines. Review the missing service line before the next account meeting.',
    jsonb_build_object('used_pipelines',jsonb_agg(distinct l.pipeline),'annual_potential',c.annual_potential_value)
  from public.companies c join public.b2g_leads l on l.company_id=c.id
  group by c.id,c.name,c.annual_potential_value having count(distinct l.pipeline)<3
    and not exists(select 1 from public.b2g_ai_insights i where i.company_id=c.id and i.insight_type='cross_sell' and i.generated_at>now()-interval '30 days');

  if extract(isodow from now())=1 and not exists(select 1 from public.b2g_ai_insights where insight_type='weekly_performance' and generated_at>date_trunc('week',now())) then
    insert into public.b2g_ai_insights(insight_type,title,narrative,evidence)
    select 'weekly_performance','Weekly pipeline digest',
      count(*)::text||' open opportunities, '||count(*) filter(where stalled_since is not null)::text||' stalled, with '||coalesce(sum(expected_revenue),0)::text||' weighted revenue in play.',
      jsonb_build_object('open_opportunities',count(*),'stalled',count(*) filter(where stalled_since is not null),'weighted_pipeline',coalesce(sum(expected_revenue),0))
    from public.b2g_leads where closed_at is null;
  end if;
  return inserted_count;
end $$;

create or replace function public.refresh_b2g_lead_scores()
returns integer language plpgsql security invoker set search_path = '' as $$
declare updated_count integer;
begin
  update public.b2g_leads l set
    ai_score=least(100,greatest(0,
      15 + round(l.probability*.35)::integer
      + case l.heat when 'hot' then 20 when 'warm' then 10 else 0 end
      + least(20,round(ln(1+greatest(l.proposal_value,0))/ln(10))::integer*3)
      + case when coalesce(l.last_activity_at,l.updated_at)>now()-interval '7 days' then 15 when coalesce(l.last_activity_at,l.updated_at)>now()-interval '21 days' then 5 else -10 end
      + case when l.qualification @> '{"budget_confirmed":true,"authority_identified":true,"need_documented":true,"timeline_known":true}'::jsonb then 15 else 0 end)),
    next_best_action=case
      when coalesce(l.last_activity_at,l.updated_at)<now()-interval '21 days' then 'Re-engage this high-potential opportunity and confirm whether timing has changed.'
      when l.expected_close_date is null then 'Confirm and record the expected closing date.'
      when not coalesce((l.qualification->>'authority_identified')::boolean,false) then 'Identify and schedule a conversation with the economic decision maker.'
      when l.next_follow_up_at is null then 'Create the next follow-up task with an owner and due date.'
      else 'Complete the next scheduled follow-up and record its outcome.' end
  where l.closed_at is null;
  get diagnostics updated_count=row_count;
  return updated_count;
end $$;

-- RLS and Data API privileges for all new tables.
do $$ declare t text; begin
  foreach t in array array['b2g_payment_receipts','expense_categories','b2g_expenses','b2g_stage_history','b2g_ai_insights'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "authenticated_select_%1$s" on public.%1$I',t);
    execute format('create policy "authenticated_select_%1$s" on public.%1$I for select to authenticated using ((select auth.uid()) is not null)',t);
    execute format('drop policy if exists "authenticated_insert_%1$s" on public.%1$I',t);
    execute format('create policy "authenticated_insert_%1$s" on public.%1$I for insert to authenticated with check ((select auth.uid()) is not null)',t);
    execute format('drop policy if exists "authenticated_update_%1$s" on public.%1$I',t);
    execute format('create policy "authenticated_update_%1$s" on public.%1$I for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',t);
    execute format('drop policy if exists "authenticated_delete_%1$s" on public.%1$I',t);
    execute format('create policy "authenticated_delete_%1$s" on public.%1$I for delete to authenticated using ((select auth.uid()) is not null)',t);
  end loop;
end $$;

grant select,insert,update,delete on public.b2g_payment_receipts,public.expense_categories,public.b2g_expenses,public.b2g_stage_history,public.b2g_ai_insights to authenticated;
grant select on public.b2g_project_pnl,public.b2g_ageing_receivables,public.b2g_cashflow_forecast,public.b2g_funnel_velocity to authenticated;
grant execute on function public.generate_payment_milestones(uuid),public.run_b2g_automations(),public.refresh_b2g_rule_based_insights(),public.refresh_b2g_lead_scores() to authenticated;

-- Enable Supabase Cron and schedule safe in-database jobs. Job names are idempotent.
create extension if not exists pg_cron with schema extensions;
select cron.schedule('tenderexpert-growth-automation','*/15 * * * *','select public.run_b2g_automations();');
select cron.schedule('tenderexpert-insights-daily','30 2 * * *','select public.refresh_b2g_rule_based_insights();');
select cron.schedule('tenderexpert-lead-scoring-nightly','0 2 * * *','select public.refresh_b2g_lead_scores();');
