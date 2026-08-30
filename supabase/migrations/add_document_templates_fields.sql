-- Migration: Add extended fields to document_templates
-- Backward-compatible: Adds missing columns safely without dropping or breaking existing data

ALTER TABLE IF EXISTS document_templates 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Certification',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_document_templates_status ON document_templates(status);
CREATE INDEX IF NOT EXISTS idx_document_templates_category ON document_templates(category);
