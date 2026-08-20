-- ====================================================================
-- FIX RESIDENT FORGOT PASSWORD & PASSWORD SYNC MIGRATION
-- Run this in your Supabase SQL Editor.
-- ====================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Ensure plain_password column exists on resident_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resident_accounts'
      AND column_name = 'plain_password'
  ) THEN
    ALTER TABLE public.resident_accounts
      ADD COLUMN plain_password TEXT DEFAULT NULL;
  END IF;
END $$;

-- 2. CREATE / REPLACE RPC: sync_resident_plain_password
-- Updates BOTH plain_password AND password_hash so old passwords are immediately invalidated
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

-- 3. CREATE / REPLACE RPC: reset_resident_password_by_phone
-- Called when a resident completes the SMS OTP verification flow
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
  v_account_id UUID;
BEGIN
  IF v_digits = '' OR v_new_password = '' THEN
    RAISE EXCEPTION 'Phone number and new password are required.';
  END IF;

  IF LENGTH(v_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  -- Match resident by phone across common formats (+63, 09, 9)
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

  -- Update resident account password hash and plain password
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

-- 4. UPDATE RPC: login_resident_account
-- Checks crypt hash, and auto-syncs if plain_password matches
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
  v_username TEXT := LOWER(TRIM(COALESCE(p_username, '')));
  v_password TEXT := COALESCE(p_password, '');
  v_account public.resident_accounts%ROWTYPE;
  v_resident public.residents%ROWTYPE;
  v_matched BOOLEAN := FALSE;
BEGIN
  IF v_username = '' OR v_password = '' THEN
    RAISE EXCEPTION 'Please enter username and password.';
  END IF;

  SELECT *
  INTO v_account
  FROM public.resident_accounts AS account
  WHERE LOWER(account.username) = v_username
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

  IF v_account.account_status <> 'Active' THEN
    RAISE EXCEPTION 'Your account is not active. Please contact the Barangay Office.';
  END IF;

  IF v_resident.status <> 'Active' THEN
    RAISE EXCEPTION 'This resident record is not active.';
  END IF;

  -- 1. Check primary password hash
  IF v_account.password_hash IS NOT NULL AND extensions.crypt(v_password, v_account.password_hash) = v_account.password_hash THEN
    v_matched := TRUE;
  -- 2. Fallback check: plain_password (and immediately heal password_hash)
  ELSIF v_account.plain_password IS NOT NULL AND v_account.plain_password = v_password THEN
    v_matched := TRUE;
    UPDATE public.resident_accounts
    SET password_hash = extensions.crypt(v_password, extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE public.resident_accounts.id = v_account.id;
  END IF;

  IF NOT v_matched THEN
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_resident_account(TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
