-- Add rnr_count to track how many times a lead was called with no response
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rnr_count integer NOT NULL DEFAULT 0;
