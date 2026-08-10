-- Private proof upload and admin review for online resident registration.
-- Run after add-resident-account-activation.sql and add-online-resident-registration.sql.

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_proof_path TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_proof_name TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_proof_type TEXT;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'resident-registration-proofs',
  'resident-registration-proofs',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can upload resident registration proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view resident registration proofs" ON storage.objects;

CREATE POLICY "Public can upload resident registration proofs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'resident-registration-proofs');

CREATE POLICY "Admins can view resident registration proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resident-registration-proofs'
  AND public.current_user_role() = 'admin'
);

CREATE OR REPLACE FUNCTION public.attach_resident_registration_proof(
  p_request_id UUID,
  p_proof_path TEXT,
  p_proof_name TEXT,
  p_proof_type TEXT
)
RETURNS TABLE (
  request_id UUID,
  proof_name TEXT,
  proof_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_path TEXT := NULLIF(TRIM(COALESCE(p_proof_path, '')), '');
  v_name TEXT := NULLIF(TRIM(COALESCE(p_proof_name, '')), '');
  v_type TEXT := LOWER(NULLIF(TRIM(COALESCE(p_proof_type, '')), ''));
  v_request public.resident_activation_requests%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR v_path IS NULL OR v_name IS NULL OR v_type IS NULL THEN
    RAISE EXCEPTION 'Registration request and proof details are required.';
  END IF;

  IF v_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'Proof must be a JPG, PNG, WebP, or PDF file.';
  END IF;

  IF v_path NOT LIKE p_request_id::TEXT || '/%' THEN
    RAISE EXCEPTION 'Invalid proof path for this registration request.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.resident_activation_requests AS request
  WHERE request.id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration request not found.';
  END IF;

  IF v_request.status <> 'Pending Approval' THEN
    RAISE EXCEPTION 'Proof can only be attached to a pending registration request.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects AS object
    WHERE object.bucket_id = 'resident-registration-proofs'
      AND object.name = v_path
  ) THEN
    RAISE EXCEPTION 'Uploaded proof file was not found.';
  END IF;

  UPDATE public.resident_activation_requests
  SET requested_proof_path = v_path,
      requested_proof_name = v_name,
      requested_proof_type = v_type,
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    v_request.id,
    v_request.requested_proof_name,
    v_request.requested_proof_type;
END
$$;

GRANT EXECUTE ON FUNCTION public.attach_resident_registration_proof(UUID, TEXT, TEXT, TEXT)
TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.require_resident_registration_proof_for_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'Pending Approval'
     AND NEW.status = 'Approved'
     AND NULLIF(TRIM(COALESCE(OLD.requested_proof_path, NEW.requested_proof_path, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A valid ID or proof of residency is required before approval.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS require_resident_registration_proof_before_approval
ON public.resident_activation_requests;

CREATE TRIGGER require_resident_registration_proof_before_approval
BEFORE UPDATE OF status ON public.resident_activation_requests
FOR EACH ROW
EXECUTE FUNCTION public.require_resident_registration_proof_for_approval();

NOTIFY pgrst, 'reload schema';
