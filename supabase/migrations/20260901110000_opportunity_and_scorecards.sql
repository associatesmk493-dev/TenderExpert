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
