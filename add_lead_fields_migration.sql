-- Run in Supabase SQL Editor
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS business_type text;
