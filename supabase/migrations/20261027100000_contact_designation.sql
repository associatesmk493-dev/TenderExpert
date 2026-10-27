-- Designation of the main contact (extra contacts already live in b2g_leads.contacts).
alter table public.b2g_leads
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists contact_designation text,
  add column if not exists gst_number text;

notify pgrst, 'reload schema';
