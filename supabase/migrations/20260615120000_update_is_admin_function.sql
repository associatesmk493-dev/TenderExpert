-- Allow admin role to view all profiles (needed for Import Leads assign section)
-- Admin does NOT get is_admin() access — they still see only their own leads
CREATE POLICY "Admin role can view all profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
