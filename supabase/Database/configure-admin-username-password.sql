-- ==============================================================================
-- Barangay KaagapAI: Admin Username & Password Configuration
-- ==============================================================================
-- Default Admin Credentials:
--   Username: kaagapai
--   Password: kaagapai123
--
-- This script ensures your Supabase Database correctly designates the admin user
-- and grants full administrative access for RLS policies across the system.
--
-- Steps to run in Supabase SQL Editor:
-- 1. Open your Supabase Dashboard -> SQL Editor.
-- 2. Paste and run this script.
-- ==============================================================================

-- 1. Ensure user_profiles table exists
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'resident',
  registration_status TEXT NOT NULL DEFAULT 'Active',
  phone TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 2. Ensure admin user has role = 'admin' in public.user_profiles
INSERT INTO public.user_profiles (id, role, registration_status, updated_at)
SELECT id, 'admin', 'Active', NOW()
FROM auth.users
WHERE LOWER(email) IN (
  LOWER('calambarusseljay5@gmail.com'),
  LOWER('uppermingading@gmail.com'),
  LOWER('kaagapai@kaagapai.local')
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin',
    registration_status = 'Active',
    updated_at = NOW();

-- 3. Robust current_user_role() function for RLS checks
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT profile.role
      FROM public.user_profiles AS profile
      WHERE profile.id = auth.uid()
      LIMIT 1
    ),
    'resident'
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;

-- 4. Verify admin user profiles
SELECT 
  profile.id,
  auth_user.email,
  profile.role,
  profile.registration_status,
  profile.updated_at
FROM public.user_profiles AS profile
JOIN auth.users AS auth_user ON auth_user.id = profile.id
WHERE profile.role = 'admin';

NOTIFY pgrst, 'reload schema';
