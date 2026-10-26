-- Several contacts per company, department follow-up notes on tenders,
-- and no stage-sequencing gate (documents often arrive later). Go-ahead replaces the probability default.
alter table public.b2g_leads
  add column if not exists contacts jsonb not null default '[]'::jsonb;

alter table public.tender_opportunities
  add column if not exists dept_notes jsonb not null default '[]'::jsonb;

-- Stages can now be changed freely: remove the "close date + qualification checks" rule.
drop trigger if exists b2g_qualification_gate on public.b2g_leads;

-- New leads start with no go-ahead (0) instead of 20 %.
alter table public.b2g_leads alter column probability set default 0;

notify pgrst, 'reload schema';
