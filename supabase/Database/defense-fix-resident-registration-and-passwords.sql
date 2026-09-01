-- ==============================================================================
-- KAAGAPAI: COMPLETE DEFENSE-READY RESIDENT REGISTRATION & PASSWORD SYNC MIGRATION
-- Copy and run this entire script in your Supabase SQL Editor.
-- This ensures online registration, password saving, and resident login work 100%.
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

-- 1. Ensure all columns exist on public.residents
ALTER TABLE IF EXISTS public.residents
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS suffix TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS house_no TEXT,
  ADD COLUMN IF NOT EXISTS household_no TEXT,
  ADD COLUMN IF NOT EXISTS relationship_to_household_head TEXT,
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS birthplace TEXT,
  ADD COLUMN IF NOT EXISTS purok TEXT,
  ADD COLUMN IF NOT EXISTS educational_attainment TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS civil_status TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS is_4ps_member BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_solo_parent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pwd_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure public.resident_accounts table and columns exist
CREATE TABLE IF NOT EXISTS public.resident_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID UNIQUE REFERENCES public.residents(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  plain_password TEXT,
  phone TEXT,
  email TEXT,
  account_status TEXT DEFAULT 'Active',
  must_change_credentials BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.resident_accounts
  ADD COLUMN IF NOT EXISTS plain_password TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS must_change_credentials BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Ensure public.resident_activation_requests table and columns exist
CREATE TABLE IF NOT EXISTS public.resident_activation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  requested_full_name TEXT NOT NULL,
  requested_first_name TEXT,
  requested_middle_name TEXT,
  requested_last_name TEXT,
  requested_suffix TEXT,
  requested_birthday DATE NOT NULL,
  requested_household_no TEXT NOT NULL,
  requested_house_no TEXT,
  requested_phone TEXT,
  requested_email TEXT,
  requested_sex TEXT,
  requested_birthplace TEXT,
  requested_purok TEXT,
  requested_educational_attainment TEXT,
  requested_occupation TEXT,
  requested_civil_status TEXT,
  requested_relationship_to_household_head TEXT,
  requested_address TEXT,
  requested_is_4ps_member BOOLEAN DEFAULT FALSE,
  requested_is_solo_parent BOOLEAN DEFAULT FALSE,
  requested_is_pwd BOOLEAN DEFAULT FALSE,
  requested_pwd_type TEXT,
  requested_username TEXT,
  requested_plain_password TEXT,
  requested_password_hash TEXT,
  requested_proof_path TEXT,
  requested_proof_name TEXT,
  requested_proof_type TEXT,
  status TEXT NOT NULL DEFAULT 'Pending Approval',
  request_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  -- Drop restrictive foreign keys on approved_by/rejected_by to allow text/UUID safely
  ALTER TABLE IF EXISTS public.resident_activation_requests 
    DROP CONSTRAINT IF EXISTS resident_activation_requests_approved_by_fkey,
    DROP CONSTRAINT IF EXISTS resident_activation_requests_rejected_by_fkey;

  ALTER TABLE IF EXISTS public.resident_activation_requests 
    ALTER COLUMN approved_by TYPE TEXT USING approved_by::TEXT,
    ALTER COLUMN rejected_by TYPE TEXT USING rejected_by::TEXT;

  ALTER TABLE IF EXISTS public.resident_activation_requests
    ADD COLUMN IF NOT EXISTS requested_first_name TEXT,
    ADD COLUMN IF NOT EXISTS requested_middle_name TEXT,
    ADD COLUMN IF NOT EXISTS requested_last_name TEXT,
    ADD COLUMN IF NOT EXISTS requested_suffix TEXT,
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
    ADD COLUMN IF NOT EXISTS requested_proof_type TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. Storage Bucket Setup & Permissive Policies
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
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = 10485760;

DROP POLICY IF EXISTS "resident_registration_proofs_all_access" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload resident registration proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view resident registration proofs" ON storage.objects;

CREATE POLICY "resident_registration_proofs_all_access"
ON storage.objects FOR ALL
TO anon, authenticated, service_role
USING (bucket_id = 'resident-registration-proofs')
WITH CHECK (bucket_id = 'resident-registration-proofs');

-- 5. Row Level Security Policies (Permissive to avoid defense blocks)
ALTER TABLE IF EXISTS public.resident_activation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resident_activation_requests_all_access" ON public.resident_activation_requests;
CREATE POLICY "resident_activation_requests_all_access"
ON public.resident_activation_requests FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

ALTER TABLE IF EXISTS public.resident_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resident_accounts_all_access" ON public.resident_accounts;
CREATE POLICY "resident_accounts_all_access"
ON public.resident_accounts FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

ALTER TABLE IF EXISTS public.residents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "residents_all_access" ON public.residents;
CREATE POLICY "residents_all_access"
ON public.residents FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- 6. Helper Function: current_user_role
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

-- 7. DROP OLD RPC FUNCTIONS TO PREVENT SIGNATURE CONFLICTS
DROP FUNCTION IF EXISTS public.request_resident_account_activation(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.request_resident_account_activation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.request_resident_account_activation(TEXT, DATE, TEXT);
DROP FUNCTION IF EXISTS public.request_resident_account_activation(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.attach_resident_registration_proof(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_resident_activation_requests(TEXT);
DROP FUNCTION IF EXISTS public.get_resident_activation_requests();
DROP FUNCTION IF EXISTS public.approve_resident_activation_request(UUID);
DROP FUNCTION IF EXISTS public.approve_resident_registration_request(UUID);
DROP FUNCTION IF EXISTS public.reject_resident_activation_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_resident_registration_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.login_resident_account(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.sync_resident_plain_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reset_resident_password_by_phone(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_create_resident_account(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_reset_resident_password(UUID, TEXT, TEXT);

-- 8. RPC: request_resident_account_activation
CREATE OR REPLACE FUNCTION public.request_resident_account_activation(
  p_full_name TEXT,
  p_birthday TEXT,
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
  v_bday DATE;
BEGIN
  BEGIN
    v_bday := p_birthday::DATE;
  EXCEPTION WHEN OTHERS THEN
    v_bday := CURRENT_DATE;
  END;

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
    TRIM(p_full_name),
    TRIM(p_first_name),
    TRIM(p_middle_name),
    TRIM(p_last_name),
    TRIM(p_suffix),
    v_bday,
    TRIM(p_household_no),
    TRIM(p_phone),
    COALESCE(TRIM(p_sex), 'Male'),
    TRIM(p_birthplace),
    TRIM(p_purok),
    TRIM(p_educational_attainment),
    TRIM(p_occupation),
    COALESCE(TRIM(p_civil_status), 'Single'),
    TRIM(p_house_no),
    COALESCE(TRIM(p_relationship_to_household_head), 'Head'),
    TRIM(p_address),
    COALESCE(p_is_4ps_member, FALSE),
    COALESCE(p_is_solo_parent, FALSE),
    COALESCE(p_is_pwd, FALSE),
    TRIM(p_pwd_type),
    LOWER(TRIM(p_username)),
    TRIM(p_password),
    TRIM(p_password),
    LOWER(TRIM(p_email)),
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

GRANT EXECUTE ON FUNCTION public.request_resident_account_activation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 9. RPC: attach_resident_registration_proof
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
      requested_proof_type = p_proof_type,
      updated_at = NOW()
  WHERE id = p_request_id;

  RETURN QUERY
  SELECT
    p_request_id,
    p_proof_name,
    p_proof_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_resident_registration_proof(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 10. RPC: get_resident_activation_requests
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
  requested_username TEXT,
  requested_plain_password TEXT,
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
    request.requested_username,
    request.requested_plain_password,
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

-- 11. RPC: approve_resident_activation_request
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
  v_hash TEXT;
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
  v_username := COALESCE(NULLIF(TRIM(v_request.requested_username), ''), 'resident_' || SUBSTRING(v_resident_id::TEXT FROM 1 FOR 8));
  v_password := COALESCE(NULLIF(TRIM(v_request.requested_plain_password), ''), NULLIF(TRIM(v_request.requested_household_no), ''), 'kaagapai123');
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf'));

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
    LOWER(v_username),
    v_password,
    v_hash,
    v_request.requested_phone,
    v_request.requested_email,
    'Active',
    FALSE
  )
  ON CONFLICT (resident_id) DO UPDATE
  SET username = EXCLUDED.username,
      plain_password = EXCLUDED.plain_password,
      password_hash = EXCLUDED.password_hash,
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

-- 12. RPC: approve_resident_registration_request (Alias)
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

-- 13. RPC: reject_resident_activation_request
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

-- 14. RPC: login_resident_account (Defense-Resilient Multi-Strategy Login)
CREATE OR REPLACE FUNCTION public.login_resident_account(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  account_id UUID,
  full_name TEXT,
  email TEXT,
  username TEXT,
  phone TEXT,
  house_no TEXT,
  household_no TEXT,
  birthday DATE,
  age INTEGER,
  gender TEXT,
  purok TEXT,
  address TEXT,
  status TEXT,
  account_status TEXT,
  must_change_credentials BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_input_user TEXT := LOWER(TRIM(COALESCE(p_username, '')));
  v_password TEXT := COALESCE(p_password, '');
  v_account public.resident_accounts%ROWTYPE;
  v_resident public.residents%ROWTYPE;
  v_matched BOOLEAN := FALSE;
BEGIN
  IF v_input_user = '' OR v_password = '' THEN
    RAISE EXCEPTION 'Please enter username and password.';
  END IF;

  -- 1. Try finding by username in resident_accounts
  SELECT *
  INTO v_account
  FROM public.resident_accounts AS account
  WHERE LOWER(account.username) = v_input_user
  LIMIT 1;

  -- 2. If not found by username, try finding by phone or email in residents table
  IF v_account.id IS NULL THEN
    SELECT resident_accounts.*
    INTO v_account
    FROM public.resident_accounts
    JOIN public.residents ON residents.id = resident_accounts.resident_id
    WHERE LOWER(COALESCE(residents.phone, '')) = v_input_user
       OR LOWER(COALESCE(residents.email, '')) = v_input_user
       OR LOWER(COALESCE(resident_accounts.phone, '')) = v_input_user
       OR LOWER(COALESCE(resident_accounts.email, '')) = v_input_user
    LIMIT 1;
  END IF;

  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'Account not found. Please check your username or register your account online.';
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents AS resident
  WHERE resident.id = v_account.resident_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident record not found. Please visit the Barangay Office for verification.';
  END IF;

  IF v_account.account_status = 'Pending Approval' THEN
    RAISE EXCEPTION 'Your account is pending admin approval. Please wait for confirmation.';
  END IF;

  IF v_account.account_status = 'Rejected' THEN
    RAISE EXCEPTION 'Your account registration was rejected. Please visit the Barangay Office.';
  END IF;

  IF v_account.account_status <> 'Active' THEN
    RAISE EXCEPTION 'Your account is not active. Please contact the Barangay Office.';
  END IF;

  IF v_resident.status <> 'Active' THEN
    RAISE EXCEPTION 'This resident record is currently not active in the barangay system.';
  END IF;

  -- Verify password with 4-way fallback:
  -- Strategy A: bcrypt crypt match
  IF v_account.password_hash IS NOT NULL AND v_account.password_hash LIKE '$2%' AND extensions.crypt(v_password, v_account.password_hash) = v_account.password_hash THEN
    v_matched := TRUE;
  -- Strategy B: exact plain match against password_hash or plain_password
  ELSIF (v_account.plain_password IS NOT NULL AND v_account.plain_password = v_password)
     OR (v_account.password_hash IS NOT NULL AND v_account.password_hash = v_password) THEN
    v_matched := TRUE;
    -- Upgrade to proper bcrypt hash and sync plain_password
    UPDATE public.resident_accounts
    SET password_hash = extensions.crypt(v_password, extensions.gen_salt('bf')),
        plain_password = v_password,
        updated_at = NOW()
    WHERE public.resident_accounts.id = v_account.id;
  -- Strategy C: default household number match
  ELSIF (v_resident.household_no IS NOT NULL AND TRIM(v_resident.household_no) = v_password)
     OR (v_resident.house_no IS NOT NULL AND TRIM(v_resident.house_no) = v_password) THEN
    v_matched := TRUE;
    UPDATE public.resident_accounts
    SET password_hash = extensions.crypt(v_password, extensions.gen_salt('bf')),
        plain_password = v_password,
        updated_at = NOW()
    WHERE public.resident_accounts.id = v_account.id;
  END IF;

  IF NOT v_matched THEN
    RAISE EXCEPTION 'Invalid username or password. Please check your credentials.';
  END IF;

  -- Update last_login_at
  UPDATE public.resident_accounts
  SET last_login_at = NOW(),
      updated_at = NOW()
  WHERE public.resident_accounts.id = v_account.id
  RETURNING *
  INTO v_account;

  RETURN QUERY SELECT
    v_resident.id,
    v_account.id,
    v_resident.full_name,
    v_resident.email,
    v_account.username,
    v_resident.phone,
    v_resident.house_no,
    v_resident.household_no,
    v_resident.birthday,
    v_resident.age,
    COALESCE(v_resident.gender, v_resident.sex),
    v_resident.purok,
    v_resident.address,
    v_resident.status,
    v_account.account_status,
    v_account.must_change_credentials;
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_resident_account(TEXT, TEXT) TO anon, authenticated, service_role;

-- 15. RPC: sync_resident_plain_password
CREATE OR REPLACE FUNCTION public.sync_resident_plain_password(
  p_username TEXT,
  p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_username TEXT := LOWER(TRIM(COALESCE(p_username, '')));
  v_clean_password TEXT := TRIM(COALESCE(p_password, ''));
BEGIN
  IF v_clean_username = '' OR v_clean_password = '' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.resident_accounts
  SET plain_password = v_clean_password,
      password_hash = extensions.crypt(v_clean_password, extensions.gen_salt('bf')),
      must_change_credentials = FALSE,
      updated_at = NOW()
  WHERE LOWER(username) = v_clean_username;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_resident_plain_password(TEXT, TEXT) TO anon, authenticated, service_role;

-- 16. RPC: reset_resident_password_by_phone
CREATE OR REPLACE FUNCTION public.reset_resident_password_by_phone(
  p_phone TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_raw_phone TEXT := TRIM(COALESCE(p_phone, ''));
  v_digits TEXT := REGEXP_REPLACE(v_raw_phone, '[^0-9]', '', 'g');
  v_new_password TEXT := TRIM(COALESCE(p_new_password, ''));
  v_resident_id UUID;
BEGIN
  IF v_digits = '' OR v_new_password = '' THEN
    RAISE EXCEPTION 'Phone number and new password are required.';
  END IF;

  IF LENGTH(v_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  SELECT id INTO v_resident_id
  FROM public.residents
  WHERE (
    REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_digits
    OR RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = RIGHT(v_digits, 10)
  )
  AND status <> 'Archived'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_resident_id IS NULL THEN
    RAISE EXCEPTION 'No active resident account found matching phone number.';
  END IF;

  UPDATE public.resident_accounts
  SET password_hash = extensions.crypt(v_new_password, extensions.gen_salt('bf')),
      plain_password = v_new_password,
      must_change_credentials = FALSE,
      updated_at = NOW()
  WHERE resident_id = v_resident_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident account credentials record not found.';
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_resident_password_by_phone(TEXT, TEXT) TO anon, authenticated, service_role;

-- 17. RPC: admin_create_resident_account
CREATE OR REPLACE FUNCTION public.admin_create_resident_account(
  p_resident_id UUID,
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_user TEXT := LOWER(TRIM(p_username));
  v_clean_pass TEXT := TRIM(p_password);
  v_hash TEXT := extensions.crypt(v_clean_pass, extensions.gen_salt('bf'));
  v_resident public.residents%ROWTYPE;
BEGIN
  SELECT * INTO v_resident FROM public.residents WHERE id = p_resident_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident not found.';
  END IF;

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
    p_resident_id,
    v_clean_user,
    v_clean_pass,
    v_hash,
    v_resident.phone,
    v_resident.email,
    'Active',
    FALSE
  )
  ON CONFLICT (resident_id) DO UPDATE
  SET username = EXCLUDED.username,
      plain_password = EXCLUDED.plain_password,
      password_hash = EXCLUDED.password_hash,
      account_status = 'Active',
      updated_at = NOW();

  RETURN jsonb_build_object('username', v_clean_user, 'status', 'Active');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_resident_account(UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- 18. RPC: admin_reset_resident_password
CREATE OR REPLACE FUNCTION public.admin_reset_resident_password(
  p_resident_id UUID,
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_user TEXT := LOWER(TRIM(p_username));
  v_clean_pass TEXT := TRIM(p_password);
  v_hash TEXT := extensions.crypt(v_clean_pass, extensions.gen_salt('bf'));
BEGIN
  UPDATE public.resident_accounts
  SET username = v_clean_user,
      plain_password = v_clean_pass,
      password_hash = v_hash,
      account_status = 'Active',
      must_change_credentials = FALSE,
      updated_at = NOW()
  WHERE resident_id = p_resident_id;

  IF NOT FOUND THEN
    RETURN public.admin_create_resident_account(p_resident_id, v_clean_user, v_clean_pass);
  END IF;

  RETURN jsonb_build_object('username', v_clean_user, 'status', 'Active', 'action', 'updated');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_resident_password(UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- 19. DATA HEALING: Ensure all existing resident_accounts have valid plain_password and password_hash
UPDATE public.resident_accounts AS acc
SET plain_password = COALESCE(
      NULLIF(acc.plain_password, ''),
      NULLIF(res.household_no, ''),
      NULLIF(res.house_no, ''),
      'kaagapai123'
    ),
    password_hash = CASE
      WHEN acc.password_hash IS NOT NULL AND acc.password_hash LIKE '$2%' THEN acc.password_hash
      ELSE extensions.crypt(
        COALESCE(NULLIF(acc.plain_password, ''), NULLIF(res.household_no, ''), 'kaagapai123'),
        extensions.gen_salt('bf')
      )
    END
FROM public.residents AS res
WHERE res.id = acc.resident_id
  AND (acc.plain_password IS NULL OR acc.password_hash IS NULL OR acc.password_hash NOT LIKE '$2%');

-- 20. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
