-- Fix for: Could not find the table public.leads in the schema cache.
-- Run this small patch in Supabase Dashboard > SQL Editor.

alter table public.b2g_leads
  add column if not exists campaign_name text;

create index if not exists b2g_leads_campaign_idx
  on public.b2g_leads(campaign_name)
  where campaign_name is not null;

grant select, insert, update, delete on public.b2g_leads to authenticated;

-- Ask PostgREST to immediately refresh its schema cache.
notify pgrst, 'reload schema';

-- Verification: should return campaign_name as one row.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'b2g_leads'
  and column_name = 'campaign_name';
