-- Add COGS, SP (selling price), and days (credit/payment days) to leads
alter table public.leads
  add column if not exists cogs numeric,
  add column if not exists sp   numeric,
  add column if not exists days integer;
