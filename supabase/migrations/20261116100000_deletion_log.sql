-- Simple record of WHY something was deleted (leads, tasks, follow-ups, tenders, campaigns...).
-- No foreign keys: the row must survive the deletion it describes.
create table if not exists public.deletion_log (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_name text,
  reason text not null,
  lead_id uuid,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists deletion_log_created_idx on public.deletion_log(created_at desc);

alter table public.deletion_log enable row level security;
drop policy if exists "team_select_deletion_log" on public.deletion_log;
create policy "team_select_deletion_log" on public.deletion_log for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists "team_insert_deletion_log" on public.deletion_log;
create policy "team_insert_deletion_log" on public.deletion_log for insert to authenticated with check ((select auth.uid()) is not null);
grant select, insert on public.deletion_log to authenticated;
