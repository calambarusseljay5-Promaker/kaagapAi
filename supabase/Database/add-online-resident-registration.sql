-- Add online resident registration support.
-- Run this in Supabase SQL Editor after add-resident-account-activation.sql.
--
-- Existing behavior stays supported:
-- - If the resident already exists, the request is treated as portal access approval.
-- New behavior:
-- - If no resident record matches, a pending online registration request is saved.
-- - Admin approval creates the resident record, activates the resident account,
--   and returns the username and household password for SMS notification.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS last_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS middle_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS house_no TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS household_no TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS relationship_to_household_head TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS birthday DATE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS age INTEGER;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS sex TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS birthplace TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS purok TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS educational_attainment TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS occupation TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS civil_status TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS is_4ps_member BOOLEAN DEFAULT FALSE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS is_solo_parent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT FALSE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS pwd_type TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.normalize_resident_claim(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(LOWER(COALESCE(value, '')), '[^a-z0-9]', '', 'g')
$$;

CREATE TABLE IF NOT EXISTS public.resident_activation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES public.residents(id) ON DELETE CASCADE,
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

ALTER TABLE public.resident_activation_requests
ALTER COLUMN resident_id DROP NOT NULL;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_full_name TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_birthday DATE;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_household_no TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_last_name TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_first_name TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_middle_name TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_phone TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_sex TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_birthplace TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_purok TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_educational_attainment TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_occupation TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_civil_status TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_house_no TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_relationship_to_household_head TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_address TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_is_4ps_member BOOLEAN DEFAULT FALSE;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_is_solo_parent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_is_pwd BOOLEAN DEFAULT FALSE;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS requested_pwd_type TEXT;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.resident_activation_requests
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_resident_activation_requests_resident_id
ON public.resident_activation_requests(resident_id);

CREATE INDEX IF NOT EXISTS idx_resident_activation_requests_status
ON public.resident_activation_requests(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_activation_requests_one_pending
ON public.resident_activation_requests(resident_id)
WHERE status = 'Pending Approval' AND resident_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_online_resident_registration_one_pending
ON public.resident_activation_requests (
  public.normalize_resident_claim(requested_full_name),
  requested_birthday,
  public.normalize_resident_claim(requested_household_no)
)
WHERE status = 'Pending Approval' AND resident_id IS NULL;

DROP FUNCTION IF EXISTS public.request_resident_account_activation(TEXT, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.request_resident_account_activation(
  p_full_name TEXT,
  p_birthday DATE,
  p_household_no TEXT,
  p_phone TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_middle_name TEXT DEFAULT NULL,
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
  p_pwd_type TEXT DEFAULT NULL
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
  v_first_name TEXT := NULLIF(TRIM(COALESCE(p_first_name, '')), '');
  v_middle_name TEXT := NULLIF(TRIM(COALESCE(p_middle_name, '')), '');
  v_last_name TEXT := NULLIF(TRIM(COALESCE(p_last_name, '')), '');
  v_full_name TEXT := NULLIF(TRIM(COALESCE(p_full_name, '')), '');
  v_household_no TEXT := NULLIF(TRIM(COALESCE(p_household_no, '')), '');
  v_phone TEXT := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  v_sex TEXT := NULLIF(TRIM(COALESCE(p_sex, '')), '');
  v_birthplace TEXT := NULLIF(TRIM(COALESCE(p_birthplace, '')), '');
  v_purok TEXT := NULLIF(TRIM(COALESCE(p_purok, '')), '');
  v_educational_attainment TEXT := NULLIF(TRIM(COALESCE(p_educational_attainment, '')), '');
  v_occupation TEXT := NULLIF(TRIM(COALESCE(p_occupation, '')), '');
  v_civil_status TEXT := NULLIF(TRIM(COALESCE(p_civil_status, '')), '');
  v_house_no TEXT := NULLIF(TRIM(COALESCE(p_house_no, '')), '');
  v_relationship TEXT := NULLIF(TRIM(COALESCE(p_relationship_to_household_head, '')), '');
  v_address TEXT := NULLIF(TRIM(COALESCE(p_address, '')), '');
  v_pwd_type TEXT := NULLIF(TRIM(COALESCE(p_pwd_type, '')), '');
  v_resident public.residents%ROWTYPE;
  v_account public.resident_accounts%ROWTYPE;
  v_request public.resident_activation_requests%ROWTYPE;
BEGIN
  v_full_name := COALESCE(v_full_name, NULLIF(TRIM(CONCAT_WS(' ', v_first_name, v_middle_name, v_last_name)), ''));

  IF v_full_name IS NULL OR p_birthday IS NULL OR v_household_no IS NULL THEN
    RAISE EXCEPTION 'Full name, birth date, and household number are required.';
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents AS resident
  WHERE COALESCE(resident.status, 'Active') = 'Active'
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
  ORDER BY resident.created_at ASC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
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
        COALESCE(v_resident.full_name, v_full_name),
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
        'Your registration request is already pending admin approval. Please wait for SMS confirmation after verification.'::TEXT,
        v_request.id,
        v_resident.id,
        COALESCE(v_resident.full_name, v_full_name),
        'Pending Approval'::TEXT;
      RETURN;
    END IF;

    INSERT INTO public.resident_activation_requests (
      resident_id,
      requested_full_name,
      requested_birthday,
      requested_household_no,
      requested_last_name,
      requested_first_name,
      requested_middle_name,
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
      status
    )
    VALUES (
      v_resident.id,
      v_full_name,
      p_birthday,
      v_household_no,
      v_last_name,
      v_first_name,
      v_middle_name,
      v_phone,
      v_sex,
      v_birthplace,
      v_purok,
      v_educational_attainment,
      v_occupation,
      v_civil_status,
      v_house_no,
      v_relationship,
      v_address,
      COALESCE(p_is_4ps_member, FALSE),
      COALESCE(p_is_solo_parent, FALSE),
      COALESCE(p_is_pwd, FALSE),
      v_pwd_type,
      'Pending Approval'
    )
    RETURNING *
    INTO v_request;

    RETURN QUERY SELECT
      'pending'::TEXT,
      'Your registration request was sent. Please wait for admin approval and SMS confirmation.'::TEXT,
      v_request.id,
      v_resident.id,
      COALESCE(v_resident.full_name, v_full_name),
      'Pending Approval'::TEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_request
  FROM public.resident_activation_requests AS request
  WHERE request.resident_id IS NULL
    AND request.status = 'Pending Approval'
    AND public.normalize_resident_claim(request.requested_full_name) = public.normalize_resident_claim(v_full_name)
    AND request.requested_birthday = p_birthday
    AND public.normalize_resident_claim(request.requested_household_no) = public.normalize_resident_claim(v_household_no)
  ORDER BY request.request_date DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      'pending'::TEXT,
      'Your online resident registration is already pending admin approval. Please wait for SMS confirmation after verification.'::TEXT,
      v_request.id,
      NULL::UUID,
      v_full_name,
      'Pending Approval'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.resident_activation_requests (
    resident_id,
    requested_full_name,
    requested_birthday,
    requested_household_no,
    requested_last_name,
    requested_first_name,
    requested_middle_name,
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
    status
  )
  VALUES (
    NULL,
    v_full_name,
    p_birthday,
    v_household_no,
    v_last_name,
    v_first_name,
    v_middle_name,
    v_phone,
    v_sex,
    v_birthplace,
    v_purok,
    v_educational_attainment,
    v_occupation,
    v_civil_status,
    v_house_no,
    v_relationship,
    v_address,
    COALESCE(p_is_4ps_member, FALSE),
    COALESCE(p_is_solo_parent, FALSE),
    COALESCE(p_is_pwd, FALSE),
    v_pwd_type,
    'Pending Approval'
  )
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    'pending'::TEXT,
    'Your online resident registration was sent. Please wait for barangay admin verification. After approval, your login username and household password will be sent by SMS.'::TEXT,
    v_request.id,
    NULL::UUID,
    v_full_name,
    'Pending Approval'::TEXT;
END
$$;

DROP FUNCTION IF EXISTS public.get_resident_activation_requests(TEXT);

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
  requested_last_name TEXT,
  requested_first_name TEXT,
  requested_middle_name TEXT,
  requested_phone TEXT,
  requested_sex TEXT,
  requested_birthplace TEXT,
  requested_purok TEXT,
  requested_educational_attainment TEXT,
  requested_occupation TEXT,
  requested_civil_status TEXT,
  requested_house_no TEXT,
  requested_relationship_to_household_head TEXT,
  requested_address TEXT,
  requested_is_4ps_member BOOLEAN,
  requested_is_solo_parent BOOLEAN,
  requested_is_pwd BOOLEAN,
  requested_pwd_type TEXT,
  full_name TEXT,
  birthday DATE,
  household_no TEXT,
  phone TEXT,
  sex TEXT,
  birthplace TEXT,
  purok TEXT,
  educational_attainment TEXT,
  occupation TEXT,
  civil_status TEXT,
  house_no TEXT,
  relationship_to_household_head TEXT,
  address TEXT,
  username TEXT,
  account_status TEXT,
  registration_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can view resident registration requests.';
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
    request.requested_last_name,
    request.requested_first_name,
    request.requested_middle_name,
    request.requested_phone,
    request.requested_sex,
    request.requested_birthplace,
    request.requested_purok,
    request.requested_educational_attainment,
    request.requested_occupation,
    request.requested_civil_status,
    request.requested_house_no,
    request.requested_relationship_to_household_head,
    request.requested_address,
    COALESCE(request.requested_is_4ps_member, FALSE),
    COALESCE(request.requested_is_solo_parent, FALSE),
    COALESCE(request.requested_is_pwd, FALSE),
    request.requested_pwd_type,
    COALESCE(resident.full_name, request.requested_full_name),
    COALESCE(resident.birthday, request.requested_birthday),
    COALESCE(
      NULLIF(TRIM(resident.household_no), ''),
      NULLIF(TRIM(resident.house_no), ''),
      request.requested_household_no
    ),
    COALESCE(NULLIF(TRIM(resident.phone), ''), request.requested_phone),
    COALESCE(NULLIF(TRIM(resident.sex), ''), NULLIF(TRIM(resident.gender), ''), request.requested_sex),
    COALESCE(NULLIF(TRIM(resident.birthplace), ''), request.requested_birthplace),
    COALESCE(NULLIF(TRIM(resident.purok), ''), request.requested_purok),
    COALESCE(NULLIF(TRIM(resident.educational_attainment), ''), request.requested_educational_attainment),
    COALESCE(NULLIF(TRIM(resident.occupation), ''), request.requested_occupation),
    COALESCE(NULLIF(TRIM(resident.civil_status), ''), request.requested_civil_status),
    COALESCE(NULLIF(TRIM(resident.house_no), ''), request.requested_house_no),
    COALESCE(NULLIF(TRIM(resident.relationship_to_household_head), ''), request.requested_relationship_to_household_head),
    COALESCE(NULLIF(TRIM(resident.address), ''), request.requested_address),
    account.username,
    account.account_status,
    CASE WHEN request.resident_id IS NULL THEN 'New resident registration' ELSE 'Existing resident access' END
  FROM public.resident_activation_requests AS request
  LEFT JOIN public.residents AS resident ON resident.id = request.resident_id
  LEFT JOIN public.resident_accounts AS account ON account.resident_id = resident.id
  WHERE p_status_filter IS NULL OR p_status_filter = '' OR request.status = p_status_filter
  ORDER BY request.request_date DESC;
END
$$;

DROP FUNCTION IF EXISTS public.approve_resident_activation_request(UUID);

CREATE OR REPLACE FUNCTION public.approve_resident_activation_request(p_request_id UUID)
RETURNS TABLE (
  request_id UUID,
  resident_id UUID,
  full_name TEXT,
  phone TEXT,
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
  v_parts TEXT[];
  v_first_name TEXT;
  v_middle_name TEXT;
  v_last_name TEXT;
  v_part_count INTEGER;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve resident registration requests.';
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
    RAISE EXCEPTION 'Only pending registration requests can be approved.';
  END IF;

  IF v_request.resident_id IS NOT NULL THEN
    SELECT *
    INTO v_resident
    FROM public.residents AS resident
    WHERE resident.id = v_request.resident_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Resident record was not found.';
    END IF;
  ELSE
    SELECT *
    INTO v_resident
    FROM public.residents AS resident
    WHERE COALESCE(resident.status, 'Active') = 'Active'
      AND public.normalize_resident_claim(
        COALESCE(
          NULLIF(TRIM(resident.full_name), ''),
          CONCAT_WS(' ', resident.first_name, resident.middle_name, resident.last_name)
        )
      ) = public.normalize_resident_claim(v_request.requested_full_name)
      AND resident.birthday = v_request.requested_birthday
      AND public.normalize_resident_claim(
        COALESCE(NULLIF(TRIM(resident.household_no), ''), NULLIF(TRIM(resident.house_no), ''))
      ) = public.normalize_resident_claim(v_request.requested_household_no)
    LIMIT 1;

    IF NOT FOUND THEN
      v_parts := regexp_split_to_array(TRIM(v_request.requested_full_name), '\s+');
      v_part_count := COALESCE(array_length(v_parts, 1), 0);
      v_first_name := NULLIF(TRIM(COALESCE(v_request.requested_first_name, '')), '');
      v_middle_name := NULLIF(TRIM(COALESCE(v_request.requested_middle_name, '')), '');
      v_last_name := NULLIF(TRIM(COALESCE(v_request.requested_last_name, '')), '');

      IF v_first_name IS NULL AND v_part_count > 0 THEN
        v_first_name := v_parts[1];
      END IF;

      IF v_last_name IS NULL AND v_part_count > 1 THEN
        v_last_name := v_parts[v_part_count];
      END IF;

      IF v_middle_name IS NULL AND v_part_count > 2 THEN
        SELECT string_agg(part, ' ' ORDER BY ordinality)
        INTO v_middle_name
        FROM unnest(v_parts) WITH ORDINALITY AS parts(part, ordinality)
        WHERE ordinality > 1
          AND ordinality < v_part_count;
      END IF;

      INSERT INTO public.residents (
        full_name,
        first_name,
        middle_name,
        last_name,
        phone,
        house_no,
        household_no,
        relationship_to_household_head,
        birthday,
        age,
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
        v_request.requested_full_name,
        v_first_name,
        v_middle_name,
        v_last_name,
        COALESCE(NULLIF(TRIM(v_request.requested_phone), ''), NULL),
        COALESCE(NULLIF(TRIM(v_request.requested_house_no), ''), v_request.requested_household_no),
        v_request.requested_household_no,
        COALESCE(NULLIF(TRIM(v_request.requested_relationship_to_household_head), ''), 'Head'),
        v_request.requested_birthday,
        CASE
          WHEN v_request.requested_birthday IS NOT NULL AND v_request.requested_birthday <= CURRENT_DATE
            THEN EXTRACT(YEAR FROM age(CURRENT_DATE, v_request.requested_birthday))::INTEGER
          ELSE NULL::INTEGER
        END,
        v_request.requested_sex,
        v_request.requested_sex,
        v_request.requested_birthplace,
        v_request.requested_purok,
        v_request.requested_educational_attainment,
        v_request.requested_occupation,
        v_request.requested_civil_status,
        v_request.requested_address,
        COALESCE(v_request.requested_is_4ps_member, FALSE),
        COALESCE(v_request.requested_is_solo_parent, FALSE),
        COALESCE(v_request.requested_is_pwd, FALSE),
        CASE WHEN COALESCE(v_request.requested_is_pwd, FALSE) THEN v_request.requested_pwd_type ELSE NULL END,
        'Active'
      )
      RETURNING *
      INTO v_resident;
    END IF;
  END IF;

  UPDATE public.residents AS resident_update
  SET full_name = COALESCE(NULLIF(TRIM(resident_update.full_name), ''), v_request.requested_full_name),
      first_name = COALESCE(NULLIF(TRIM(resident_update.first_name), ''), v_request.requested_first_name),
      middle_name = COALESCE(NULLIF(TRIM(resident_update.middle_name), ''), v_request.requested_middle_name),
      last_name = COALESCE(NULLIF(TRIM(resident_update.last_name), ''), v_request.requested_last_name),
      phone = COALESCE(NULLIF(TRIM(resident_update.phone), ''), v_request.requested_phone),
      house_no = COALESCE(NULLIF(TRIM(resident_update.house_no), ''), v_request.requested_house_no, v_request.requested_household_no),
      household_no = COALESCE(NULLIF(TRIM(resident_update.household_no), ''), v_request.requested_household_no),
      relationship_to_household_head = COALESCE(
        NULLIF(TRIM(resident_update.relationship_to_household_head), ''),
        v_request.requested_relationship_to_household_head,
        'Head'
      ),
      birthday = COALESCE(resident_update.birthday, v_request.requested_birthday),
      age = COALESCE(
        resident_update.age,
        CASE
          WHEN v_request.requested_birthday IS NOT NULL AND v_request.requested_birthday <= CURRENT_DATE
            THEN EXTRACT(YEAR FROM age(CURRENT_DATE, v_request.requested_birthday))::INTEGER
          ELSE NULL::INTEGER
        END
      ),
      sex = COALESCE(NULLIF(TRIM(resident_update.sex), ''), v_request.requested_sex),
      gender = COALESCE(NULLIF(TRIM(resident_update.gender), ''), v_request.requested_sex),
      birthplace = COALESCE(NULLIF(TRIM(resident_update.birthplace), ''), v_request.requested_birthplace),
      purok = COALESCE(NULLIF(TRIM(resident_update.purok), ''), v_request.requested_purok),
      educational_attainment = COALESCE(NULLIF(TRIM(resident_update.educational_attainment), ''), v_request.requested_educational_attainment),
      occupation = COALESCE(NULLIF(TRIM(resident_update.occupation), ''), v_request.requested_occupation),
      civil_status = COALESCE(NULLIF(TRIM(resident_update.civil_status), ''), v_request.requested_civil_status),
      address = COALESCE(NULLIF(TRIM(resident_update.address), ''), v_request.requested_address),
      is_4ps_member = COALESCE(resident_update.is_4ps_member, v_request.requested_is_4ps_member, FALSE),
      is_solo_parent = COALESCE(resident_update.is_solo_parent, v_request.requested_is_solo_parent, FALSE),
      is_pwd = COALESCE(resident_update.is_pwd, v_request.requested_is_pwd, FALSE),
      pwd_type = COALESCE(NULLIF(TRIM(resident_update.pwd_type), ''), CASE WHEN COALESCE(v_request.requested_is_pwd, FALSE) THEN v_request.requested_pwd_type ELSE NULL END),
      status = 'Active',
      updated_at = NOW()
  WHERE resident_update.id = v_resident.id
  RETURNING *
  INTO v_resident;

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

  IF v_account.id IS NOT NULL THEN
    UPDATE public.resident_accounts AS account_update
    SET username = v_username,
        password_hash = crypt(v_temporary_password, gen_salt('bf')),
        account_status = 'Active',
        must_change_credentials = FALSE,
        updated_at = NOW()
    WHERE account_update.id = v_account.id
    RETURNING *
    INTO v_account;
  ELSE
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
    RETURNING *
    INTO v_account;
  END IF;

  UPDATE public.resident_activation_requests AS request_update
  SET resident_id = v_resident.id,
      status = 'Approved',
      approved_by = auth.uid(),
      approved_at = NOW(),
      rejected_by = NULL,
      rejected_at = NULL,
      rejection_reason = NULL,
      updated_at = NOW()
  WHERE request_update.id = p_request_id
  RETURNING *
  INTO v_request;

  RETURN QUERY SELECT
    v_request.id,
    v_resident.id,
    v_resident.full_name,
    COALESCE(NULLIF(TRIM(v_resident.phone), ''), v_request.requested_phone),
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
    RAISE EXCEPTION 'Only admins can reject resident registration requests.';
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
    RAISE EXCEPTION 'Registration request not found.';
  END IF;

  IF v_request.status <> 'Pending Approval' THEN
    RAISE EXCEPTION 'Only pending registration requests can be rejected.';
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

GRANT EXECUTE ON FUNCTION public.request_resident_account_activation(
  TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT
) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_resident_activation_requests(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_resident_activation_request(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_resident_activation_request(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
