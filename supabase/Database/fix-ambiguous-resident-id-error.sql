-- Fix: "column reference resident_id is ambiguous" during personal info update / password confirmation
-- Run this script in the Supabase SQL Editor to apply the fix to your database.

SET search_path = public, extensions;

-- 1. Overwrite direct update RPC function with #variable_conflict use_column and table-qualified columns
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
BEGIN
  IF p_resident_id IS NULL THEN
    RAISE EXCEPTION 'Resident record is required.';
  END IF;

  IF v_current_username = '' OR v_password = '' THEN
    RAISE EXCEPTION 'Current username and password are required.';
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

  -- Update residents table directly with ALL fields
  UPDATE public.residents
  SET 
    first_name = CASE WHEN v_changes ? 'first_name' THEN NULLIF(TRIM(v_changes->>'first_name'), '') ELSE residents.first_name END,
    middle_name = CASE WHEN v_changes ? 'middle_name' THEN NULLIF(TRIM(v_changes->>'middle_name'), '') ELSE residents.middle_name END,
    last_name = CASE WHEN v_changes ? 'last_name' THEN NULLIF(TRIM(v_changes->>'last_name'), '') ELSE residents.last_name END,
    suffix = CASE WHEN v_changes ? 'suffix' THEN NULLIF(TRIM(v_changes->>'suffix'), '') ELSE residents.suffix END,
    full_name = CASE WHEN v_changes ? 'full_name' THEN NULLIF(TRIM(v_changes->>'full_name'), '') ELSE residents.full_name END,
    phone = CASE WHEN v_changes ? 'phone' THEN NULLIF(TRIM(v_changes->>'phone'), '') ELSE residents.phone END,
    email = CASE WHEN v_changes ? 'email' THEN NULLIF(TRIM(v_changes->>'email'), '') ELSE residents.email END,
    birthday = CASE WHEN v_changes ? 'birthday' THEN NULLIF(TRIM(v_changes->>'birthday'), '')::DATE ELSE residents.birthday END,
    age = CASE WHEN v_changes ? 'age' THEN NULLIF(REGEXP_REPLACE(v_changes->>'age', '[^0-9]', '', 'g'), '')::INTEGER ELSE residents.age END,
    sex = CASE WHEN v_changes ? 'sex' THEN NULLIF(TRIM(v_changes->>'sex'), '') ELSE residents.sex END,
    gender = CASE WHEN v_changes ? 'sex' THEN NULLIF(TRIM(v_changes->>'sex'), '') ELSE residents.gender END,
    civil_status = CASE WHEN v_changes ? 'civil_status' THEN NULLIF(TRIM(v_changes->>'civil_status'), '') ELSE residents.civil_status END,
    birthplace = CASE WHEN v_changes ? 'birthplace' THEN NULLIF(TRIM(v_changes->>'birthplace'), '') ELSE residents.birthplace END,
    educational_attainment = CASE WHEN v_changes ? 'educational_attainment' THEN NULLIF(TRIM(v_changes->>'educational_attainment'), '') ELSE residents.educational_attainment END,
    occupation = CASE WHEN v_changes ? 'occupation' THEN NULLIF(TRIM(v_changes->>'occupation'), '') ELSE residents.occupation END,
    household_no = CASE WHEN v_changes ? 'household_no' THEN NULLIF(TRIM(v_changes->>'household_no'), '') ELSE residents.household_no END,
    relationship_to_household_head = CASE WHEN v_changes ? 'relationship_to_household_head' THEN NULLIF(TRIM(v_changes->>'relationship_to_household_head'), '') ELSE residents.relationship_to_household_head END,
    house_no = CASE WHEN v_changes ? 'house_no' THEN NULLIF(TRIM(v_changes->>'house_no'), '') ELSE residents.house_no END,
    address = CASE WHEN v_changes ? 'address' THEN NULLIF(TRIM(v_changes->>'address'), '') ELSE residents.address END,
    purok = CASE WHEN v_changes ? 'purok' THEN NULLIF(TRIM(v_changes->>'purok'), '') ELSE residents.purok END,
    profile_photo_url = CASE WHEN v_changes ? 'profile_photo_url' THEN NULLIF(TRIM(v_changes->>'profile_photo_url'), '') ELSE residents.profile_photo_url END,
    
    -- Additional fields:
    nationality = CASE WHEN v_changes ? 'nationality' THEN NULLIF(TRIM(v_changes->>'nationality'), '') ELSE residents.nationality END,
    religion = CASE WHEN v_changes ? 'religion' THEN NULLIF(TRIM(v_changes->>'religion'), '') ELSE residents.religion END,
    blood_type = CASE WHEN v_changes ? 'blood_type' THEN NULLIF(TRIM(v_changes->>'blood_type'), '') ELSE residents.blood_type END,
    telephone = CASE WHEN v_changes ? 'telephone' THEN NULLIF(TRIM(v_changes->>'telephone'), '') ELSE residents.telephone END,
    emergency_contact_person = CASE WHEN v_changes ? 'emergency_contact_person' THEN NULLIF(TRIM(v_changes->>'emergency_contact_person'), '') ELSE residents.emergency_contact_person END,
    emergency_contact_phone = CASE WHEN v_changes ? 'emergency_contact_phone' THEN NULLIF(TRIM(v_changes->>'emergency_contact_phone'), '') ELSE residents.emergency_contact_phone END,
    region = CASE WHEN v_changes ? 'region' THEN NULLIF(TRIM(v_changes->>'region'), '') ELSE residents.region END,
    province = CASE WHEN v_changes ? 'province' THEN NULLIF(TRIM(v_changes->>'province'), '') ELSE residents.province END,
    municipality = CASE WHEN v_changes ? 'municipality' THEN NULLIF(TRIM(v_changes->>'municipality'), '') ELSE residents.municipality END,
    barangay = CASE WHEN v_changes ? 'barangay' THEN NULLIF(TRIM(v_changes->>'barangay'), '') ELSE residents.barangay END,
    zip_code = CASE WHEN v_changes ? 'zip_code' THEN NULLIF(TRIM(v_changes->>'zip_code'), '') ELSE residents.zip_code END,
    voter_status = CASE WHEN v_changes ? 'voter_status' THEN NULLIF(TRIM(v_changes->>'voter_status'), '') ELSE residents.voter_status END,
    employment_status = CASE WHEN v_changes ? 'employment_status' THEN NULLIF(TRIM(v_changes->>'employment_status'), '') ELSE residents.employment_status END,
    years_of_residency = CASE WHEN v_changes ? 'years_of_residency' THEN NULLIF(REGEXP_REPLACE(v_changes->>'years_of_residency', '[^0-9]', '', 'g'), '')::INTEGER ELSE residents.years_of_residency END,
    is_senior_citizen = CASE WHEN v_changes ? 'is_senior_citizen' THEN (v_changes->>'is_senior_citizen')::BOOLEAN ELSE residents.is_senior_citizen END,
    is_pwd = CASE WHEN v_changes ? 'is_pwd' THEN (v_changes->>'is_pwd')::BOOLEAN ELSE residents.is_pwd END,
    is_solo_parent = CASE WHEN v_changes ? 'is_solo_parent' THEN (v_changes->>'is_solo_parent')::BOOLEAN ELSE residents.is_solo_parent END,
    indigenous_group = CASE WHEN v_changes ? 'indigenous_group' THEN NULLIF(TRIM(v_changes->>'indigenous_group'), '') ELSE residents.indigenous_group END,
    philhealth_no = CASE WHEN v_changes ? 'philhealth_no' THEN NULLIF(TRIM(v_changes->>'philhealth_no'), '') ELSE residents.philhealth_no END,
    sss_no = CASE WHEN v_changes ? 'sss_no' THEN NULLIF(TRIM(v_changes->>'sss_no'), '') ELSE residents.sss_no END,
    tin_no = CASE WHEN v_changes ? 'tin_no' THEN NULLIF(TRIM(v_changes->>'tin_no'), '') ELSE residents.tin_no END,
    
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

GRANT EXECUTE ON FUNCTION public.update_resident_profile_direct(UUID, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
