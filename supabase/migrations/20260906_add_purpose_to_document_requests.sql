-- Add purpose column to document_requests table for storing custom resident request purpose
ALTER TABLE IF EXISTS public.document_requests 
ADD COLUMN IF NOT EXISTS purpose TEXT;

-- Add index for purpose lookups
CREATE INDEX IF NOT EXISTS idx_document_requests_purpose 
ON public.document_requests(purpose);

-- Reload schema cache notification
COMMENT ON COLUMN public.document_requests.purpose IS 'Specific purpose or reason for requesting the document (e.g. Local Employment, Scholarship, OWWA, Business, etc.)';
