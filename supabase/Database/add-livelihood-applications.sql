-- Run this in Supabase SQL Editor to enable one-click livelihood/job applications

-- Create table for tracking livelihood and job applications
CREATE TABLE IF NOT EXISTS public.livelihood_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livelihood_post_id UUID NOT NULL, -- Intentionally left without foreign key if livelihood_posts is managed differently, or we can use REFERENCES public.livelihood_posts(id) ON DELETE CASCADE
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- We assume livelihood_posts table exists since it is used in livelihoodService.js
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'livelihood_posts') THEN
    ALTER TABLE public.livelihood_applications
    ADD CONSTRAINT fk_livelihood_post
    FOREIGN KEY (livelihood_post_id) REFERENCES public.livelihood_posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_livelihood_applications_post ON public.livelihood_applications(livelihood_post_id);
CREATE INDEX IF NOT EXISTS idx_livelihood_applications_resident ON public.livelihood_applications(resident_id);
CREATE INDEX IF NOT EXISTS idx_livelihood_applications_status ON public.livelihood_applications(status);

-- Enable RLS
ALTER TABLE public.livelihood_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if recreating
DROP POLICY IF EXISTS "Residents can view their own applications" ON public.livelihood_applications;
DROP POLICY IF EXISTS "Residents can create their own applications" ON public.livelihood_applications;
DROP POLICY IF EXISTS "Admins can view and manage all applications" ON public.livelihood_applications;

-- Create RLS Policies
CREATE POLICY "Residents can view their own applications"
ON public.livelihood_applications FOR SELECT
USING (true);

CREATE POLICY "Residents can create their own applications"
ON public.livelihood_applications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view and manage all applications"
ON public.livelihood_applications FOR ALL
USING (true);

-- Ensure resident_notifications table exists for notifying residents
CREATE TABLE IF NOT EXISTS public.resident_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  document_request_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
