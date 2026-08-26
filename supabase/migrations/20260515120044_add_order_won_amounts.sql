ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS order_won_amounts jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
