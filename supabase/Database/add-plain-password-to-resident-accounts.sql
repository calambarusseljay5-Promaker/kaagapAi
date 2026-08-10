-- Safe, Idempotent Additive Migration Script
-- Run this in the Supabase SQL Editor.
-- This ensures that when residents or admins update usernames/passwords,
-- plain_password is automatically updated and synced in PostgreSQL,
-- allowing Admin to view and retrieve the active password in Edit Resident modal.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = public, extensions;

-- 1. Add plain_password column to resident_accounts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resident_accounts'
      AND column_name = 'plain_password'
  ) THEN
    ALTER TABLE public.resident_accounts
      ADD COLUMN plain_password text DEFAULT NULL;
  END IF;
END $$;

-- 2. Populate plain_password for existing accounts where plain_password IS NULL
UPDATE public.resident_accounts AS account
SET plain_password = COALESCE(
      NULLIF(TRIM(resident.household_no), ''),
      NULLIF(TRIM(resident.house_no), ''),
      'kaagapai123'
    )
FROM public.residents AS resident
WHERE resident.id = account.resident_id
  AND (account.plain_password IS NULL OR account.plain_password = '');

-- 3. Create or replace RPC: sync_resident_plain_password
CREATE OR REPLACE FUNCTION public.sync_resident_plain_password(
  p_username TEXT,
  p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.resident_accounts
  SET plain_password = p_password,
      updated_at = NOW()
  WHERE LOWER(username) = LOWER(TRIM(p_username));

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_resident_plain_password(TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. Create or replace RPC: update_resident_account_credentials
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
      plain_password = v_new_password,
      must_change_credentials = FALSE,
      updated_at = NOW()
  WHERE public.resident_accounts.id = v_account.id
  RETURNING *
  INTO v_account;

  SELECT *
  INTO v_resident
  FROM public.residents
  WHERE public.residents.id = v_account.resident_id;

  RETURN QUERY
  SELECT
    v_resident.id,
    v_account.id AS account_id,
    v_resident.full_name,
    v_resident.email,
    v_account.username,
    v_resident.phone,
    v_resident.house_no,
    v_resident.household_no,
    v_resident.birthday,
    v_resident.age,
    v_resident.gender,
    v_resident.purok,
    v_resident.address,
    v_resident.status,
    v_account.account_status,
    v_account.must_change_credentials;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_resident_account_credentials(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. Create or replace RPC: admin_create_resident_account
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
  v_normalized_username TEXT;
  v_account_id UUID;
  v_existing_id UUID;
BEGIN
  v_normalized_username := LOWER(TRIM(p_username));

  IF v_normalized_username IS NULL OR v_normalized_username = '' THEN
    RAISE EXCEPTION 'Username is required.';
  END IF;

  IF p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'Password is required.';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.resident_accounts
  WHERE LOWER(username) = v_normalized_username
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Username "%" is already taken.', v_normalized_username;
  END IF;

  INSERT INTO public.resident_accounts (
    resident_id,
    username,
    password_hash,
    plain_password,
    account_status
  ) VALUES (
    p_resident_id,
    v_normalized_username,
    crypt(p_password, gen_salt('bf')),
    p_password,
    'Active'
  )
  RETURNING id INTO v_account_id;

  RETURN jsonb_build_object(
    'account_id', v_account_id,
    'username', v_normalized_username,
    'status', 'Active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_resident_account(UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. Create or replace RPC: admin_reset_resident_password
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
  v_normalized_username TEXT := LOWER(TRIM(p_username));
  v_account_id UUID;
BEGIN
  IF p_resident_id IS NULL THEN
    RAISE EXCEPTION 'Resident ID is required.';
  END IF;

  IF v_normalized_username IS NULL OR v_normalized_username = '' THEN
    RAISE EXCEPTION 'Username is required.';
  END IF;

  SELECT id INTO v_account_id
  FROM public.resident_accounts
  WHERE resident_id = p_resident_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'No resident account found for this resident.';
  END IF;

  IF p_password IS NOT NULL AND p_password <> '' THEN
    UPDATE public.resident_accounts
    SET username = v_normalized_username,
        password_hash = crypt(p_password, gen_salt('bf')),
        plain_password = p_password,
        must_change_credentials = FALSE,
        updated_at = NOW()
    WHERE id = v_account_id;
  ELSE
    UPDATE public.resident_accounts
    SET username = v_normalized_username,
        updated_at = NOW()
    WHERE id = v_account_id;
  END IF;

  RETURN jsonb_build_object(
    'account_id', v_account_id,
    'username', v_normalized_username,
    'status', 'Active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_resident_password(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
