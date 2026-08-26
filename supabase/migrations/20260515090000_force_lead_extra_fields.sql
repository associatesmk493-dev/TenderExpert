ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS proposed_amount numeric,
  ADD COLUMN IF NOT EXISTS quoted_amount numeric,
  ADD COLUMN IF NOT EXISTS closed_amount numeric;

NOTIFY pgrst, 'reload schema';
