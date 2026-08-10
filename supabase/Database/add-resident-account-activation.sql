-- Resident account activation workflow.
-- Run this in the Supabase SQL Editor after setup-supabase.sql.
-- This keeps existing resident records intact and moves resident portal access
-- from Gmail/email + house number to username + password.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.resident_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  account_status TEXT NOT NULL DEFAULT 'Active',
  must_change_credentials BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resident_activation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  requested_full_name TEXT NOT NULL,
  requested_birthday DATE NOT NULL,
  requested_household_no TEXT NOT NULL,
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

ALTER TABLE public.resident_accounts
ADD COLUMN IF NOT EXISTS must_change_credentials BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.resident_accounts
ALTER COLUMN must_change_credentials SET DEFAULT FALSE;

ALTER TABLE public.resident_accounts
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_full_name TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_birthday DATE;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_household_no TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_accounts_resident_unique
ON public.resident_accounts(resident_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_accounts_username_unique
ON public.resident_accounts(LOWER(username));

CREATE INDEX IF NOT EXISTS idx_resident_accounts_status
ON public.resident_accounts(account_status);

CREATE INDEX IF NOT EXISTS idx_resident_activation_requests_resident_id
ON public.resident_activation_requests(resident_id);

CREATE INDEX IF NOT EXISTS idx_resident_activation_requests_status
ON public.resident_activation_requests(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_activation_requests_one_pending
ON public.resident_activation_requests(resident_id)
WHERE status = 'Pending Approval';

CREATE OR REPLACE FUNCTION public.normalize_resident_claim(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(LOWER(COALESCE(value, '')), '[^a-z0-9]', '', 'g')
$$;

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

CREATE OR REPLACE FUNCTION public.is_strong_resident_password(value TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    LENGTH(COALESCE(value, '')) >= 8
    AND COALESCE(value, '') ~ '[A-Z]'
    AND COALESCE(value, '') ~ '[a-z]'
    AND COALESCE(value, '') ~ '[0-9]'
$$;

CREATE OR REPLACE FUNCTION public.generate_resident_username(p_resident_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_resident public.residents%ROWTYPE;
  v_base TEXT;
  v_candidate TEXT;
  v_counter INTEGER := 1;
BEGIN
  SELECT *
  INTO v_resident
  FROM public.residents
  WHERE id = p_resident_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident record not found.';
  END IF;

  v_base := public.normalize_resident_username(
    CONCAT_WS(
      '',
      NULLIF(TRIM(COALESCE(v_resident.first_name, '')), ''),
      NULLIF(TRIM(COALESCE(v_resident.last_name, '')), '')
    )
  );

  IF v_base = '' THEN
    v_base := public.normalize_resident_username(v_resident.full_name);
  END IF;

  IF v_base = '' THEN
    v_base := 'resident' || SUBSTRING(v_resident.id::TEXT FROM 1 FOR 8);
  END IF;

  v_base := LEFT(v_base, 24);
  v_candidate := v_base;

  WHILE EXISTS (
    SELECT 1
    FROM public.resident_accounts
    WHERE LOWER(username) = LOWER(v_candidate)
  ) LOOP
    v_counter := v_counter + 1;
    v_candidate := LEFT(v_base, 24) || v_counter::TEXT;
  END LOOP;

  RETURN v_candidate;
END
$$;

CREATE OR REPLACE FUNCTION public.request_resident_account_activation(
  p_full_name TEXT,
  p_birthday DATE,
  p_household_no TEXT
)
RETURNS TABLE (
  activation_status TEXT,
  activation_message TEXT,
  request_id UUID,
  resident_id UUID,
  full_name TEXT,
  account_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_full_name TEXT := TRIM(COALESCE(p_full_name, ''));
  v_household_no TEXT := TRIM(COALESCE(p_household_no, ''));
  v_resident public.residents%ROWTYPE;
  v_account public.resident_accounts%ROWTYPE;
  v_request public.resident_activation_requests%ROWTYPE;
BEGIN
  IF v_full_name = '' OR p_birthday IS NULL OR v_household_no = '' THEN
    RAISE EXCEPTION 'Full name, birth date, and household number are required.';
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents AS resident
  WHERE resident.status = 'Active'
    AND public.normalize_resident_claim(
      COALESCE(
        NULLIF(TRIM(resident.full_name), ''),
        CONCAT_WS(' ', resident.first_name, resident.middle_name, resident.last_name)
      )
    ) = public.normalize_resident_claim(v_full_name)
    AND resident.birthday = p_birthday
    AND public.normalize_resident_claim(
      COALESCE(NULLIF(TRIM(resident.household_no), ''), NULLIF(TRIM(resident.house_no), ''))
    ) = public.normalize_resident_claim(v_household_no)
  ORDER BY resident.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'not_found'::TEXT,
      'Resident record not found. Please visit the Barangay Office for verification.'::TEXT,
      NULL::UUID,
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_account
  FROM public.resident_accounts AS account
  WHERE account.resident_id = v_resident.id
  LIMIT 1;

  IF FOUND AND v_account.account_status = 'Active' THEN
    RETURN QUERY SELECT
      'active'::TEXT,
      'An active resident account already exists. Please sign in with your username and password.'::TEXT,
      NULL::UUID,
      v_resident.id,
      v_resident.full_name,
      v_account.account_status;
    RETURN;
  END IF;

  SELECT *
  INTO v_request
  FROM public.resident_activation_requests AS request
  WHERE request.resident_id = v_resident.id
    AND request.status = 'Pending Approval'
  ORDER BY request.request_date DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      'pending'::TEXT,
      'Your account activation request is already pending admin approval.'::TEXT,
      v_request.id,
      v_resident.id,
      v_resident.full_name,
      'Pending Approval'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.resident_activation_requests (
    resident_id,
    requested_full_name,
    requested_birthday,
    requested_household_no,
    status
  )
  VALUES (
    v_resident.id,
    v_full_name,
    p_birthday,
    v_household_no,
    'Pending Approval'
  )
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    'pending'::TEXT,
    'Your account activation request was sent. Please wait for admin approval.'::TEXT,
    v_request.id,
    v_resident.id,
    v_resident.full_name,
    'Pending Approval'::TEXT;
END
$$;

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
  v_username TEXT := public.normalize_resident_username(p_username);
  v_password TEXT := COALESCE(p_password, '');
  v_account public.resident_accounts%ROWTYPE;
  v_resident public.residents%ROWTYPE;
BEGIN
  IF v_username = '' OR v_password = '' THEN
    RAISE EXCEPTION 'Please enter username and password.';
  END IF;

  SELECT *
  INTO v_account
  FROM public.resident_accounts AS account
  WHERE LOWER(account.username) = LOWER(v_username)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found. Check the username or activate your account first.';
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
    RAISE EXCEPTION 'Your account is pending admin approval.';
  END IF;

  IF v_account.account_status = 'Rejected' THEN
    RAISE EXCEPTION 'Your account activation was rejected. Please visit the Barangay Office for verification.';
  END IF;

  IF v_account.account_status = 'Inactive' THEN
    RAISE EXCEPTION 'Your account is inactive. Please contact the Barangay Office.';
  END IF;

  IF v_account.account_status <> 'Active' THEN
    RAISE EXCEPTION 'Your account is not active. Please contact the Barangay Office.';
  END IF;

  IF v_resident.status <> 'Active' THEN
    RAISE EXCEPTION 'This resident record is not active.';
  END IF;

  IF v_account.password_hash IS NULL OR crypt(v_password, v_account.password_hash) <> v_account.password_hash THEN
    RAISE EXCEPTION 'Invalid username or password.';
  END IF;

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
END
$$;

CREATE OR REPLACE FUNCTION public.update_resident_account_credentials(
  p_current_username TEXT,
  p_current_password TEXT,
  p_new_username TEXT,
  p_new_password TEXT
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
  v_current_username TEXT := public.normalize_resident_username(p_current_username);
  v_new_username TEXT := public.normalize_resident_username(p_new_username);
  v_current_password TEXT := COALESCE(p_current_password, '');
  v_new_password TEXT := COALESCE(p_new_password, '');
  v_account public.resident_accounts%ROWTYPE;
  v_resident public.residents%ROWTYPE;
BEGIN
  IF v_current_username = '' OR v_current_password = '' THEN
    RAISE EXCEPTION 'Current username and password are required.';
  END IF;

  IF v_new_username = '' OR LENGTH(v_new_username) < 4 OR LENGTH(v_new_username) > 30 THEN
    RAISE EXCEPTION 'Username must be 4 to 30 characters.';
  END IF;

  IF NOT public.is_strong_resident_password(v_new_password) THEN
    RAISE EXCEPTION 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';
  END IF;

  SELECT *
  INTO v_account
  FROM public.resident_accounts AS account
  WHERE LOWER(account.username) = LOWER(v_current_username)
  LIMIT 1;

  IF NOT FOUND OR crypt(v_current_password, v_account.password_hash) <> v_account.password_hash THEN
    RAISE EXCEPTION 'Current username or password is incorrect.';
  END IF;

  IF v_account.account_status <> 'Active' THEN
    RAISE EXCEPTION 'Only active resident accounts can update credentials.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.resident_accounts AS account
    WHERE LOWER(account.username) = LOWER(v_new_username)
      AND account.id <> v_account.id
  ) THEN
    RAISE EXCEPTION 'Username is already taken. Please choose another one.';
  END IF;

  UPDATE public.resident_accounts
  SET username = v_new_username,
      password_hash = crypt(v_new_password, gen_salt('bf')),
      must_change_credentials = FALSE,
      updated_at = NOW()
  WHERE public.resident_accounts.id = v_account.id
  RETURNING *
  INTO v_account;

  SELECT *
  INTO v_resident
  FROM public.residents
  WHERE public.residents.id = v_account.resident_id;

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
END
$$;

CREATE OR REPLACE FUNCTION public.get_resident_activation_requests(
  p_status_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  resident_id UUID,
  request_date TIMESTAMP WITH TIME ZONE,
  status TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
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
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can view resident activation requests.';
  END IF;

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
    resident.full_name,
    resident.birthday,
    COALESCE(NULLIF(TRIM(resident.household_no), ''), NULLIF(TRIM(resident.house_no), '')),
    resident.purok,
    resident.address,
    account.username,
    account.account_status
  FROM public.resident_activation_requests AS request
  JOIN public.residents AS resident ON resident.id = request.resident_id
  LEFT JOIN public.resident_accounts AS account ON account.resident_id = resident.id
  WHERE p_status_filter IS NULL OR p_status_filter = '' OR request.status = p_status_filter
  ORDER BY request.request_date DESC;
END
$$;

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

CREATE OR REPLACE FUNCTION public.reject_resident_activation_request(
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
  v_request public.resident_activation_requests%ROWTYPE;
  v_resident public.residents%ROWTYPE;
  v_reason TEXT := NULLIF(TRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can reject resident activation requests.';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Please provide a rejection reason.';
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
    RAISE EXCEPTION 'Only pending activation requests can be rejected.';
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents
  WHERE public.residents.id = v_request.resident_id;

  UPDATE public.resident_activation_requests
  SET status = 'Rejected',
      rejected_by = auth.uid(),
      rejected_at = NOW(),
      rejection_reason = v_reason,
      updated_at = NOW()
  WHERE public.resident_activation_requests.id = p_request_id
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    v_request.id,
    v_request.resident_id,
    COALESCE(v_resident.full_name, v_request.requested_full_name),
    v_request.status,
    v_request.rejection_reason;
END
$$;

ALTER TABLE public.resident_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_activation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read resident accounts" ON public.resident_accounts;
DROP POLICY IF EXISTS "Admins can read resident activation requests" ON public.resident_activation_requests;
DROP POLICY IF EXISTS "Admins can update resident activation requests" ON public.resident_activation_requests;

CREATE POLICY "Admins can read resident accounts"
ON public.resident_accounts FOR SELECT
USING (public.current_user_role() = 'admin');

CREATE POLICY "Admins can read resident activation requests"
ON public.resident_activation_requests FOR SELECT
USING (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update resident activation requests"
ON public.resident_activation_requests FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

GRANT EXECUTE ON FUNCTION public.normalize_resident_claim(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_resident_username(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_strong_resident_password(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_resident_username(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_resident_account_activation(TEXT, DATE, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.login_resident_account(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_resident_account_credentials(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_resident_activation_requests(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_resident_activation_request(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_resident_activation_request(UUID, TEXT) TO authenticated, service_role;

-- Backfill portal usernames for residents already created by the admin.
-- Temporary password is household_no, then house_no, then the first 8 characters of the resident ID.
-- Existing resident_accounts are left untouched.
DO $$
DECLARE
  resident_record RECORD;
  generated_username TEXT;
  temporary_password TEXT;
BEGIN
  FOR resident_record IN
    SELECT *
    FROM public.residents AS resident
    WHERE COALESCE(resident.status, 'Active') <> 'Archived'
      AND NOT EXISTS (
        SELECT 1
        FROM public.resident_accounts AS account
        WHERE account.resident_id = resident.id
      )
    ORDER BY resident.created_at ASC NULLS LAST, resident.full_name ASC NULLS LAST
  LOOP
    generated_username := public.generate_resident_username(resident_record.id);
    temporary_password := COALESCE(
      NULLIF(TRIM(resident_record.household_no), ''),
      NULLIF(TRIM(resident_record.house_no), ''),
      SUBSTRING(resident_record.id::TEXT FROM 1 FOR 8)
    );

    INSERT INTO public.resident_accounts (
      resident_id,
      username,
      password_hash,
      account_status,
      must_change_credentials
    )
    VALUES (
      resident_record.id,
      generated_username,
      crypt(temporary_password, gen_salt('bf')),
      CASE WHEN resident_record.status = 'Active' THEN 'Active' ELSE 'Inactive' END,
      FALSE
    );
  END LOOP;
END
$$;

-- Clear old fake resident Gmail/email values after portal usernames exist.
-- Resident login now uses resident_accounts.username.
UPDATE public.residents AS resident
SET email = NULL,
    updated_at = NOW()
WHERE NULLIF(TRIM(resident.email), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.resident_accounts AS account
    WHERE account.resident_id = resident.id
  );

NOTIFY pgrst, 'reload schema';
