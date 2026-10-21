-- Tender opportunities: company link, project stage, BOQ / MOU links and the success-fee milestones.
alter table public.tender_opportunities
  add column if not exists company_name text,
  add column if not exists project_stage text,
  add column if not exists boq_link text,
  add column if not exists mou_link text,
  add column if not exists success_fees jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
