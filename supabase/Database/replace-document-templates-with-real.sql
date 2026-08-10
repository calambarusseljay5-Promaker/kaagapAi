-- Run this in the Supabase SQL Editor to replace the old sample document
-- request templates with the real Barangay Upper Mingading Word templates.

ALTER TABLE public.document_templates
ADD COLUMN IF NOT EXISTS template_file_path TEXT;

DELETE FROM public.document_templates
WHERE template_name IN (
  'Barangay Clearance',
  'Certificate of Residency',
  'Business Permit',
  'Barangay ID',
  'Indigency Certificate',
  'Good Moral Certificate',
  'Travel Authority',
  'NBI Clearance Request',
  'Certificate of Indigency',
  'Business Permit Certification',
  'RSBSA Certification',
  'Solo Parent Certification',
  '4Ps Certification'
)
OR document_type IN (
  'Clearance',
  'Residency Certificate',
  'Business Permit',
  'ID Card',
  'Indigency Certificate',
  'Good Moral Certificate',
  'Travel Authority',
  'NBI Clearance',
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'RSBSA Certification',
  'Solo Parent Certification',
  '4Ps Certification'
);

INSERT INTO public.document_templates (
  template_name,
  document_type,
  description,
  requirements,
  processing_time,
  fee,
  template_file_path
)
VALUES
  (
    'Barangay Clearance',
    'Barangay Clearance',
    'Official barangay clearance based on existing barangay records and good standing in the community',
    'Valid ID; proof of residency; purpose of request',
    '1 day',
    'As assessed by barangay office',
    '/files/document-templates/cert.barangay-clearance.docx'
  ),
  (
    'Certificate of Residency',
    'Certificate of Residency',
    'Certifies that the requester is a bona fide resident of Barangay Upper Mingading',
    'Valid ID; proof of residency; purpose of request',
    '1 day',
    'As assessed by barangay office',
    '/files/document-templates/Cert.Residency-Templates.docx'
  ),
  (
    'Certificate of Indigency',
    'Certificate of Indigency',
    'Certifies low-income or indigent status for assistance and official requirements',
    'Valid ID; proof of residency; purpose of request',
    '1 day',
    'As assessed by barangay office',
    '/files/document-templates/Cert.indigency-templates.docx'
  ),
  (
    'Business Permit',
    'Business Permit',
    'Barangay certification for business permit application and local business verification',
    'Valid ID; barangay clearance; business details; purpose of request',
    '1 day',
    'As assessed by barangay office',
    '/files/document-templates/Cert.BUSINESS-Permit.docx'
  ),
  (
    'RSBSA Certification',
    'RSBSA Certification',
    'Certification for farmers and fisherfolk registration in the Registry System for Basic Sectors in Agriculture',
    'Valid ID; farm or crop details; proof of residency',
    '1 day',
    'As assessed by barangay office',
    '/files/document-templates/cert.Rsbsa-templates.docx'
  ),
  (
    'Solo Parent Certification',
    'Solo Parent Certification',
    'Barangay certification supporting solo parent application or related legal purpose',
    'Valid ID; proof of residency; supporting solo parent document; purpose of request',
    '1 day',
    'As assessed by barangay office',
    '/files/document-templates/Cert.-solo-parent-Templates.docx'
  ),
  (
    '4Ps Certification',
    '4Ps Certification',
    'Barangay certification for Pantawid Pamilyang Pilipino Program or change-grantee requirements',
    'Valid ID; proof of residency; 4Ps details; purpose of request',
    '1 day',
    'As assessed by barangay office',
    '/files/document-templates/Barangay-Cert.templates.-4ps.docx'
  );

NOTIFY pgrst, 'reload schema';
