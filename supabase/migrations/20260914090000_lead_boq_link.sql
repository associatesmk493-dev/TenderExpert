-- Adds a dedicated BOQ (Bill of Quantities) drive link field on leads,
-- separate from the general documentation links list.

alter table public.b2g_leads
  add column if not exists boq_link text;
