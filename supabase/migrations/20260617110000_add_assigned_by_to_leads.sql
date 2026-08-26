-- Track who assigned each lead
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
