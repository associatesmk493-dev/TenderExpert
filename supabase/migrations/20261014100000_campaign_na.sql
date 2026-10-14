-- Campaign leads can be marked NA (not applicable) besides Interested.
alter table public.b2g_leads
  add column if not exists campaign_na boolean not null default false;
