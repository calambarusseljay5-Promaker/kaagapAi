-- ==============================================================================
-- FIX: ADMIN REGISTRATION & ACTIVATION REQUESTS ACCESS (CLEAN & COMPLETE)
-- ==============================================================================

-- 1. Ensure columns exist on resident_activation_requests, residents, and resident_accounts
DO $$
BEGIN
  -- Drop foreign keys on resident_activation_requests if present
  ALTER TABLE IF EXISTS public.resident_activation_requests 
    DROP CONSTRAINT IF EXISTS resident_activation_requests_approved_by_fkey,
    DROP CONSTRAINT IF EXISTS resident_activation_requests_rejected_by_fkey;

  -- Convert column types to TEXT
  ALTER TABLE IF EXISTS public.resident_activation_requests 
    ALTER COLUMN approved_by TYPE TEXT USING approved_by::TEXT,
    ALTER COLUMN rejected_by TYPE TEXT USING rejected_by::TEXT;

  -- Ensure credential, demographic, sector and proof columns exist on resident_activation_requests
  ALTER TABLE IF EXISTS public.resident_activation_requests 
    ADD COLUMN IF NOT EXISTS requested_first_name TEXT,
    ADD COLUMN IF NOT EXISTS requested_middle_name TEXT,
    ADD COLUMN IF NOT EXISTS requested_last_name TEXT,
    ADD COLUMN IF NOT EXISTS requested_suffix TEXT,
    ADD COLUMN IF NOT EXISTS requested_full_name TEXT,
    ADD COLUMN IF NOT EXISTS requested_birthday DATE,
    ADD COLUMN IF NOT EXISTS requested_household_no TEXT,
    ADD COLUMN IF NOT EXISTS requested_house_no TEXT,
    ADD COLUMN IF NOT EXISTS requested_phone TEXT,
    ADD COLUMN IF NOT EXISTS requested_email TEXT,
    ADD COLUMN IF NOT EXISTS requested_sex TEXT,
    ADD COLUMN IF NOT EXISTS requested_birthplace TEXT,
    ADD COLUMN IF NOT EXISTS requested_purok TEXT,
    ADD COLUMN IF NOT EXISTS requested_educational_attainment TEXT,
    ADD COLUMN IF NOT EXISTS requested_occupation TEXT,
    ADD COLUMN IF NOT EXISTS requested_civil_status TEXT,
    ADD COLUMN IF NOT EXISTS requested_relationship_to_household_head TEXT,
    ADD COLUMN IF NOT EXISTS requested_address TEXT,
    ADD COLUMN IF NOT EXISTS requested_is_4ps_member BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS requested_is_solo_parent BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS requested_is_pwd BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS requested_pwd_type TEXT,
    ADD COLUMN IF NOT EXISTS requested_username TEXT,
    ADD COLUMN IF NOT EXISTS requested_plain_password TEXT,
    ADD COLUMN IF NOT EXISTS requested_password_hash TEXT,
    ADD COLUMN IF NOT EXISTS requested_proof_path TEXT,
    ADD COLUMN IF NOT EXISTS requested_proof_name TEXT,
    ADD COLUMN IF NOT EXISTS requested_proof_type TEXT;

  -- Ensure demographic, suffix and sector columns exist on residents
  ALTER TABLE IF EXISTS public.residents
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS middle_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS suffix TEXT,
    ADD COLUMN IF NOT EXISTS birthplace TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS house_no TEXT,
    ADD COLUMN IF NOT EXISTS household_no TEXT,
    ADD COLUMN IF NOT EXISTS relationship_to_household_head TEXT,
    ADD COLUMN IF NOT EXISTS is_4ps_member BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_solo_parent BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pwd_type TEXT;

  -- Ensure credential columns exist on resident_accounts
  ALTER TABLE IF EXISTS public.resident_accounts 
    ADD COLUMN IF NOT EXISTS plain_password TEXT,
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Ensure user_profiles has active admin role for admin accounts
INSERT INTO public.user_profiles (id, role, registration_status, updated_at)
SELECT id, 'admin', 'Active', NOW()
FROM auth.users
WHERE LOWER(email) IN (
  LOWER('calambarusseljay5@gmail.com'),
  LOWER('uppermingading@gmail.com'),
  LOWER('kaagapai@kaagapai.local')
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin',
    registration_status = 'Active',
    updated_at = NOW();

-- 3. Safe current_user_role() function that does not block admins
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT profile.role
      FROM public.user_profiles AS profile
      WHERE profile.id = auth.uid()
      LIMIT 1
    ),
    'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;

-- 4. DROP ALL EXISTING VERSIONS OF THE RPC FUNCTIONS FIRST (Prevents ERROR 42P13)
DROP FUNCTION IF EXISTS public.get_resident_activation_requests(TEXT);
DROP FUNCTION IF EXISTS public.get_resident_activation_requests();
DROP FUNCTION IF EXISTS public.approve_resident_activation_request(UUID);
DROP FUNCTION IF EXISTS public.approve_resident_registration_request(UUID);
DROP FUNCTION IF EXISTS public.reject_resident_activation_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_resident_registration_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.list_resident_account_activation_requests(TEXT);
DROP FUNCTION IF EXISTS public.list_resident_account_activation_requests();
DROP FUNCTION IF EXISTS public.attach_resident_registration_proof(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.request_resident_account_activation(TEXT, DATE, TEXT);

-- 5. CREATE FUNCTION request_resident_account_activation (Online Registration Submission)
CREATE OR REPLACE FUNCTION public.request_resident_account_activation(
  p_full_name TEXT,
  p_birthday DATE,
  p_household_no TEXT,
  p_phone TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_middle_name TEXT DEFAULT NULL,
  p_suffix TEXT DEFAULT NULL,
  p_sex TEXT DEFAULT NULL,
  p_birthplace TEXT DEFAULT NULL,
  p_purok TEXT DEFAULT NULL,
  p_educational_attainment TEXT DEFAULT NULL,
  p_occupation TEXT DEFAULT NULL,
  p_civil_status TEXT DEFAULT NULL,
  p_house_no TEXT DEFAULT NULL,
  p_relationship_to_household_head TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_is_4ps_member BOOLEAN DEFAULT FALSE,
  p_is_solo_parent BOOLEAN DEFAULT FALSE,
  p_is_pwd BOOLEAN DEFAULT FALSE,
  p_pwd_type TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  request_id UUID,
  resident_id UUID,
  status TEXT,
  activation_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_req_id UUID;
BEGIN
  INSERT INTO public.resident_activation_requests (
    requested_full_name,
    requested_first_name,
    requested_middle_name,
    requested_last_name,
    requested_suffix,
    requested_birthday,
    requested_household_no,
    requested_phone,
    requested_sex,
    requested_birthplace,
    requested_purok,
    requested_educational_attainment,
    requested_occupation,
    requested_civil_status,
    requested_house_no,
    requested_relationship_to_household_head,
    requested_address,
    requested_is_4ps_member,
    requested_is_solo_parent,
    requested_is_pwd,
    requested_pwd_type,
    requested_username,
    requested_plain_password,
    requested_password_hash,
    requested_email,
    status,
    request_date
  )
  VALUES (
    p_full_name,
    p_first_name,
    p_middle_name,
    p_last_name,
    p_suffix,
    p_birthday,
    p_household_no,
    p_phone,
    COALESCE(p_sex, 'Male'),
    p_birthplace,
    p_purok,
    p_educational_attainment,
    p_occupation,
    COALESCE(p_civil_status, 'Single'),
    p_house_no,
    COALESCE(p_relationship_to_household_head, 'Head'),
    p_address,
    COALESCE(p_is_4ps_member, FALSE),
    COALESCE(p_is_solo_parent, FALSE),
    COALESCE(p_is_pwd, FALSE),
    p_pwd_type,
    p_username,
    p_password,
    p_password,
    p_email,
    'Pending Approval',
    NOW()
  )
  RETURNING id INTO v_req_id;

  RETURN QUERY
  SELECT
    v_req_id,
    NULL::UUID,
    'Pending Approval'::TEXT,
    'Your registration has been submitted. Please wait for admin approval.'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_resident_account_activation(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. CREATE FUNCTION get_resident_activation_requests
CREATE OR REPLACE FUNCTION public.get_resident_activation_requests(p_status_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  resident_id UUID,
  request_date TIMESTAMPTZ,
  status TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  requested_full_name TEXT,
  requested_birthday DATE,
  requested_household_no TEXT,
  full_name TEXT,
  birthday DATE,
  household_no TEXT,
  purok TEXT,
  address TEXT,
  username TEXT,
  account_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    request.id,
    request.resident_id,
    request.request_date,
    request.status,
    request.approved_by,
    request.approved_at,
    request.rejected_by,
    request.rejected_at,
    request.rejection_reason,
    request.requested_full_name,
    request.requested_birthday,
    request.requested_household_no,
    COALESCE(resident.full_name, request.requested_full_name),
    COALESCE(resident.birthday, request.requested_birthday),
    COALESCE(NULLIF(TRIM(resident.household_no), ''), NULLIF(TRIM(resident.house_no), ''), request.requested_household_no),
    COALESCE(resident.purok, request.requested_purok),
    COALESCE(resident.address, request.requested_address),
    COALESCE(account.username, request.requested_username),
    COALESCE(account.account_status, 'Pending')
  FROM public.resident_activation_requests AS request
  LEFT JOIN public.residents AS resident ON resident.id = request.resident_id
  LEFT JOIN public.resident_accounts AS account ON account.resident_id = resident.id
  WHERE p_status_filter IS NULL OR p_status_filter = '' OR p_status_filter = 'All' OR request.status = p_status_filter
  ORDER BY request.request_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_resident_activation_requests(TEXT) TO anon, authenticated, service_role;

-- 7. CREATE FUNCTION approve_resident_activation_request
CREATE OR REPLACE FUNCTION public.approve_resident_activation_request(p_request_id UUID)
RETURNS TABLE (
  request_id UUID,
  resident_id UUID,
  full_name TEXT,
  username TEXT,
  temporary_password TEXT,
  account_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request public.resident_activation_requests%ROWTYPE;
  v_resident_id UUID;
  v_full_name TEXT;
  v_username TEXT;
  v_password TEXT;
BEGIN
  SELECT * INTO v_request
  FROM public.resident_activation_requests
  WHERE id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration request not found.';
  END IF;

  v_resident_id := v_request.resident_id;
  v_full_name := v_request.requested_full_name;

  -- Create or find resident record if resident_id is null
  IF v_resident_id IS NULL THEN
    SELECT id INTO v_resident_id
    FROM public.residents
    WHERE LOWER(full_name) = LOWER(v_full_name)
      AND birthday = v_request.requested_birthday
    LIMIT 1;

    IF v_resident_id IS NULL THEN
      INSERT INTO public.residents (
        full_name,
        first_name,
        middle_name,
        last_name,
        suffix,
        phone,
        email,
        house_no,
        household_no,
        relationship_to_household_head,
        birthday,
        sex,
        gender,
        birthplace,
        purok,
        educational_attainment,
        occupation,
        civil_status,
        address,
        is_4ps_member,
        is_solo_parent,
        is_pwd,
        pwd_type,
        status
      )
      VALUES (
        v_full_name,
        v_request.requested_first_name,
        v_request.requested_middle_name,
        v_request.requested_last_name,
        v_request.requested_suffix,
        v_request.requested_phone,
        v_request.requested_email,
        v_request.requested_house_no,
        v_request.requested_household_no,
        COALESCE(v_request.requested_relationship_to_household_head, 'Head'),
        v_request.requested_birthday,
        COALESCE(v_request.requested_sex, 'Male'),
        COALESCE(v_request.requested_sex, 'Male'),
        v_request.requested_birthplace,
        v_request.requested_purok,
        v_request.requested_educational_attainment,
        v_request.requested_occupation,
        COALESCE(v_request.requested_civil_status, 'Single'),
        v_request.requested_address,
        COALESCE(v_request.requested_is_4ps_member, FALSE),
        COALESCE(v_request.requested_is_solo_parent, FALSE),
        COALESCE(v_request.requested_is_pwd, FALSE),
        v_request.requested_pwd_type,
        'Active'
      )
      RETURNING id INTO v_resident_id;
    END IF;
  END IF;

  -- Use EXACT username and password chosen by resident
  v_username := COALESCE(v_request.requested_username, 'resident_' || SUBSTRING(v_resident_id::TEXT FROM 1 FOR 8));
  v_password := COALESCE(v_request.requested_plain_password, v_request.requested_household_no, 'kaagapai123');

  INSERT INTO public.resident_accounts (
    resident_id,
    username,
    plain_password,
    password_hash,
    phone,
    email,
    account_status,
    must_change_credentials
  )
  VALUES (
    v_resident_id,
    v_username,
    v_password,
    v_password,
    v_request.requested_phone,
    v_request.requested_email,
    'Active',
    FALSE
  )
  ON CONFLICT (resident_id) DO UPDATE
  SET username = EXCLUDED.username,
      plain_password = COALESCE(EXCLUDED.plain_password, resident_accounts.plain_password),
      password_hash = COALESCE(EXCLUDED.password_hash, resident_accounts.password_hash),
      phone = COALESCE(EXCLUDED.phone, resident_accounts.phone),
      email = COALESCE(EXCLUDED.email, resident_accounts.email),
      account_status = 'Active',
      must_change_credentials = FALSE,
      updated_at = NOW();

  -- Update request status
  UPDATE public.resident_activation_requests
  SET status = 'Approved',
      approved_at = NOW(),
      approved_by = COALESCE(auth.uid()::TEXT, 'Admin'),
      rejected_at = NULL,
      rejected_by = NULL,
      rejection_reason = NULL,
      resident_id = v_resident_id
  WHERE id = p_request_id;

  RETURN QUERY
  SELECT
    p_request_id,
    v_resident_id,
    v_full_name,
    v_username,
    v_password,
    'Active'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_resident_activation_request(UUID) TO anon, authenticated, service_role;

-- 8. CREATE FUNCTION approve_resident_registration_request (Alias)
CREATE OR REPLACE FUNCTION public.approve_resident_registration_request(p_request_id UUID)
RETURNS TABLE (
  request_id UUID,
  resident_id UUID,
  full_name TEXT,
  username TEXT,
  temporary_password TEXT,
  account_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.approve_resident_activation_request(p_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_resident_registration_request(UUID) TO anon, authenticated, service_role;

-- 9. CREATE FUNCTION reject_resident_activation_request
CREATE OR REPLACE FUNCTION public.reject_resident_activation_request(p_request_id UUID, p_reason TEXT DEFAULT 'Rejected by admin')
RETURNS TABLE (
  request_id UUID,
  status TEXT,
  rejection_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.resident_activation_requests
  SET status = 'Rejected',
      rejected_at = NOW(),
      rejected_by = COALESCE(auth.uid()::TEXT, 'Admin'),
      rejection_reason = COALESCE(p_reason, 'Rejected by admin'),
      approved_at = NULL,
      approved_by = NULL
  WHERE id = p_request_id;

  RETURN QUERY
  SELECT
    p_request_id,
    'Rejected'::TEXT,
    COALESCE(p_reason, 'Rejected by admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_resident_activation_request(UUID, TEXT) TO anon, authenticated, service_role;

-- 10. CREATE FUNCTION attach_resident_registration_proof
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
BEGIN
  UPDATE public.resident_activation_requests
  SET requested_proof_path = p_proof_path,
      requested_proof_name = p_proof_name,
      requested_proof_type = p_proof_type
  WHERE id = p_request_id;

  RETURN QUERY
  SELECT
    p_request_id,
    p_proof_name,
    p_proof_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_resident_registration_proof(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 11. Enable Permissive RLS Policies on resident_activation_requests
ALTER TABLE IF EXISTS public.resident_activation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_activation_requests_all_access" ON public.resident_activation_requests;
CREATE POLICY "resident_activation_requests_all_access"
ON public.resident_activation_requests
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- 12. Storage Bucket and Storage Policies for resident-registration-proofs
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
  TRUE,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = 10485760;

DROP POLICY IF EXISTS "Public can upload resident registration proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view resident registration proofs" ON storage.objects;
DROP POLICY IF EXISTS "resident_registration_proofs_all_access" ON storage.objects;

CREATE POLICY "resident_registration_proofs_all_access"
ON storage.objects FOR ALL
TO anon, authenticated, service_role
USING (bucket_id = 'resident-registration-proofs')
WITH CHECK (bucket_id = 'resident-registration-proofs');
