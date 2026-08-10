-- Add persistent Supabase storage for the Organizational Chart.
-- Run this in the Supabase SQL Editor if setup-supabase.sql was already run.

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

ALTER TABLE public.organization_officials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can insert organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can update organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can delete organization officials" ON public.organization_officials;

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

INSERT INTO public.organization_officials (
  id,
  name,
  position,
  committee,
  focus_area,
  contact,
  email,
  photo_url,
  background,
  level,
  status,
  sort_order,
  updated_at
)
VALUES (
  'sk-chairman-chrystophyr-b-trance',
  'Chrystophyr B. Trance',
  'SK Chairman',
  'Sangguniang Kabataan',
  'Youth development, sports, leadership, and Sangguniang Kabataan programs.',
  NULL,
  NULL,
  NULL,
  'Leads youth-focused programs and represents the Sangguniang Kabataan in barangay initiatives.',
  'sk',
  'Active',
  3,
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  position = EXCLUDED.position,
  committee = EXCLUDED.committee,
  focus_area = EXCLUDED.focus_area,
  background = EXCLUDED.background,
  level = EXCLUDED.level,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';
