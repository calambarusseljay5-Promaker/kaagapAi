-- ==============================================================================
-- KaagapAI: Fix Livelihood Posts Row-Level Security (RLS) Policy
-- Run this in your Supabase SQL Editor to allow creating, updating, and deleting
-- livelihood posts from the admin interface.
-- ==============================================================================

-- 1. Ensure RLS is enabled on livelihood_posts
ALTER TABLE IF EXISTS public.livelihood_posts ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can read livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can insert livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can update livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can delete livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Allow insert livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Allow update livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Allow delete livelihood posts" ON public.livelihood_posts;

-- 3. Create permissive policies for Capstone evaluation & local admin session
CREATE POLICY "Anyone can read livelihood posts"
ON public.livelihood_posts FOR SELECT
USING (true);

CREATE POLICY "Allow insert livelihood posts"
ON public.livelihood_posts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update livelihood posts"
ON public.livelihood_posts FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete livelihood posts"
ON public.livelihood_posts FOR DELETE
USING (true);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
