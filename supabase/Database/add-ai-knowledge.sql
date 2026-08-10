-- Run this in Supabase SQL Editor to enable the AI Knowledge Trainer
-- for announcements, events, jobs, and trainings.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_effective_date ON public.ai_knowledge_items(effective_date);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_expires_at ON public.ai_knowledge_items(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_updated_at ON public.ai_knowledge_items(updated_at);

ALTER TABLE public.ai_knowledge_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Residents can read active AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can insert AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can update AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can delete AI knowledge" ON public.ai_knowledge_items;

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
