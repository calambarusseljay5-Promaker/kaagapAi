-- Add saved SMS recipient phone numbers to announcements.
-- Run this in the Supabase SQL Editor if setup-supabase.sql was already run.

ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS sms_recipient_phones TEXT;

NOTIFY pgrst, 'reload schema';
