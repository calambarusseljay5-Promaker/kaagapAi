-- Run this in Supabase SQL Editor to enable resident document requests and notifications.

CREATE TABLE IF NOT EXISTS public.resident_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  document_request_id UUID REFERENCES public.document_requests(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resident_notifications_resident_id ON public.resident_notifications(resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_notifications_created_at ON public.resident_notifications(created_at);

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Local resident login can read requests" ON public.document_requests;
DROP POLICY IF EXISTS "Local resident login can create requests" ON public.document_requests;
DROP POLICY IF EXISTS "Local resident login can read notifications" ON public.resident_notifications;
DROP POLICY IF EXISTS "Local resident login can update notifications" ON public.resident_notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.resident_notifications;

-- The capstone resident login uses residents.email + house_no in the frontend.
CREATE POLICY "Local resident login can read requests"
ON public.document_requests FOR SELECT
USING (true);

CREATE POLICY "Local resident login can create requests"
ON public.document_requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Local resident login can read notifications"
ON public.resident_notifications FOR SELECT
USING (true);

CREATE POLICY "Local resident login can update notifications"
ON public.resident_notifications FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can insert notifications"
ON public.resident_notifications FOR INSERT
WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
