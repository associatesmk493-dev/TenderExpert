-- Several departments / states running in parallel under ONE lead (e.g. CPWD in Haryana, Assam, Punjab...).
-- Each entry: {id, name, state, status, notes:[{at,stage,text,by}], updated_at}
alter table public.b2g_leads
  add column if not exists departments jsonb not null default '[]'::jsonb;
