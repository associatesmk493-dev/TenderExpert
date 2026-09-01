-- Lead-centric multiple-order workspace.

alter table public.b2g_projects
  add column if not exists order_number text,
  add column if not exists expected_close_date date,
  add column if not exists delay_reason text,
  add column if not exists closure_reason text;

create unique index if not exists b2g_projects_lead_order_number_key
  on public.b2g_projects(lead_id,order_number)
  where order_number is not null;

create index if not exists b2g_projects_lead_created_idx
  on public.b2g_projects(lead_id,created_at desc);

grant select,insert,update,delete on public.b2g_projects to authenticated;

