-- Free-text research about the company (net worth, key information, products to pitch).
alter table public.b2g_leads
  add column if not exists company_research text;

notify pgrst, 'reload schema';
