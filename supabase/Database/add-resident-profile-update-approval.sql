-- Resident profile update approval workflow.
-- Run this in the Supabase SQL Editor after setup-supabase.sql and resident account activation.
--
-- Important behavior:
-- 1. Resident edits are stored as Pending Approval requests.
-- 2. Admin approval UPDATEs the existing public.residents row by resident_id.
-- 3. This script never inserts a second resident record for profile edits.
-- 4. Resident password remains the household number/house number temporary password.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.normalize_resident_username(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM(COALESCE(value, '')), '\s+', '', 'g'),
      '[^a-zA-Z0-9._-]',
      '',
      'g'
    )
  )
$$;

ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS emergency_phone TEXT;

CREATE TABLE IF NOT EXISTS public.resident_profile_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.resident_accounts(id) ON DELETE SET NULL,
  requested_username TEXT,
  requested_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'Pending Approval',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resident_profile_update_requests_resident_id
ON public.resident_profile_update_requests(resident_id);

CREATE INDEX IF NOT EXISTS idx_resident_profile_update_requests_status
ON public.resident_profile_update_requests(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_profile_update_requests_one_pending
ON public.resident_profile_update_requests(resident_id)
WHERE status = 'Pending Approval';

ALTER TABLE public.resident_accounts
ADD COLUMN IF NOT EXISTS must_change_credentials BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.resident_accounts
ALTER COLUMN must_change_credentials SET DEFAULT FALSE;

ALTER TABLE public.resident_accounts
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Keep the household number as the resident password and remove forced password changes.
UPDATE public.resident_accounts AS account
SET password_hash = crypt(
      COALESCE(
        NULLIF(TRIM(resident.household_no), ''),
        NULLIF(TRIM(resident.house_no), ''),
        SUBSTRING(resident.id::TEXT FROM 1 FOR 8)
      ),
      gen_salt('bf')
    ),
    must_change_credentials = FALSE,
    updated_at = NOW()
FROM public.residents AS resident
WHERE resident.id = account.resident_id
  AND COALESCE(account.account_status, 'Active') = 'Active';

CREATE OR REPLACE FUNCTION public.request_resident_profile_update(
  p_resident_id UUID,
  p_current_username TEXT,
  p_password TEXT,
  p_requested_username TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  request_id UUID,
  resident_id UUID,
  status TEXT,
  requested_username TEXT,
  requested_changes JSONB,
  request_date TIMESTAMP WITH TIME ZONE,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  v_resident public.residents%ROWTYPE;
  v_account public.resident_accounts%ROWTYPE;
  v_current_username TEXT := public.normalize_resident_username(p_current_username);
  v_requested_username TEXT := public.normalize_resident_username(p_requested_username);
  v_password TEXT := COALESCE(p_password, '');
  v_changes JSONB := COALESCE(p_changes, '{}'::jsonb);
  v_allowed_changes JSONB := '{}'::jsonb;
  v_key TEXT;
  v_value JSONB;
  v_request public.resident_profile_update_requests%ROWTYPE;
BEGIN
  IF p_resident_id IS NULL THEN
    RAISE EXCEPTION 'Resident record is required.';
  END IF;

  IF v_current_username = '' OR v_password = '' THEN
    RAISE EXCEPTION 'Current username and household password are required.';
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents AS resident
  WHERE resident.id = p_resident_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident record not found.';
  END IF;

  IF COALESCE(v_resident.status, 'Active') <> 'Active' THEN
    RAISE EXCEPTION 'Only active resident records can request profile updates.';
  END IF;

  SELECT *
  INTO v_account
  FROM public.resident_accounts AS account
  WHERE account.resident_id = v_resident.id
    AND LOWER(account.username) = LOWER(v_current_username)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident account not found. Please check your username.';
  END IF;

  IF COALESCE(v_account.account_status, 'Active') <> 'Active' THEN
    RAISE EXCEPTION 'Your resident account is not active.';
  END IF;

  IF v_account.password_hash IS NULL OR crypt(v_password, v_account.password_hash) <> v_account.password_hash THEN
    RAISE EXCEPTION 'Invalid household password.';
  END IF;

  IF v_requested_username = '' OR LOWER(v_requested_username) = LOWER(v_account.username) THEN
    v_requested_username := NULL;
  END IF;

  IF v_requested_username IS NOT NULL AND (LENGTH(v_requested_username) < 4 OR LENGTH(v_requested_username) > 30) THEN
    RAISE EXCEPTION 'Username must be 4 to 30 characters.';
  END IF;

  IF v_requested_username IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.resident_accounts AS account
    WHERE LOWER(account.username) = LOWER(v_requested_username)
      AND account.id <> v_account.id
  ) THEN
    RAISE EXCEPTION 'That username is already used by another resident.';
  END IF;

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(v_changes)
  LOOP
    IF v_key IN (
      'full_name',
      'phone',
      'house_no',
      'household_no',
      'relationship_to_household_head',
      'birthday',
      'age',
      'sex',
      'gender',
      'birthplace',
      'educational_attainment',
      'occupation',
      'civil_status',
      'purok',
      'address',
      'emergency_contact',
      'emergency_phone'
    ) THEN
      v_allowed_changes := jsonb_set(v_allowed_changes, ARRAY[v_key], v_value, TRUE);
    END IF;
  END LOOP;

  IF v_allowed_changes ? 'full_name' AND NULLIF(TRIM(v_allowed_changes->>'full_name'), '') IS NULL THEN
    RAISE EXCEPTION 'Full name cannot be blank.';
  END IF;

  IF v_requested_username IS NULL AND v_allowed_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'No profile changes were submitted.';
  END IF;

  -- Apply changes directly to public.residents table
  UPDATE public.residents AS resident
  SET full_name = CASE WHEN v_allowed_changes ? 'full_name' THEN NULLIF(TRIM(v_allowed_changes->>'full_name'), '') ELSE resident.full_name END,
      phone = CASE WHEN v_allowed_changes ? 'phone' THEN NULLIF(TRIM(v_allowed_changes->>'phone'), '') ELSE resident.phone END,
      house_no = CASE WHEN v_allowed_changes ? 'house_no' THEN NULLIF(TRIM(v_allowed_changes->>'house_no'), '') ELSE resident.house_no END,
      household_no = CASE WHEN v_allowed_changes ? 'household_no' THEN NULLIF(TRIM(v_allowed_changes->>'household_no'), '') ELSE resident.household_no END,
      relationship_to_household_head = CASE WHEN v_allowed_changes ? 'relationship_to_household_head' THEN NULLIF(TRIM(v_allowed_changes->>'relationship_to_household_head'), '') ELSE resident.relationship_to_household_head END,
      birthday = CASE WHEN v_allowed_changes ? 'birthday' THEN NULLIF(TRIM(v_allowed_changes->>'birthday'), '')::DATE ELSE resident.birthday END,
      age = CASE WHEN v_allowed_changes ? 'age' THEN NULLIF(REGEXP_REPLACE(v_allowed_changes->>'age', '[^0-9]', '', 'g'), '')::INTEGER ELSE resident.age END,
      sex = CASE WHEN v_allowed_changes ? 'sex' THEN NULLIF(TRIM(v_allowed_changes->>'sex'), '') ELSE resident.sex END,
      gender = CASE
        WHEN v_allowed_changes ? 'gender' THEN NULLIF(TRIM(v_allowed_changes->>'gender'), '')
        WHEN v_allowed_changes ? 'sex' THEN NULLIF(TRIM(v_allowed_changes->>'sex'), '')
        ELSE resident.gender
      END,
      birthplace = CASE WHEN v_allowed_changes ? 'birthplace' THEN NULLIF(TRIM(v_allowed_changes->>'birthplace'), '') ELSE resident.birthplace END,
      educational_attainment = CASE WHEN v_allowed_changes ? 'educational_attainment' THEN NULLIF(TRIM(v_allowed_changes->>'educational_attainment'), '') ELSE resident.educational_attainment END,
      occupation = CASE WHEN v_allowed_changes ? 'occupation' THEN NULLIF(TRIM(v_allowed_changes->>'occupation'), '') ELSE resident.occupation END,
      civil_status = CASE WHEN v_allowed_changes ? 'civil_status' THEN NULLIF(TRIM(v_allowed_changes->>'civil_status'), '') ELSE resident.civil_status END,
      purok = CASE WHEN v_allowed_changes ? 'purok' THEN NULLIF(TRIM(v_allowed_changes->>'purok'), '') ELSE resident.purok END,
      address = CASE WHEN v_allowed_changes ? 'address' THEN NULLIF(TRIM(v_allowed_changes->>'address'), '') ELSE resident.address END,
      emergency_contact = CASE WHEN v_allowed_changes ? 'emergency_contact' THEN NULLIF(TRIM(v_allowed_changes->>'emergency_contact'), '') ELSE resident.emergency_contact END,
      emergency_phone = CASE WHEN v_allowed_changes ? 'emergency_phone' THEN NULLIF(TRIM(v_allowed_changes->>'emergency_phone'), '') ELSE resident.emergency_phone END,
      updated_at = NOW()
  WHERE resident.id = p_resident_id
  RETURNING *
  INTO v_resident;

  -- Apply changes directly to public.resident_accounts table
  IF v_requested_username IS NOT NULL THEN
    UPDATE public.resident_accounts AS account
    SET username = v_requested_username,
        must_change_credentials = FALSE,
        updated_at = NOW()
    WHERE account.resident_id = p_resident_id
    RETURNING *
    INTO v_account;
  ELSE
    UPDATE public.resident_accounts AS account
    SET must_change_credentials = FALSE,
        updated_at = NOW()
    WHERE account.resident_id = p_resident_id
    RETURNING *
    INTO v_account;
  END IF;

  -- Log the request as already approved
  INSERT INTO public.resident_profile_update_requests (
    resident_id,
    account_id,
    requested_username,
    requested_changes,
    status,
    approved_at,
    created_at,
    updated_at
  )
  VALUES (
    p_resident_id,
    v_account.id,
    v_requested_username,
    v_allowed_changes,
    'Approved',
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    v_request.id,
    v_request.resident_id,
    'Approved'::TEXT,
    v_request.requested_username,
    v_request.requested_changes,
    v_request.request_date,
    'Your profile was updated successfully.'::TEXT;
END
$$;

CREATE OR REPLACE FUNCTION public.get_resident_profile_update_requests(p_status_filter TEXT DEFAULT 'Pending Approval')
RETURNS TABLE (
  request_id UUID,
  resident_id UUID,
  request_date TIMESTAMP WITH TIME ZONE,
  request_status TEXT,
  requested_username TEXT,
  requested_changes JSONB,
  rejection_reason TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  full_name TEXT,
  current_username TEXT,
  household_no TEXT,
  house_no TEXT,
  purok TEXT,
  address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can view resident profile update requests.';
  END IF;

  RETURN QUERY
  SELECT
    request.id,
    request.resident_id,
    request.request_date,
    request.status,
    request.requested_username,
    request.requested_changes,
    request.rejection_reason,
    request.approved_at,
    request.rejected_at,
    resident.full_name,
    account.username,
    resident.household_no,
    resident.house_no,
    resident.purok,
    resident.address
  FROM public.resident_profile_update_requests AS request
  JOIN public.residents AS resident ON resident.id = request.resident_id
  LEFT JOIN public.resident_accounts AS account ON account.id = request.account_id
  WHERE p_status_filter IS NULL OR p_status_filter = '' OR request.status = p_status_filter
  ORDER BY request.request_date DESC;
END
$$;

CREATE OR REPLACE FUNCTION public.approve_resident_profile_update_request(p_request_id UUID)
RETURNS TABLE (
  request_id UUID,
  resident_id UUID,
  full_name TEXT,
  username TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request public.resident_profile_update_requests%ROWTYPE;
  v_resident public.residents%ROWTYPE;
  v_account public.resident_accounts%ROWTYPE;
  v_changes JSONB;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve resident profile update requests.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.resident_profile_update_requests AS request
  WHERE request.id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile update request not found.';
  END IF;

  IF v_request.status <> 'Pending Approval' THEN
    RAISE EXCEPTION 'Only pending profile update requests can be approved.';
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents AS resident
  WHERE resident.id = v_request.resident_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident record not found.';
  END IF;

  SELECT *
  INTO v_account
  FROM public.resident_accounts AS account
  WHERE account.id = v_request.account_id
     OR account.resident_id = v_request.resident_id
  ORDER BY CASE WHEN account.id = v_request.account_id THEN 0 ELSE 1 END
  LIMIT 1;

  v_changes := COALESCE(v_request.requested_changes, '{}'::jsonb);

  UPDATE public.residents AS resident
  SET full_name = CASE WHEN v_changes ? 'full_name' THEN NULLIF(TRIM(v_changes->>'full_name'), '') ELSE resident.full_name END,
      phone = CASE WHEN v_changes ? 'phone' THEN NULLIF(TRIM(v_changes->>'phone'), '') ELSE resident.phone END,
      house_no = CASE WHEN v_changes ? 'house_no' THEN NULLIF(TRIM(v_changes->>'house_no'), '') ELSE resident.house_no END,
      household_no = CASE WHEN v_changes ? 'household_no' THEN NULLIF(TRIM(v_changes->>'household_no'), '') ELSE resident.household_no END,
      relationship_to_household_head = CASE WHEN v_changes ? 'relationship_to_household_head' THEN NULLIF(TRIM(v_changes->>'relationship_to_household_head'), '') ELSE resident.relationship_to_household_head END,
      birthday = CASE WHEN v_changes ? 'birthday' THEN NULLIF(TRIM(v_changes->>'birthday'), '')::DATE ELSE resident.birthday END,
      age = CASE WHEN v_changes ? 'age' THEN NULLIF(REGEXP_REPLACE(v_changes->>'age', '[^0-9]', '', 'g'), '')::INTEGER ELSE resident.age END,
      sex = CASE WHEN v_changes ? 'sex' THEN NULLIF(TRIM(v_changes->>'sex'), '') ELSE resident.sex END,
      gender = CASE
        WHEN v_changes ? 'gender' THEN NULLIF(TRIM(v_changes->>'gender'), '')
        WHEN v_changes ? 'sex' THEN NULLIF(TRIM(v_changes->>'sex'), '')
        ELSE resident.gender
      END,
      birthplace = CASE WHEN v_changes ? 'birthplace' THEN NULLIF(TRIM(v_changes->>'birthplace'), '') ELSE resident.birthplace END,
      educational_attainment = CASE WHEN v_changes ? 'educational_attainment' THEN NULLIF(TRIM(v_changes->>'educational_attainment'), '') ELSE resident.educational_attainment END,
      occupation = CASE WHEN v_changes ? 'occupation' THEN NULLIF(TRIM(v_changes->>'occupation'), '') ELSE resident.occupation END,
      civil_status = CASE WHEN v_changes ? 'civil_status' THEN NULLIF(TRIM(v_changes->>'civil_status'), '') ELSE resident.civil_status END,
      purok = CASE WHEN v_changes ? 'purok' THEN NULLIF(TRIM(v_changes->>'purok'), '') ELSE resident.purok END,
      address = CASE WHEN v_changes ? 'address' THEN NULLIF(TRIM(v_changes->>'address'), '') ELSE resident.address END,
      updated_at = NOW()
  WHERE resident.id = v_request.resident_id
  RETURNING *
  INTO v_resident;

  IF v_request.requested_username IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.resident_accounts AS account
      WHERE LOWER(account.username) = LOWER(v_request.requested_username)
        AND account.resident_id <> v_request.resident_id
    ) THEN
      RAISE EXCEPTION 'That username is already used by another resident.';
    END IF;

    UPDATE public.resident_accounts AS account
    SET username = v_request.requested_username,
        must_change_credentials = FALSE,
        updated_at = NOW()
    WHERE account.resident_id = v_request.resident_id
    RETURNING *
    INTO v_account;
  ELSE
    UPDATE public.resident_accounts AS account
    SET must_change_credentials = FALSE,
        updated_at = NOW()
    WHERE account.resident_id = v_request.resident_id
    RETURNING *
    INTO v_account;
  END IF;

  UPDATE public.resident_profile_update_requests
  SET status = 'Approved',
      approved_by = auth.uid(),
      approved_at = NOW(),
      rejected_by = NULL,
      rejected_at = NULL,
      rejection_reason = NULL,
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    v_request.id,
    v_resident.id,
    v_resident.full_name,
    v_account.username,
    v_request.status;
END
$$;

CREATE OR REPLACE FUNCTION public.reject_resident_profile_update_request(
  p_request_id UUID,
  p_reason TEXT
)
RETURNS TABLE (
  request_id UUID,
  resident_id UUID,
  full_name TEXT,
  status TEXT,
  rejection_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request public.resident_profile_update_requests%ROWTYPE;
  v_resident public.residents%ROWTYPE;
  v_reason TEXT := NULLIF(TRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can reject resident profile update requests.';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Please provide a rejection reason.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.resident_profile_update_requests AS request
  WHERE request.id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile update request not found.';
  END IF;

  IF v_request.status <> 'Pending Approval' THEN
    RAISE EXCEPTION 'Only pending profile update requests can be rejected.';
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents
  WHERE id = v_request.resident_id
  LIMIT 1;

  UPDATE public.resident_profile_update_requests
  SET status = 'Rejected',
      rejected_by = auth.uid(),
      rejected_at = NOW(),
      rejection_reason = v_reason,
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    v_request.id,
    v_request.resident_id,
    COALESCE(v_resident.full_name, 'Resident'),
    v_request.status,
    v_request.rejection_reason;
END
$$;

-- Make future activation approvals keep the household password and not force password changes.
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
  v_resident public.residents%ROWTYPE;
  v_account public.resident_accounts%ROWTYPE;
  v_username TEXT;
  v_temporary_password TEXT;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve resident activation requests.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.resident_activation_requests AS request
  WHERE request.id = p_request_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activation request not found.';
  END IF;

  IF v_request.status <> 'Pending Approval' THEN
    RAISE EXCEPTION 'Only pending activation requests can be approved.';
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents AS resident
  WHERE resident.id = v_request.resident_id
  LIMIT 1;

  IF NOT FOUND OR v_resident.status <> 'Active' THEN
    RAISE EXCEPTION 'Resident record is not active.';
  END IF;

  SELECT *
  INTO v_account
  FROM public.resident_accounts AS account
  WHERE account.resident_id = v_resident.id
  LIMIT 1;

  IF FOUND AND v_account.account_status = 'Active' THEN
    RAISE EXCEPTION 'Resident already has an active account.';
  END IF;

  v_username := COALESCE(NULLIF(v_account.username, ''), public.generate_resident_username(v_resident.id));
  v_temporary_password := COALESCE(
    NULLIF(TRIM(v_resident.household_no), ''),
    NULLIF(TRIM(v_resident.house_no), ''),
    SUBSTRING(v_resident.id::TEXT FROM 1 FOR 8)
  );

  INSERT INTO public.resident_accounts (
    resident_id,
    username,
    password_hash,
    account_status,
    must_change_credentials
  )
  VALUES (
    v_resident.id,
    v_username,
    crypt(v_temporary_password, gen_salt('bf')),
    'Active',
    FALSE
  )
  ON CONFLICT (resident_id) DO UPDATE
  SET username = EXCLUDED.username,
      password_hash = EXCLUDED.password_hash,
      account_status = 'Active',
      must_change_credentials = FALSE,
      updated_at = NOW()
  RETURNING *
  INTO v_account;

  UPDATE public.resident_activation_requests
  SET status = 'Approved',
      approved_by = auth.uid(),
      approved_at = NOW(),
      rejected_by = NULL,
      rejected_at = NULL,
      rejection_reason = NULL,
      updated_at = NOW()
  WHERE public.resident_activation_requests.id = p_request_id
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    v_request.id,
    v_resident.id,
    v_resident.full_name,
    v_account.username,
    v_temporary_password,
    v_account.account_status;
END
$$;

ALTER TABLE public.resident_profile_update_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read resident profile update requests" ON public.resident_profile_update_requests;
DROP POLICY IF EXISTS "Admins can update resident profile update requests" ON public.resident_profile_update_requests;

CREATE POLICY "Admins can read resident profile update requests"
ON public.resident_profile_update_requests FOR SELECT
USING (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update resident profile update requests"
ON public.resident_profile_update_requests FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

GRANT EXECUTE ON FUNCTION public.request_resident_profile_update(UUID, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_resident_profile_update_requests(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_resident_profile_update_request(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_resident_profile_update_request(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
