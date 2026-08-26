-- Dedicated "finance touched at" timestamp, set only when a lead's own payment
-- fields (advance/before/after delivery, proposed/quoted amount) are edited.
-- updated_at changes on ANY field edit (stage, temperature, notes, ...), so it
-- can't reliably answer "when was this amount actually recorded" for date-range
-- sales reporting.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS finance_updated_at TIMESTAMPTZ;
