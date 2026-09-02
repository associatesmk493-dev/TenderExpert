create table if not exists public.b2g_weekly_conversion_scorecards(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week_start date not null,
  week_end date not null,
  qualified_leads integer not null default 0,
  quotations integer not null default 0,
  quotation_value numeric(14,2) not null default 0,
  decision_dates integer not null default 0,
  advances integer not null default 0,
  cash_collected numeric(14,2) not null default 0,
  meetings integer not null default 0,
  deals_lost integer not null default 0,
  lost_reasons jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,week_start)
);
alter table public.b2g_weekly_conversion_scorecards enable row level security;
drop policy if exists "users_manage_own_weekly_scorecards" on public.b2g_weekly_conversion_scorecards;
create policy "users_manage_own_weekly_scorecards" on public.b2g_weekly_conversion_scorecards for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.b2g_weekly_conversion_scorecards to authenticated;
