-- Tender opportunities follow the client's "Current Sites" sheet:
-- month, division, offices, status log, parties, documents, conversation and project calculations.
alter table public.tender_opportunities
  add column if not exists month text,
  add column if not exists division text,
  add column if not exists approved_fund text,
  add column if not exists conversation text,
  add column if not exists offices jsonb not null default '[]'::jsonb,
  add column if not exists status_log jsonb not null default '[]'::jsonb,
  add column if not exists parties jsonb not null default '[]'::jsonb,
  add column if not exists documents jsonb not null default '[]'::jsonb,
  add column if not exists calculations jsonb not null default '[]'::jsonb;
