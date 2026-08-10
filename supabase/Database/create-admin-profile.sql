-- Create or repair the admin profile for your Supabase Auth admin user.
--
-- Steps:
-- 1. In Supabase Dashboard, create the user in Authentication > Users.
-- 2. Confirm the email below matches that user's email.
-- 3. Run this file in Supabase SQL Editor.

INSERT INTO public.user_profiles (id, role, registration_status, resident_id, updated_at)
SELECT id, 'admin', 'Active', NULL, NOW()
FROM auth.users
WHERE LOWER(email) = LOWER('calambarusseljay5@gmail.com')
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role,
    registration_status = EXCLUDED.registration_status,
    resident_id = NULL,
    updated_at = NOW();

UPDATE public.user_profiles
SET role = 'resident',
    updated_at = NOW()
WHERE role = 'admin'
  AND id NOT IN (
    SELECT id
    FROM auth.users
    WHERE LOWER(email) = LOWER('calambarusseljay5@gmail.com')
  );

SELECT profile.id,
       auth_user.email,
       profile.role,
       profile.registration_status,
       profile.resident_id,
       profile.created_at,
       profile.updated_at
FROM public.user_profiles AS profile
JOIN auth.users AS auth_user
  ON auth_user.id = profile.id
WHERE LOWER(auth_user.email) = LOWER('calambarusseljay5@gmail.com');

NOTIFY pgrst, 'reload schema';
