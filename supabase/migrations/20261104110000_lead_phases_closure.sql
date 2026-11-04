-- Closed leads: how they ended, and a chain of phases (a later phase points to the lead it continued from).
alter table public.b2g_leads
  add column if not exists closure_outcome text,
  add column if not exists parent_lead_id uuid references public.b2g_leads(id) on delete set null,
  add column if not exists phase_no integer not null default 1;

create index if not exists b2g_leads_parent_idx on public.b2g_leads (parent_lead_id);

notify pgrst, 'reload schema';
