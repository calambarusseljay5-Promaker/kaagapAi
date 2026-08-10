-- Run this in Supabase SQL Editor if Livelihood & Jobs or Announcements says:
-- "Could not find the table ... in the schema cache".
--
-- This creates only the new module tables, policies, and sample records.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Resident PWD/PWED reporting columns
ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT FALSE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS pwd_type TEXT;

UPDATE public.residents
SET is_pwd = FALSE
WHERE is_pwd IS NULL;

CREATE INDEX IF NOT EXISTS idx_residents_is_pwd ON public.residents(is_pwd);

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.livelihood_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Program',
  organization TEXT,
  description TEXT,
  eligibility TEXT,
  slots INTEGER,
  location TEXT,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livelihood_posts_category ON public.livelihood_posts(category);
CREATE INDEX IF NOT EXISTS idx_livelihood_posts_status ON public.livelihood_posts(status);
CREATE INDEX IF NOT EXISTS idx_livelihood_posts_deadline ON public.livelihood_posts(deadline);
CREATE INDEX IF NOT EXISTS idx_livelihood_posts_created_at ON public.livelihood_posts(created_at);

INSERT INTO public.livelihood_posts
  (title, category, organization, description, eligibility, slots, location, contact, status, deadline)
SELECT sample.title,
       sample.category,
       sample.organization,
       sample.description,
       sample.eligibility,
       sample.slots,
       sample.location,
       sample.contact,
       sample.status,
       sample.deadline::DATE
FROM (VALUES
  ('TESDA Computer Literacy Training', 'Training', 'Barangay Upper Mingading', 'Basic computer literacy training for residents.', 'Open to residents 18 years old and above', 30, 'Barangay Hall', 'Barangay Office', 'Open', '2026-06-15'),
  ('Community Job Fair', 'Job', 'Municipal PESO', 'Local employers will accept applicants for entry-level positions.', 'Bring resume and valid ID', 80, 'Aleosan Gymnasium', 'PESO Office', 'Open', '2026-06-20'),
  ('Urban Gardening Livelihood Program', 'Program', 'Agriculture Office', 'Starter kits and coaching for backyard vegetable production.', 'Priority for low-income households', 25, 'Barangay Nursery', 'Agriculture Coordinator', 'Open', '2026-07-01')
) AS sample(title, category, organization, description, eligibility, slots, location, contact, status, deadline)
WHERE NOT EXISTS (SELECT 1 FROM public.livelihood_posts);

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  audience TEXT NOT NULL DEFAULT 'All Residents',
  status TEXT NOT NULL DEFAULT 'Draft',
  publish_date DATE DEFAULT CURRENT_DATE,
  expires_at DATE,
  sms_recipient_phones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS sms_recipient_phones TEXT;

CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_category ON public.announcements(category);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_date ON public.announcements(publish_date);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at);

CREATE TABLE IF NOT EXISTS public.organization_officials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  committee TEXT,
  focus_area TEXT,
  contact TEXT,
  email TEXT,
  photo_url TEXT,
  background TEXT,
  level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_officials_level ON public.organization_officials(level);
CREATE INDEX IF NOT EXISTS idx_organization_officials_sort_order ON public.organization_officials(sort_order);

INSERT INTO public.announcements
(title, body, category, audience, status, publish_date, expires_at)
SELECT sample.title,
       sample.body,
       sample.category,
       sample.audience,
       sample.status,
       sample.publish_date::DATE,
       sample.expires_at::DATE
FROM (VALUES
  ('Job Fair: June 20, 2026', 'Residents are invited to attend the community job fair. Bring a resume and valid ID.', 'Livelihood', 'All Residents', 'Published', '2026-06-01', '2026-06-21'),
  ('Free TESDA Computer Literacy Training', 'Registration is open at the barangay office for free computer literacy training.', 'Training', 'All Residents', 'Published', '2026-06-03', '2026-06-16'),
  ('Clean-Up Drive this Saturday', 'All puroks are encouraged to join the community clean-up drive.', 'Community', 'All Residents', 'Published', '2026-06-05', '2026-06-12')
) AS sample(title, body, category, audience, status, publish_date, expires_at)
WHERE NOT EXISTS (SELECT 1 FROM public.announcements);

CREATE TABLE IF NOT EXISTS public.ai_knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  audience TEXT NOT NULL DEFAULT 'All Residents',
  status TEXT NOT NULL DEFAULT 'Active',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  effective_date DATE,
  expires_at DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_knowledge_source_unique
ON public.ai_knowledge_items(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_status ON public.ai_knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_category ON public.ai_knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_source_type ON public.ai_knowledge_items(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_updated_at ON public.ai_knowledge_items(updated_at);

ALTER TABLE public.livelihood_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can insert livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can update livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can delete livelihood posts" ON public.livelihood_posts;

CREATE POLICY "Anyone can read livelihood posts"
ON public.livelihood_posts FOR SELECT
USING (true);

CREATE POLICY "Admins can insert livelihood posts"
ON public.livelihood_posts FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update livelihood posts"
ON public.livelihood_posts FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete livelihood posts"
ON public.livelihood_posts FOR DELETE
USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can read organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can insert organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can update organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can delete organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Residents can read active AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can insert AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can update AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can delete AI knowledge" ON public.ai_knowledge_items;

CREATE POLICY "Anyone can read announcements"
ON public.announcements FOR SELECT
USING (true);

CREATE POLICY "Admins can insert announcements"
ON public.announcements FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update announcements"
ON public.announcements FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete announcements"
ON public.announcements FOR DELETE
USING (public.current_user_role() = 'admin');

CREATE POLICY "Anyone can read organization officials"
ON public.organization_officials FOR SELECT
USING (true);

CREATE POLICY "Admins can insert organization officials"
ON public.organization_officials FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update organization officials"
ON public.organization_officials FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete organization officials"
ON public.organization_officials FOR DELETE
USING (public.current_user_role() = 'admin');

CREATE POLICY "Residents can read active AI knowledge"
ON public.ai_knowledge_items FOR SELECT
USING (
  (
    status = 'Active'
    AND COALESCE(audience, 'All Residents') <> 'Admin Only'
    AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
    AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  )
  OR public.current_user_role() = 'admin'
);

CREATE POLICY "Admins can insert AI knowledge"
ON public.ai_knowledge_items FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update AI knowledge"
ON public.ai_knowledge_items FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete AI knowledge"
ON public.ai_knowledge_items FOR DELETE
USING (public.current_user_role() = 'admin');

NOTIFY pgrst, 'reload schema';
