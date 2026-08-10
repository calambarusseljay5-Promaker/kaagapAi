-- Run this in the Supabase SQL Editor to enable document template uploads.

ALTER TABLE public.document_templates
ADD COLUMN IF NOT EXISTS template_file_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-templates',
  'document-templates',
  TRUE,
  20971520,
  ARRAY[
    'application/msword',
    'application/pdf',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins can insert document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Admins can update document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Admins can delete document templates" ON public.document_templates;

CREATE POLICY "Admins can insert document templates"
ON public.document_templates FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update document templates"
ON public.document_templates FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete document templates"
ON public.document_templates FOR DELETE
USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Anyone can read document template files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload document template files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update document template files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete document template files" ON storage.objects;

CREATE POLICY "Anyone can read document template files"
ON storage.objects FOR SELECT
USING (bucket_id = 'document-templates');

CREATE POLICY "Admins can upload document template files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'document-templates'
  AND public.current_user_role() = 'admin'
);

CREATE POLICY "Admins can update document template files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'document-templates'
  AND public.current_user_role() = 'admin'
)
WITH CHECK (
  bucket_id = 'document-templates'
  AND public.current_user_role() = 'admin'
);

CREATE POLICY "Admins can delete document template files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'document-templates'
  AND public.current_user_role() = 'admin'
);

NOTIFY pgrst, 'reload schema';
