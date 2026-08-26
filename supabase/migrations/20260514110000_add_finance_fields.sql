ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS proposed_amount numeric,
  ADD COLUMN IF NOT EXISTS quoted_amount numeric,
  ADD COLUMN IF NOT EXISTS closed_amount numeric;
