-- Opportunity sheet: site / work / contact fields and an item-wise BOQ table.
-- Commercial model and expected profit now live per BOQ row (jsonb array).
alter table public.b2g_leads
  add column if not exists site_name text,
  add column if not exists work_name text,
  add column if not exists contact_no text,
  add column if not exists boq_items jsonb not null default '[]'::jsonb;

-- Keep any commercial model / profit already typed in as the first BOQ row.
update public.b2g_leads
set boq_items = jsonb_build_array(jsonb_build_object(
  'item', '', 'make', '', 'qty', 0, 'rate', 0,
  'commercial_model', coalesce(commercial_model, ''),
  'expected_profit', expected_profit))
where boq_items = '[]'::jsonb
  and (coalesce(commercial_model, '') <> '' or expected_profit <> 0);
