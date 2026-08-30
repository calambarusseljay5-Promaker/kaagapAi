-- Fix: Configure Supabase Storage bucket for document-templates
-- Run this script in the Supabase SQL Editor

-- 1. Create document-templates storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-templates', 'document-templates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Policies for document-templates bucket
DO $$
BEGIN
    -- Allow public read access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for document-templates'
    ) THEN
        CREATE POLICY "Public Access for document-templates"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'document-templates');
    END IF;

    -- Allow upload
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow upload to document-templates'
    ) THEN
        CREATE POLICY "Allow upload to document-templates"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'document-templates');
    END IF;

    -- Allow update
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow update to document-templates'
    ) THEN
        CREATE POLICY "Allow update to document-templates"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'document-templates');
    END IF;

    -- Allow delete
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow delete from document-templates'
    ) THEN
        CREATE POLICY "Allow delete from document-templates"
        ON storage.objects FOR DELETE
        USING (bucket_id = 'document-templates');
    END IF;
END $$;
