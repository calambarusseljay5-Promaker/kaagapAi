-- Harden admin access so only the authorized Supabase Auth user can be admin.
--
-- Run this in Supabase SQL Editor if setup-supabase.sql was already run before
-- these hardening rules were added.

ALTER TABLE public.user_profiles
ALTER COLUMN role SET DEFAULT 'resident';

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN profile.role = 'admin'
      AND EXISTS (
        SELECT 1
        FROM auth.users AS auth_user
        WHERE auth_user.id = profile.id
          AND LOWER(auth_user.email) = LOWER('calambarusseljay5@gmail.com')
      )
      THEN 'admin'
    WHEN profile.role IN ('resident', 'user')
      THEN profile.role
    ELSE 'resident'
  END
  FROM public.user_profiles AS profile
  WHERE profile.id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;

UPDATE public.user_profiles
SET role = 'resident',
    updated_at = NOW()
WHERE role = 'admin'
  AND id NOT IN (
    SELECT id
    FROM auth.users
    WHERE LOWER(email) = LOWER('calambarusseljay5@gmail.com')
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    role <> 'admin'
    OR public.current_user_role() = 'admin'
  )
);

CREATE POLICY "Service role can insert profiles"
ON public.user_profiles FOR INSERT TO service_role
WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
