-- ============================================================================
-- SQL Migration Patch: Sync Plain Passwords for Online Resident Registrations
-- 
-- Run this script in your Supabase SQL Editor.
-- This script is SAFE and IDEMPOTENT (can be run multiple times safely).
-- ============================================================================

-- 1. Ensure requested_plain_password column exists on resident_activation_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resident_activation_requests'
      AND column_name = 'requested_plain_password'
  ) THEN
    ALTER TABLE public.resident_activation_requests
      ADD COLUMN requested_plain_password text DEFAULT NULL;
  END IF;
END $$;

-- 2. Update request_resident_account_activation to save plain password
CREATE OR REPLACE FUNCTION public.request_resident_account_activation(
  p_full_name text,
  p_birthday text,
  p_household_no text,
  p_phone text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_middle_name text DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_birthplace text DEFAULT NULL,
  p_purok text DEFAULT NULL,
  p_educational_attainment text DEFAULT NULL,
  p_occupation text DEFAULT NULL,
  p_civil_status text DEFAULT NULL,
  p_house_no text DEFAULT NULL,
  p_relationship_to_household_head text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_is_4ps_member boolean DEFAULT false,
  p_is_solo_parent boolean DEFAULT false,
  p_is_pwd boolean DEFAULT false,
  p_pwd_type text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_password text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request_id uuid;
  v_resident_id uuid;
  v_password_hash text;
  v_normalized_username text;
BEGIN
  IF trim(coalesce(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;

  v_normalized_username := lower(trim(coalesce(p_username, '')));
  IF v_normalized_username = '' THEN
    v_normalized_username := NULL;
  END IF;

  IF v_normalized_username IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM resident_accounts WHERE username = v_normalized_username
    ) THEN
      RAISE EXCEPTION 'Username "%" is already taken. Please choose a different one.', v_normalized_username;
    END IF;
    IF EXISTS (
      SELECT 1 FROM resident_activation_requests
      WHERE requested_username = v_normalized_username
        AND status = 'Pending Approval'
    ) THEN
      RAISE EXCEPTION 'Username "%" is already pending approval. Please choose a different one.', v_normalized_username;
    END IF;
  END IF;

  IF trim(coalesce(p_email, '')) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM resident_activation_requests
      WHERE requested_email = trim(p_email)
        AND status = 'Pending Approval'
    ) THEN
      RAISE EXCEPTION 'This email address already has a pending registration.';
    END IF;
  END IF;

  IF p_password IS NOT NULL AND p_password <> '' THEN
    v_password_hash := crypt(p_password, gen_salt('bf'));
  END IF;

  SELECT id INTO v_resident_id
  FROM residents
  WHERE lower(trim(full_name)) = lower(trim(p_full_name))
    AND birthday = p_birthday::date
    AND trim(household_no) = trim(p_household_no)
  LIMIT 1;

  INSERT INTO resident_activation_requests (
    resident_id,
    requested_full_name,
    requested_birthday,
    requested_household_no,
    requested_phone,
    requested_last_name,
    requested_first_name,
    requested_middle_name,
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
    requested_password_hash,
    requested_plain_password,
    requested_email,
    status
  ) VALUES (
    v_resident_id,
    trim(p_full_name),
    p_birthday::date,
    trim(p_household_no),
    trim(p_phone),
    trim(p_last_name),
    trim(p_first_name),
    trim(p_middle_name),
    trim(p_sex),
    trim(p_birthplace),
    trim(p_purok),
    trim(p_educational_attainment),
    trim(p_occupation),
    trim(p_civil_status),
    trim(p_house_no),
    trim(p_relationship_to_household_head),
    trim(p_address),
    coalesce(p_is_4ps_member, false),
    coalesce(p_is_solo_parent, false),
    coalesce(p_is_pwd, false),
    trim(p_pwd_type),
    v_normalized_username,
    v_password_hash,
    p_password,
    trim(p_email),
    'Pending Approval'
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'request_id', v_request_id,
    'resident_id', v_resident_id,
    'activation_status', 'Pending Approval',
    'activation_message', 'Your registration has been submitted. Please wait for admin approval. You will receive an SMS when your account is ready.',
    'request_status', 'Pending Approval'
  );
END;
$$;

-- 3. Update approve_resident_activation_request to save plain_password to resident_accounts
CREATE OR REPLACE FUNCTION public.approve_resident_activation_request(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request record;
  v_resident_id uuid;
  v_account_id uuid;
  v_username text;
  v_temp_password text;
  v_full_name text;
  v_phone text;
BEGIN
  SELECT * INTO v_request
  FROM resident_activation_requests
  WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Registration request not found.';
  END IF;

  IF v_request.status <> 'Pending Approval' THEN
    RAISE EXCEPTION 'This request has already been processed (status: %).', v_request.status;
  END IF;

  v_resident_id := v_request.resident_id;
  v_full_name := coalesce(v_request.requested_full_name, 'Resident');
  v_phone := v_request.requested_phone;

  IF v_resident_id IS NULL THEN
    INSERT INTO residents (
      full_name, last_name, first_name, middle_name,
      birthday, age, sex, gender, birthplace,
      purok, household_no, relationship_to_household_head,
      phone, address, house_no,
      educational_attainment, occupation, civil_status,
      is_4ps_member, is_solo_parent, is_pwd, pwd_type,
      email, status
    ) VALUES (
      v_request.requested_full_name,
      v_request.requested_last_name,
      v_request.requested_first_name,
      v_request.requested_middle_name,
      v_request.requested_birthday::date,
      EXTRACT(YEAR FROM age(v_request.requested_birthday::date)),
      v_request.requested_sex,
      v_request.requested_sex,
      v_request.requested_birthplace,
      v_request.requested_purok,
      v_request.requested_household_no,
      v_request.requested_relationship_to_household_head,
      v_request.requested_phone,
      v_request.requested_address,
      v_request.requested_house_no,
      v_request.requested_educational_attainment,
      v_request.requested_occupation,
      v_request.requested_civil_status,
      coalesce(v_request.requested_is_4ps_member, false),
      coalesce(v_request.requested_is_solo_parent, false),
      coalesce(v_request.requested_is_pwd, false),
      v_request.requested_pwd_type,
      v_request.requested_email,
      'Active'
    )
    RETURNING id INTO v_resident_id;
  ELSE
    UPDATE residents
    SET status = 'Active',
        email = coalesce(v_request.requested_email, email),
        phone = coalesce(v_request.requested_phone, phone)
    WHERE id = v_resident_id;
  END IF;

  IF v_request.requested_username IS NOT NULL AND v_request.requested_username <> '' THEN
    v_username := v_request.requested_username;
  ELSE
    v_username := lower(replace(trim(coalesce(
      v_request.requested_first_name,
      split_part(v_request.requested_full_name, ' ', 1)
    )), ' ', '')) || '_' || substr(md5(random()::text), 1, 4);
  END IF;

  SELECT id INTO v_account_id
  FROM resident_accounts
  WHERE resident_id = v_resident_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    IF v_request.requested_password_hash IS NOT NULL THEN
      INSERT INTO resident_accounts (
        resident_id,
        username,
        password_hash,
        plain_password,
        account_status
      ) VALUES (
        v_resident_id,
        v_username,
        v_request.requested_password_hash,
        v_request.requested_plain_password,
        'Active'
      )
      RETURNING id INTO v_account_id;
      v_temp_password := NULL;
    ELSE
      v_temp_password := substr(md5(random()::text), 1, 8);
      INSERT INTO resident_accounts (
        resident_id,
        username,
        password_hash,
        plain_password,
        account_status,
        must_change_credentials
      ) VALUES (
        v_resident_id,
        v_username,
        crypt(v_temp_password, gen_salt('bf')),
        v_temp_password,
        'Active',
        true
      )
      RETURNING id INTO v_account_id;
    END IF;
  END IF;

  UPDATE resident_activation_requests
  SET status = 'Approved',
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'resident_id', v_resident_id,
    'account_id', v_account_id,
    'username', v_username,
    'temporary_password', v_temp_password,
    'full_name', v_full_name,
    'phone', v_phone,
    'used_resident_credentials', (v_request.requested_password_hash IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_resident_account_activation(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_resident_activation_request(uuid) TO authenticated, service_role;
