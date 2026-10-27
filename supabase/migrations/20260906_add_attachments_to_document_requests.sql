-- Optional cleanup: Update document_templates to display 'business name' instead of 'business details'
UPDATE public.document_templates
SET requirements = REPLACE(requirements, 'business details', 'business name')
WHERE document_type ILIKE '%business%' OR template_name ILIKE '%business%';
