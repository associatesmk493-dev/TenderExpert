alter table public.b2g_tasks add column if not exists responsible_person text;
create index if not exists b2g_tasks_lead_followup_idx on public.b2g_tasks (lead_id, due_at desc) where task_type = 'follow_up';
grant select, insert, update, delete on public.b2g_tasks to authenticated;
