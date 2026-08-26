-- Add customer review fields to leads (only visible/relevant for Order Won)
alter table public.leads
  add column if not exists review_rating   integer check (review_rating between 1 and 5),
  add column if not exists review_text     text,
  add column if not exists review_photo_url text;  -- Google Drive / any URL, no storage used
