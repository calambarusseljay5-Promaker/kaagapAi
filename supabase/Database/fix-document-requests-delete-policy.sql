-- Fix document requests RLS policies for delete and update
-- Run this script in the Supabase SQL Editor to allow admin and resident request deletion/updates.

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can delete requests" ON public.document_requests;
DROP POLICY IF EXISTS "Anyone can delete document requests" ON public.document_requests;
DROP POLICY IF EXISTS "Local resident login can delete requests" ON public.document_requests;
DROP POLICY IF EXISTS "Allow delete document requests" ON public.document_requests;

CREATE POLICY "Allow delete document requests"
ON public.document_requests FOR DELETE
USING (true);

DROP POLICY IF EXISTS "Admins can update requests" ON public.document_requests;
DROP POLICY IF EXISTS "Allow update document requests" ON public.document_requests;

CREATE POLICY "Allow update document requests"
ON public.document_requests FOR UPDATE
USING (true)
WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
