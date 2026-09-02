-- ==============================================================================
-- KaagapAI: Enable Real-time Postgres Replication for Instant Notifications
-- Run this in your Supabase SQL Editor to enable automatic real-time WebSocket
-- updates for all modules (Documents, Announcements, Livelihood, Registrations).
-- ==============================================================================

-- 1. Ensure Full Replica Identity on all key tables so payloads include all fields
ALTER TABLE IF EXISTS public.announcements REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.document_requests REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.livelihood_posts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.livelihood_applications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.resident_notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.residents REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.resident_activation_requests REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.resident_profile_update_requests REPLICA IDENTITY FULL;

-- 2. Add all tables to supabase_realtime publication
DO $$
BEGIN
  -- Add announcements if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;

  -- Add document_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'document_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_requests;
  END IF;

  -- Add livelihood_posts
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'livelihood_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.livelihood_posts;
  END IF;

  -- Add livelihood_applications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'livelihood_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.livelihood_applications;
  END IF;

  -- Add resident_notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'resident_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.resident_notifications;
  END IF;

  -- Add residents
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'residents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.residents;
  END IF;

  -- Add resident_activation_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'resident_activation_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.resident_activation_requests;
  END IF;

  -- Add resident_profile_update_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'resident_profile_update_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.resident_profile_update_requests;
  END IF;
END $$;
