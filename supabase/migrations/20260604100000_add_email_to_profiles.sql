-- Add email to profiles and sync from auth.users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Populate email for existing profiles from auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE au.id = p.user_id
  AND p.email IS NULL;

-- Keep email in sync on future inserts/updates
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email();
