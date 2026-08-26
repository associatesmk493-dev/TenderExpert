-- Add date_of_birth and date_of_joining columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS date_of_joining date;
