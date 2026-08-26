ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS advance_amount numeric,
  ADD COLUMN IF NOT EXISTS before_delivery_amount numeric,
  ADD COLUMN IF NOT EXISTS after_delivery_amount numeric,
  ADD COLUMN IF NOT EXISTS edd date,
  ADD COLUMN IF NOT EXISTS margin_percent numeric;

NOTIFY pgrst, 'reload schema';
