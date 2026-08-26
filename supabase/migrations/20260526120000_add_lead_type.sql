-- Add lead_type column to leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_type text
    CHECK (lead_type IN ('nbd_incoming', 'nbd_outgoing', 'nbd_crr'));
