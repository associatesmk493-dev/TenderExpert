-- Client GST number is kept on the lead so every proforma / tax invoice picks it up.
alter table public.b2g_leads
  add column if not exists gst_number text;

notify pgrst, 'reload schema';
