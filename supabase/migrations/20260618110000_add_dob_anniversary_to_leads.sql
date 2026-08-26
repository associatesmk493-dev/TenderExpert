-- Add date_of_birth and marriage_anniversary to leads table
alter table leads
  add column if not exists date_of_birth text,
  add column if not exists marriage_anniversary text;
