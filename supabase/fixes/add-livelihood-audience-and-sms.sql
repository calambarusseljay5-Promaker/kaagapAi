-- Add audience and sms_recipient_phones columns to public.livelihood_posts
-- Run this in the Supabase SQL Editor to resolve the missing column error.

ALTER TABLE public.livelihood_posts
ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'All Residents';

ALTER TABLE public.livelihood_posts
ADD COLUMN IF NOT EXISTS sms_recipient_phones TEXT;

NOTIFY pgrst, 'reload schema';
