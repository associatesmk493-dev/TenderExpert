-- Tender opportunities now carry the full opportunity sheet (site, contact, technical details, BOQ).
alter table public.tender_opportunities
  add column if not exists site_name text,
  add column if not exists contact_no text,
  add column if not exists plant_capacity text,
  add column if not exists sanctioned_budget numeric(16,2) not null default 0,
  add column if not exists existing_problem text,
  add column if not exists proposed_technology text,
  add column if not exists boq_status text not null default 'not_started',
  add column if not exists decision_maker_name text,
  add column if not exists tender_timeline date,
  add column if not exists next_action text,
  add column if not exists boq_items jsonb not null default '[]'::jsonb;
