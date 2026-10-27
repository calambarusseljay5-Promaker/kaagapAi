-- ==============================================================================
-- KaagapAI: Fix Announcements, Livelihood, Officials & AI Knowledge RLS Policies
-- Run this in your Supabase SQL Editor to grant full CRUD permissions for
-- Announcements, Livelihood posts, Officials, and AI Knowledge items.
-- ==============================================================================

-- 1. Enable Row Level Security (RLS)
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.livelihood_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_knowledge_items ENABLE ROW LEVEL SECURITY;

-- 2. Announcements Policies
DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow all for announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow delete announcements" ON public.announcements;

CREATE POLICY "Anyone can read announcements"
ON public.announcements FOR SELECT
USING (true);

CREATE POLICY "Allow insert announcements"
ON public.announcements FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update announcements"
ON public.announcements FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete announcements"
ON public.announcements FOR DELETE
USING (true);

-- 3. Livelihood Posts Policies
DROP POLICY IF EXISTS "Anyone can read livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can insert livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can update livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can delete livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Allow insert livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Allow update livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Allow delete livelihood posts" ON public.livelihood_posts;

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

-- 4. Organization Officials Policies
DROP POLICY IF EXISTS "Anyone can read organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can insert organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can update organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can delete organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Allow insert organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Allow update organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Allow delete organization officials" ON public.organization_officials;

CREATE POLICY "Anyone can read organization officials"
ON public.organization_officials FOR SELECT
USING (true);

CREATE POLICY "Allow insert organization officials"
ON public.organization_officials FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update organization officials"
ON public.organization_officials FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete organization officials"
ON public.organization_officials FOR DELETE
USING (true);

-- 5. AI Knowledge Items Policies
DROP POLICY IF EXISTS "Residents can read active AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can insert AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can update AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can delete AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Anyone can read AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Allow insert AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Allow update AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Allow delete AI knowledge" ON public.ai_knowledge_items;

CREATE POLICY "Anyone can read AI knowledge"
ON public.ai_knowledge_items FOR SELECT
USING (true);

CREATE POLICY "Allow insert AI knowledge"
ON public.ai_knowledge_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update AI knowledge"
ON public.ai_knowledge_items FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete AI knowledge"
ON public.ai_knowledge_items FOR DELETE
USING (true);

-- 6. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
