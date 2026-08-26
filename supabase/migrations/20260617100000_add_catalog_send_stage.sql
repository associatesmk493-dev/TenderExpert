-- Add 'catalog_send' to the funnel_stage enum
ALTER TYPE public.funnel_stage ADD VALUE IF NOT EXISTS 'catalog_send';
