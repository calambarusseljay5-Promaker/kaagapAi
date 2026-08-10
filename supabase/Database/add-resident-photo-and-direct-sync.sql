-- Resident profile extension and direct synchronization RPC
-- Run this in the Supabase SQL Editor to support direct resident profile updates.

-- 1. Add profile_photo_url and emergency_contact columns to the residents table if they do not exist.
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- 2. Create the direct update RPC function with SECURITY DEFINER to bypass RLS securely.
CREATE OR REPLACE FUNCTION public.update_resident_profile_direct(
  p_resident_id UUID,
  p_current_username TEXT,
  p_password TEXT,
  p_requested_username TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  resident_id UUID,
  full_name TEXT,
  username TEXT,
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
  v_key TEXT;
  v_value JSONB;
BEGIN
  IF p_resident_id IS NULL THEN
    RAISE EXCEPTION 'Resident record is required.';
  END IF;

  IF v_current_username = '' OR v_password = '' THEN
    RAISE EXCEPTION 'Current username and household password are required.';
  END IF;

  SELECT * INTO v_resident FROM public.residents WHERE residents.id = p_resident_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident record not found.';
  END IF;

  IF COALESCE(v_resident.status, 'Active') <> 'Active' THEN
    RAISE EXCEPTION 'Only active resident records can update profiles.';
  END IF;

  SELECT * INTO v_account FROM public.resident_accounts 
  WHERE resident_accounts.resident_id = v_resident.id AND LOWER(resident_accounts.username) = LOWER(v_current_username) LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resident account not found. Please check your username.';
  END IF;

  IF COALESCE(v_account.account_status, 'Active') <> 'Active' THEN
    RAISE EXCEPTION 'Your resident account is not active.';
  END IF;

  IF v_account.password_hash IS NULL OR crypt(v_password, v_account.password_hash) <> v_account.password_hash THEN
    RAISE EXCEPTION 'Invalid household password.';
  END IF;

  -- Validate username change if requested
  IF v_requested_username = '' OR LOWER(v_requested_username) = LOWER(v_account.username) THEN
    v_requested_username := NULL;
  END IF;

  IF v_requested_username IS NOT NULL AND (LENGTH(v_requested_username) < 4 OR LENGTH(v_requested_username) > 30) THEN
    RAISE EXCEPTION 'Username must be 4 to 30 characters.';
  END IF;

  IF v_requested_username IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.resident_accounts 
    WHERE LOWER(resident_accounts.username) = LOWER(v_requested_username) AND resident_accounts.id <> v_account.id
  ) THEN
    RAISE EXCEPTION 'That username is already used by another resident.';
  END IF;

  -- Update residents table directly
  UPDATE public.residents
  SET 
    full_name = CASE WHEN v_changes ? 'full_name' THEN NULLIF(TRIM(v_changes->>'full_name'), '') ELSE residents.full_name END,
    phone = CASE WHEN v_changes ? 'phone' THEN NULLIF(TRIM(v_changes->>'phone'), '') ELSE residents.phone END,
    house_no = CASE WHEN v_changes ? 'house_no' THEN NULLIF(TRIM(v_changes->>'house_no'), '') ELSE residents.house_no END,
    household_no = CASE WHEN v_changes ? 'household_no' THEN NULLIF(TRIM(v_changes->>'household_no'), '') ELSE residents.household_no END,
    relationship_to_household_head = CASE WHEN v_changes ? 'relationship_to_household_head' THEN NULLIF(TRIM(v_changes->>'relationship_to_household_head'), '') ELSE residents.relationship_to_household_head END,
    birthday = CASE WHEN v_changes ? 'birthday' THEN NULLIF(TRIM(v_changes->>'birthday'), '')::DATE ELSE residents.birthday END,
    age = CASE WHEN v_changes ? 'age' THEN NULLIF(REGEXP_REPLACE(v_changes->>'age', '[^0-9]', '', 'g'), '')::INTEGER ELSE residents.age END,
    sex = CASE WHEN v_changes ? 'sex' THEN NULLIF(TRIM(v_changes->>'sex'), '') ELSE residents.sex END,
    gender = CASE
      WHEN v_changes ? 'gender' THEN NULLIF(TRIM(v_changes->>'gender'), '')
      WHEN v_changes ? 'sex' THEN NULLIF(TRIM(v_changes->>'sex'), '')
      ELSE residents.gender
    END,
    birthplace = CASE WHEN v_changes ? 'birthplace' THEN NULLIF(TRIM(v_changes->>'birthplace'), '') ELSE residents.birthplace END,
    educational_attainment = CASE WHEN v_changes ? 'educational_attainment' THEN NULLIF(TRIM(v_changes->>'educational_attainment'), '') ELSE residents.educational_attainment END,
    occupation = CASE WHEN v_changes ? 'occupation' THEN NULLIF(TRIM(v_changes->>'occupation'), '') ELSE residents.occupation END,
    civil_status = CASE WHEN v_changes ? 'civil_status' THEN NULLIF(TRIM(v_changes->>'civil_status'), '') ELSE residents.civil_status END,
    purok = CASE WHEN v_changes ? 'purok' THEN NULLIF(TRIM(v_changes->>'purok'), '') ELSE residents.purok END,
    address = CASE WHEN v_changes ? 'address' THEN NULLIF(TRIM(v_changes->>'address'), '') ELSE residents.address END,
    profile_photo_url = CASE WHEN v_changes ? 'profile_photo_url' THEN NULLIF(TRIM(v_changes->>'profile_photo_url'), '') ELSE residents.profile_photo_url END,
    emergency_contact = CASE WHEN v_changes ? 'emergency_contact' THEN NULLIF(TRIM(v_changes->>'emergency_contact'), '') ELSE residents.emergency_contact END,
    updated_at = NOW()
  WHERE residents.id = p_resident_id
  RETURNING * INTO v_resident;

  -- Update resident_accounts username if requested
  IF v_requested_username IS NOT NULL THEN
    UPDATE public.resident_accounts
    SET username = v_requested_username,
        updated_at = NOW()
    WHERE resident_accounts.resident_id = p_resident_id
    RETURNING * INTO v_account;
  END IF;

  RETURN QUERY
  SELECT
    v_resident.id AS resident_id,
    v_resident.full_name,
    v_account.username,
    'Your profile has been updated and synchronized successfully.'::text AS message;
END;
$$;

-- 3. Create password-less avatar update RPC function for smooth picture uploads
CREATE OR REPLACE FUNCTION public.update_resident_avatar(
  p_resident_id UUID,
  p_photo_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.residents
  SET profile_photo_url = NULLIF(TRIM(p_photo_url), ''),
      updated_at = NOW()
  WHERE id = p_resident_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_resident_profile_direct(UUID, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_resident_avatar(UUID, TEXT) TO anon, authenticated, service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
