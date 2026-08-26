ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS order_won_status text;

NOTIFY pgrst, 'reload schema';
