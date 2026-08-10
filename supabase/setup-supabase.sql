-- Create user profiles table for authentication
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'resident',
  registration_status TEXT NOT NULL DEFAULT 'Active',
  phone TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- Create the residents table if it does not already exist
CREATE TABLE IF NOT EXISTS public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  email TEXT,
  phone TEXT,
  house_no TEXT,
  household_no TEXT,
  relationship_to_household_head TEXT,
  birthday DATE,
  age INTEGER,
  sex TEXT,
  gender TEXT,
  birthplace TEXT,
  educational_attainment TEXT,
  occupation TEXT,
  is_4ps_member BOOLEAN DEFAULT FALSE,
  is_solo_parent BOOLEAN DEFAULT FALSE,
  civil_status TEXT,
  is_pwd BOOLEAN DEFAULT FALSE,
  pwd_type TEXT,
  purok TEXT,
  address TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS house_no TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS last_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS middle_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS household_no TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS relationship_to_household_head TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS birthday DATE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS sex TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS birthplace TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS educational_attainment TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS occupation TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS is_4ps_member BOOLEAN DEFAULT FALSE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS is_solo_parent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS civil_status TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT FALSE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS pwd_type TEXT;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'Active';

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.user_profiles
ALTER COLUMN role SET DEFAULT 'resident';

ALTER TABLE public.user_profiles
ALTER COLUMN registration_status SET DEFAULT 'Active';

UPDATE public.user_profiles
SET registration_status = 'Active'
WHERE registration_status IS NULL;

ALTER TABLE public.user_profiles
ALTER COLUMN registration_status SET NOT NULL;

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_resident_id ON public.user_profiles(resident_id);
CREATE INDEX IF NOT EXISTS idx_residents_status ON public.residents(status);
CREATE INDEX IF NOT EXISTS idx_residents_full_name ON public.residents(full_name);
CREATE INDEX IF NOT EXISTS idx_residents_last_name ON public.residents(last_name);
CREATE INDEX IF NOT EXISTS idx_residents_first_name ON public.residents(first_name);
CREATE INDEX IF NOT EXISTS idx_residents_email ON public.residents(email);
CREATE INDEX IF NOT EXISTS idx_residents_phone ON public.residents(phone);
CREATE INDEX IF NOT EXISTS idx_residents_birthday ON public.residents(birthday);
CREATE INDEX IF NOT EXISTS idx_residents_sex ON public.residents(sex);
CREATE INDEX IF NOT EXISTS idx_residents_household_no ON public.residents(household_no);
CREATE INDEX IF NOT EXISTS idx_residents_household_relationship ON public.residents(relationship_to_household_head);
CREATE INDEX IF NOT EXISTS idx_residents_civil_status ON public.residents(civil_status);
CREATE INDEX IF NOT EXISTS idx_residents_4ps ON public.residents(is_4ps_member);
CREATE INDEX IF NOT EXISTS idx_residents_solo_parent ON public.residents(is_solo_parent);
CREATE INDEX IF NOT EXISTS idx_residents_archived_at ON public.residents(archived_at);
CREATE INDEX IF NOT EXISTS idx_residents_is_pwd ON public.residents(is_pwd);

-- Storage bucket for admin profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE public.residents
SET archived_at = COALESCE(archived_at, updated_at, NOW())
WHERE status = 'Archived'
  AND archived_at IS NULL;

-- Storage bucket for document template uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-templates',
  'document-templates',
  TRUE,
  20971520,
  ARRAY[
    'application/msword',
    'application/pdf',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE public.residents
SET sex = COALESCE(sex, gender),
    gender = COALESCE(gender, sex),
    is_4ps_member = COALESCE(is_4ps_member, FALSE),
    is_solo_parent = COALESCE(is_solo_parent, FALSE)
WHERE sex IS NULL
   OR gender IS NULL
   OR is_4ps_member IS NULL
   OR is_solo_parent IS NULL;

-- Helper used by RLS policies to avoid recursive user_profiles lookups.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN profile.role = 'admin'
      AND EXISTS (
        SELECT 1
        FROM auth.users AS auth_user
        WHERE auth_user.id = profile.id
          AND LOWER(auth_user.email) = LOWER('calambarusseljay5@gmail.com')
      )
      THEN 'admin'
    WHEN profile.role IN ('resident', 'user')
      THEN profile.role
    ELSE 'resident'
  END
  FROM public.user_profiles AS profile
  WHERE profile.id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.normalize_resident_claim(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(LOWER(COALESCE(value, '')), '[^a-z0-9]', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.normalize_resident_phone(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g')
$$;

GRANT EXECUTE ON FUNCTION public.normalize_resident_claim(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_resident_phone(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_resident_account(
  p_full_name TEXT,
  p_email TEXT,
  p_house_no TEXT,
  p_phone TEXT DEFAULT NULL,
  p_birthday DATE DEFAULT NULL,
  p_age INTEGER DEFAULT NULL,
  p_sex TEXT DEFAULT NULL,
  p_purok TEXT DEFAULT NULL,
  p_household_no TEXT DEFAULT NULL,
  p_household_relationship TEXT DEFAULT NULL,
  p_birthplace TEXT DEFAULT NULL,
  p_educational_attainment TEXT DEFAULT NULL,
  p_occupation TEXT DEFAULT NULL,
  p_civil_status TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_is_4ps_member BOOLEAN DEFAULT FALSE,
  p_is_solo_parent BOOLEAN DEFAULT FALSE,
  p_is_pwd BOOLEAN DEFAULT FALSE,
  p_pwd_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  registration_status TEXT,
  registration_message TEXT,
  id UUID,
  full_name TEXT,
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  email TEXT,
  phone TEXT,
  house_no TEXT,
  household_no TEXT,
  birthday DATE,
  age INTEGER,
  sex TEXT,
  gender TEXT,
  purok TEXT,
  address TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT := TRIM(COALESCE(p_full_name, ''));
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_house_no TEXT := TRIM(COALESCE(p_house_no, ''));
  v_phone TEXT := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  v_purok TEXT := NULLIF(TRIM(COALESCE(p_purok, '')), '');
  v_household_no TEXT := NULLIF(TRIM(COALESCE(p_household_no, '')), '');
  v_household_relationship TEXT := NULLIF(TRIM(COALESCE(p_household_relationship, '')), '');
  v_birthplace TEXT := NULLIF(TRIM(COALESCE(p_birthplace, '')), '');
  v_educational_attainment TEXT := NULLIF(TRIM(COALESCE(p_educational_attainment, '')), '');
  v_occupation TEXT := NULLIF(TRIM(COALESCE(p_occupation, '')), '');
  v_civil_status TEXT := NULLIF(TRIM(COALESCE(p_civil_status, '')), '');
  v_address TEXT := NULLIF(TRIM(COALESCE(p_address, '')), '');
  v_pwd_type TEXT := NULLIF(TRIM(COALESCE(p_pwd_type, '')), '');
  v_age INTEGER := COALESCE(
    p_age,
    CASE
      WHEN p_birthday IS NOT NULL THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthday))::INTEGER
      ELSE NULL
    END
  );
  v_match RECORD;
  v_resident public.residents%ROWTYPE;
  v_name_parts TEXT[];
  v_first_name TEXT;
  v_middle_name TEXT;
  v_last_name TEXT;
BEGIN
  IF v_full_name = '' OR v_email = '' OR v_house_no = '' THEN
    RAISE EXCEPTION 'Full name, Gmail/email, and house number are required.';
  END IF;

  WITH candidates AS (
    SELECT
      r.*,
      (
        CASE WHEN NULLIF(TRIM(r.email), '') IS NOT NULL AND LOWER(TRIM(r.email)) = v_email THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(TRIM(r.house_no), '') IS NOT NULL AND public.normalize_resident_claim(r.house_no) = public.normalize_resident_claim(v_house_no) THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(TRIM(r.phone), '') IS NOT NULL AND v_phone IS NOT NULL AND public.normalize_resident_phone(r.phone) = public.normalize_resident_phone(v_phone) THEN 1 ELSE 0 END +
        CASE WHEN r.birthday IS NOT NULL AND p_birthday IS NOT NULL AND r.birthday = p_birthday THEN 1 ELSE 0 END +
        CASE WHEN r.age IS NOT NULL AND v_age IS NOT NULL AND r.age = v_age THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(TRIM(COALESCE(r.sex, r.gender, '')), '') IS NOT NULL AND NULLIF(TRIM(COALESCE(p_sex, '')), '') IS NOT NULL AND public.normalize_resident_claim(COALESCE(r.sex, r.gender)) = public.normalize_resident_claim(p_sex) THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(TRIM(r.purok), '') IS NOT NULL AND v_purok IS NOT NULL AND public.normalize_resident_claim(r.purok) = public.normalize_resident_claim(v_purok) THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(TRIM(r.household_no), '') IS NOT NULL AND v_household_no IS NOT NULL AND public.normalize_resident_claim(r.household_no) = public.normalize_resident_claim(v_household_no) THEN 1 ELSE 0 END
      ) AS match_score,
      (
        (NULLIF(TRIM(r.email), '') IS NOT NULL AND LOWER(TRIM(r.email)) <> v_email) OR
        (NULLIF(TRIM(r.house_no), '') IS NOT NULL AND public.normalize_resident_claim(r.house_no) <> public.normalize_resident_claim(v_house_no)) OR
        (NULLIF(TRIM(r.phone), '') IS NOT NULL AND v_phone IS NOT NULL AND public.normalize_resident_phone(r.phone) <> public.normalize_resident_phone(v_phone)) OR
        (r.birthday IS NOT NULL AND p_birthday IS NOT NULL AND r.birthday <> p_birthday) OR
        (r.birthday IS NULL AND p_birthday IS NULL AND r.age IS NOT NULL AND v_age IS NOT NULL AND r.age <> v_age) OR
        (NULLIF(TRIM(COALESCE(r.sex, r.gender, '')), '') IS NOT NULL AND NULLIF(TRIM(COALESCE(p_sex, '')), '') IS NOT NULL AND public.normalize_resident_claim(COALESCE(r.sex, r.gender)) <> public.normalize_resident_claim(p_sex)) OR
        (NULLIF(TRIM(r.purok), '') IS NOT NULL AND v_purok IS NOT NULL AND public.normalize_resident_claim(r.purok) <> public.normalize_resident_claim(v_purok)) OR
        (NULLIF(TRIM(r.household_no), '') IS NOT NULL AND v_household_no IS NOT NULL AND public.normalize_resident_claim(r.household_no) <> public.normalize_resident_claim(v_household_no))
      ) AS has_conflict,
      (
        (NULLIF(TRIM(r.email), '') IS NOT NULL AND LOWER(TRIM(r.email)) = v_email) OR
        (NULLIF(TRIM(r.house_no), '') IS NOT NULL AND public.normalize_resident_claim(r.house_no) = public.normalize_resident_claim(v_house_no)) OR
        (NULLIF(TRIM(r.phone), '') IS NOT NULL AND v_phone IS NOT NULL AND public.normalize_resident_phone(r.phone) = public.normalize_resident_phone(v_phone)) OR
        (r.birthday IS NOT NULL AND p_birthday IS NOT NULL AND r.birthday = p_birthday) OR
        (r.age IS NOT NULL AND v_age IS NOT NULL AND r.age = v_age)
      ) AS has_identity_anchor
    FROM public.residents AS r
    WHERE r.status = 'Active'
      AND public.normalize_resident_claim(
        COALESCE(NULLIF(TRIM(r.full_name), ''), CONCAT_WS(' ', r.first_name, r.middle_name, r.last_name))
      ) = public.normalize_resident_claim(v_full_name)
  )
  SELECT *
  INTO v_match
  FROM candidates AS candidate
  WHERE NOT has_conflict
    AND has_identity_anchor
    AND match_score >= 2
  ORDER BY candidate.match_score DESC, candidate.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.residents
    SET email = COALESCE(NULLIF(TRIM(email), ''), v_email),
        house_no = COALESCE(NULLIF(TRIM(house_no), ''), v_house_no),
        phone = COALESCE(NULLIF(TRIM(phone), ''), v_phone),
        birthday = COALESCE(birthday, p_birthday),
        age = COALESCE(age, v_age),
        sex = COALESCE(NULLIF(TRIM(sex), ''), NULLIF(TRIM(COALESCE(p_sex, '')), '')),
        gender = COALESCE(NULLIF(TRIM(gender), ''), NULLIF(TRIM(COALESCE(p_sex, '')), '')),
        purok = COALESCE(NULLIF(TRIM(purok), ''), v_purok),
        household_no = COALESCE(NULLIF(TRIM(household_no), ''), v_household_no),
        relationship_to_household_head = COALESCE(NULLIF(TRIM(relationship_to_household_head), ''), v_household_relationship),
        birthplace = COALESCE(NULLIF(TRIM(birthplace), ''), v_birthplace),
        educational_attainment = COALESCE(NULLIF(TRIM(educational_attainment), ''), v_educational_attainment),
        occupation = COALESCE(NULLIF(TRIM(occupation), ''), v_occupation),
        civil_status = COALESCE(NULLIF(TRIM(civil_status), ''), v_civil_status),
        address = COALESCE(NULLIF(TRIM(address), ''), v_address),
        is_4ps_member = COALESCE(is_4ps_member, p_is_4ps_member),
        is_solo_parent = COALESCE(is_solo_parent, p_is_solo_parent),
        is_pwd = COALESCE(is_pwd, p_is_pwd),
        pwd_type = COALESCE(NULLIF(TRIM(pwd_type), ''), CASE WHEN p_is_pwd THEN v_pwd_type ELSE NULL END),
        status = 'Active',
        updated_at = NOW()
    WHERE public.residents.id = v_match.id
    RETURNING *
    INTO v_resident;

    RETURN QUERY SELECT
      'approved'::TEXT,
      'Your information matched the admin resident list. Your Gmail and house number are now linked for resident login.'::TEXT,
      v_resident.id,
      v_resident.full_name,
      v_resident.last_name,
      v_resident.first_name,
      v_resident.middle_name,
      v_resident.email,
      v_resident.phone,
      v_resident.house_no,
      v_resident.household_no,
      v_resident.birthday,
      v_resident.age,
      v_resident.sex,
      v_resident.gender,
      v_resident.purok,
      v_resident.address,
      v_resident.status;
    RETURN;
  END IF;

  SELECT *
  INTO v_resident
  FROM public.residents AS r
  WHERE r.status = 'Pending'
    AND LOWER(TRIM(r.email)) = v_email
    AND public.normalize_resident_claim(r.house_no) = public.normalize_resident_claim(v_house_no)
  ORDER BY r.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      'pending'::TEXT,
      'Your registration is already pending admin verification.'::TEXT,
      v_resident.id,
      v_resident.full_name,
      v_resident.last_name,
      v_resident.first_name,
      v_resident.middle_name,
      v_resident.email,
      v_resident.phone,
      v_resident.house_no,
      v_resident.household_no,
      v_resident.birthday,
      v_resident.age,
      v_resident.sex,
      v_resident.gender,
      v_resident.purok,
      v_resident.address,
      v_resident.status;
    RETURN;
  END IF;

  v_name_parts := regexp_split_to_array(v_full_name, '\s+');
  v_first_name := v_name_parts[1];
  v_last_name := CASE WHEN array_length(v_name_parts, 1) > 1 THEN v_name_parts[array_length(v_name_parts, 1)] ELSE NULL END;

  IF array_length(v_name_parts, 1) > 2 THEN
    SELECT string_agg(part, ' ' ORDER BY ordinality)
    INTO v_middle_name
    FROM unnest(v_name_parts) WITH ORDINALITY AS parts(part, ordinality)
    WHERE ordinality > 1
      AND ordinality < array_length(v_name_parts, 1);
  END IF;

  INSERT INTO public.residents (
    full_name,
    first_name,
    middle_name,
    last_name,
    email,
    phone,
    house_no,
    household_no,
    relationship_to_household_head,
    birthday,
    age,
    sex,
    gender,
    birthplace,
    educational_attainment,
    occupation,
    is_4ps_member,
    is_solo_parent,
    civil_status,
    is_pwd,
    pwd_type,
    purok,
    address,
    status
  )
  VALUES (
    v_full_name,
    v_first_name,
    v_middle_name,
    v_last_name,
    v_email,
    v_phone,
    v_house_no,
    v_household_no,
    v_household_relationship,
    p_birthday,
    v_age,
    NULLIF(TRIM(COALESCE(p_sex, '')), ''),
    NULLIF(TRIM(COALESCE(p_sex, '')), ''),
    v_birthplace,
    v_educational_attainment,
    v_occupation,
    COALESCE(p_is_4ps_member, FALSE),
    COALESCE(p_is_solo_parent, FALSE),
    v_civil_status,
    COALESCE(p_is_pwd, FALSE),
    CASE WHEN COALESCE(p_is_pwd, FALSE) THEN v_pwd_type ELSE NULL END,
    v_purok,
    v_address,
    'Pending'
  )
  RETURNING *
  INTO v_resident;

  RETURN QUERY SELECT
    'pending'::TEXT,
    'No exact admin resident record matched your registration. Please wait for admin approval before accessing the resident dashboard.'::TEXT,
    v_resident.id,
    v_resident.full_name,
    v_resident.last_name,
    v_resident.first_name,
    v_resident.middle_name,
    v_resident.email,
    v_resident.phone,
    v_resident.house_no,
    v_resident.household_no,
    v_resident.birthday,
    v_resident.age,
    v_resident.sex,
    v_resident.gender,
    v_resident.purok,
    v_resident.address,
    v_resident.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_resident_account(
  TEXT, TEXT, TEXT, TEXT, DATE, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT
) TO anon, authenticated, service_role;

-- Ensure your admin account can pass the app's role check after login.
-- Create the Auth user first in Supabase Auth > Users, then run this setup script.
INSERT INTO public.user_profiles (id, role, registration_status)
SELECT id, 'admin', 'Active'
FROM auth.users
WHERE email = 'calambarusseljay5@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role,
    registration_status = EXCLUDED.registration_status,
    resident_id = NULL,
    updated_at = NOW();

-- Only the authorized admin Auth user may keep the admin role.
UPDATE public.user_profiles
SET role = 'resident',
    updated_at = NOW()
WHERE role = 'admin'
  AND id NOT IN (
    SELECT id
    FROM auth.users
    WHERE LOWER(email) = LOWER('calambarusseljay5@gmail.com')
  );

-- Requested resident import.
-- Gmail values are generated from the resident name, and house/household numbers
-- follow the "No." column. Phone numbers are left blank for later editing.
WITH resident_seed (
  full_name,
  last_name,
  first_name,
  middle_name,
  email,
  phone,
  house_no,
  household_no,
  relationship_to_household_head,
  birthday,
  age,
  sex,
  gender,
  birthplace,
  educational_attainment,
  occupation,
  purok,
  address,
  status
) AS (
  VALUES
    ('Fermin Caparpon Cabanero', 'Cabanero', 'Fermin', 'Caparpon', 'fermincaparponcabanero@gmail.com', NULL::TEXT, '10', '10', 'Head', DATE '1998-07-07', NULL::INTEGER, 'Male', 'Male', 'Leon, Iloilo, Antipas', 'Graduate', 'Farmer', NULL::TEXT, 'Leon, Iloilo, Antipas', 'Active'),
    ('Hernita (Nenita) Camat Cabilogan', 'Cabilogan', 'Hernita (Nenita)', 'Camat', 'hernitanenitacamatcabilogan@gmail.com', NULL::TEXT, '11', '11', 'Head', DATE '1954-04-27', 47, 'Female', 'Female', 'U. Mingading, Pikit, Cotabato', 'Elementary Level / Vocational Course Graduate', 'Housekeeper', 'U. Mingading', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Domingo Jr. Camat Cabilogan', 'Cabilogan', 'Domingo Jr.', 'Camat', 'domingojrcamatcabilogan@gmail.com', NULL::TEXT, '11', '11', 'Sibling', DATE '1979-07-18', NULL::INTEGER, 'Male', 'Male', 'U. Mingading, Pikit, Cotabato', NULL::TEXT, 'Security Guard', 'U. Mingading', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Ramon Torre Cabilogan', 'Cabilogan', 'Ramon', 'Torre', 'ramontorrecabilogan@gmail.com', NULL::TEXT, '12', '12', 'Head', DATE '1962-07-30', 41, 'Male', 'Male', 'Sta. Cruz, Pikit, Cotabato', 'Elementary Graduate', 'Farmer', NULL::TEXT, 'Sta. Cruz, Pikit, Cotabato', 'Active'),
    ('Julie Cataruna Cabilogan', 'Cabilogan', 'Julie', 'Cataruna', 'juliecatarunacabilogan@gmail.com', NULL::TEXT, '12', '12', 'Spouse', DATE '1960-10-21', 43, 'Female', 'Female', 'U. Mingading, Pikit, Cotabato', 'High School Level', 'Housekeeper', 'U. Mingading', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Jenevey Cataruna Cabilogan', 'Cabilogan', 'Jenevey', 'Cataruna', 'jeneveycatarunacabilogan@gmail.com', NULL::TEXT, '12', '12', 'Sibling', DATE '1992-04-07', 28, 'Female', 'Female', 'U. Mingading, Pikit, Cotabato', 'High School Graduate', 'Housekeeper', 'U. Mingading', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Angie Rose Cataruna Cabilogan', 'Cabilogan', 'Angie Rose', 'Cataruna', 'angierosecatarunacabilogan@gmail.com', NULL::TEXT, '13', '13', 'Head', DATE '1992-04-05', 26, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'College Level', 'OFW', 'U. Mingading', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Michrel Cataruna Cabilogan', 'Cabilogan', 'Michrel', 'Cataruna', 'michrelcatarunacabilogan@gmail.com', NULL::TEXT, '13', '13', 'Sibling', DATE '2012-05-22', 21, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'Senior High Graduate', 'DSWD Staff', 'U. Mingading', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Mark Angelo Cabilogan Cabilogan', 'Cabilogan', 'Mark Angelo', 'Cabilogan', 'markangelocabilogancabilogan@gmail.com', NULL::TEXT, '13', '13', 'Sibling', DATE '2018-10-05', 5, 'Male', 'Male', 'U. Mingading, Arakan, Cotabato', 'Grade 1', 'Student', 'U. Mingading', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Mark Euhan Basa', 'Basa', 'Mark Euhan', NULL::TEXT, 'markeuhanbasa@gmail.com', NULL::TEXT, NULL::TEXT, NULL::TEXT, 'Sibling', DATE '2019-12-28', 4, 'Male', 'Male', NULL::TEXT, 'Kindergarten', 'Student', NULL::TEXT, NULL::TEXT, 'Active'),
    ('Melchor Camat Cabilogan', 'Cabilogan', 'Melchor', 'Camat', 'melchorcamatcabilogan@gmail.com', NULL::TEXT, '15', '15', 'Head', DATE '1981-01-06', 43, 'Male', 'Male', 'U. Mingading, Pikit, Cotabato', 'High School Graduate', 'Farmer', 'U. Mingading', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Bernadette Baja Cabilogan', 'Cabilogan', 'Bernadette', 'Baja', 'bernadettebajacabilogan@gmail.com', NULL::TEXT, '15', '15', 'Spouse', DATE '1982-04-29', 42, 'Female', 'Female', 'Libungan, Bukidnon', 'High School Graduate', 'Sales Lady', NULL::TEXT, 'Libungan, Bukidnon', 'Active'),
    ('Mary Glory Grace Baja Cabilogan', 'Cabilogan', 'Mary Glory Grace', 'Baja', 'maryglorygracebajacabilogan@gmail.com', NULL::TEXT, '15', '15', 'Sibling', DATE '2013-04-25', 11, 'Female', 'Female', 'Amas Hospital, Kidapawan City', 'Grade 5', 'Student', NULL::TEXT, 'Amas Hospital, Kidapawan City', 'Active'),
    ('Ariel Cañete Calamba', 'Calamba', 'Ariel', 'Cañete', 'ariel.calamba16@gmail.com', NULL::TEXT, '#16', '16', 'Head', DATE '1980-08-22', 43, 'Male', 'Male', 'U. Mingading, Pikit, Cotabato', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Manolito Fullero Calamba', 'Calamba', 'Manolito', 'Fullero', 'manolito.calamba16@gmail.com', NULL::TEXT, '#16', '16', 'Spouse', DATE '1974-04-16', 49, 'Female', 'Female', 'U. Mingading, Pikit, Cotabato', 'High School Graduate', 'Housewife', 'Kamonsil', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Marilou Fullero Calamba', 'Calamba', 'Marilou', 'Fullero', 'marilou.calamba16@gmail.com', NULL::TEXT, '#16', '16', 'Sibling', DATE '1976-06-14', 47, 'Female', 'Female', 'U. Mingading, Pikit, Cotabato', 'Grade 11', 'Student', 'Kamonsil', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Cheriel Fullero Calamba', 'Calamba', 'Cheriel', 'Fullero', 'cheriel.calamba16@gmail.com', NULL::TEXT, '#16', '16', 'Sibling', DATE '2001-04-30', 21, 'Female', 'Female', 'U. Mingading, Pikit, Cotabato', 'Grade 11', 'Student', 'Kamonsil', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Edmar Andres Calamba', 'Calamba', 'Edmar', 'Andres', 'edmar.calamba17@gmail.com', NULL::TEXT, '#17', '17', 'Head', DATE '1980-08-07', 45, 'Male', 'Male', 'U. Mingading, Pikit, Cotabato', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Precissia Tadios Calamba', 'Calamba', 'Precissia', 'Tadios', 'precissia.calamba17@gmail.com', NULL::TEXT, '#17', '17', 'Spouse', DATE '2004-08-08', 18, 'Female', 'Female', 'U. Mingading, Pikit, Cotabato', 'Grade 9', 'Student', 'Kamonsil', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Emor Agudera Calamba', 'Calamba', 'Emor', 'Agudera', 'emor.calamba17@gmail.com', NULL::TEXT, '#17', '17', 'Sibling', DATE '2020-01-01', 5, 'Male', 'Male', 'U. Mingading, Pikit, Cotabato', 'Elementary Level', 'Student', 'Kamonsil', 'U. Mingading, Pikit, Cotabato', 'Active'),
    ('Esfelon Galarcon Calamba', 'Calamba', 'Esfelon', 'Galarcon', 'esfelon.calamba18@gmail.com', NULL::TEXT, '#18', '18', 'Head', DATE '1977-02-27', 48, 'Male', 'Male', 'U. Mingading, Arakan, Cotabato', 'Elementary Level', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Maria Talaman Calamba', 'Calamba', 'Maria', 'Talaman', 'maria.calamba18@gmail.com', NULL::TEXT, '#18', '18', 'Spouse', DATE '1954-06-11', 70, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'Elementary Graduate', 'Housewife', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Michael Talaman Calamba', 'Calamba', 'Michael', 'Talaman', 'michael.calamba18@gmail.com', NULL::TEXT, '#18', '18', 'Sibling', DATE '1980-12-30', 44, 'Male', 'Male', 'U. Mingading, Arakan, Cotabato', 'High School Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Jayson Talaman Calamba', 'Calamba', 'Jayson', 'Talaman', 'jayson.calamba18@gmail.com', NULL::TEXT, '#18', '18', 'Sibling', DATE '1982-08-21', 42, 'Male', 'Male', 'U. Mingading, Arakan, Cotabato', 'High School Graduate', 'Soldering', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Rany Jay Talaman Calamba', 'Calamba', 'Rany Jay', 'Talaman', 'ranyjay.calamba18@gmail.com', NULL::TEXT, '#18', '18', 'Sibling', DATE '1994-01-15', 30, 'Male', 'Male', 'U. Mingading, Arakan, Cotabato', 'High School Graduate', 'Bag Vendor', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Jeanny Guitchellan Galarcon', 'Galarcon', 'Jeanny', 'Guitchellan', 'jeanny.galarcon19@gmail.com', NULL::TEXT, '#19', '19', 'Head', DATE '1983-03-13', 41, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Jennefer Guitchellan Galarcon', 'Galarcon', 'Jennefer', 'Guitchellan', 'jennefer.galarcon19@gmail.com', NULL::TEXT, '#19', '19', 'Spouse', DATE '1992-01-21', 30, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'High School Graduate', 'Housewife', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Shien Nicole Guitardo Galarcon', 'Galarcon', 'Shien Nicole', 'Guitardo', 'shiennicole.galarcon19@gmail.com', NULL::TEXT, '#19', '19', 'Sibling', DATE '2014-01-05', 10, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'Grade 2', 'Student', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Maribel Galarcon Calamba', 'Calamba', 'Maribel', 'Galarcon', 'maribel.calamba20@gmail.com', NULL::TEXT, '#20', '20', 'Head', DATE '1978-05-20', 47, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'High School Graduate', 'Housewife', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Stevany Galarcon Calamba', 'Calamba', 'Stevany', 'Galarcon', 'stevany.calamba20@gmail.com', NULL::TEXT, '#20', '20', 'Sibling', DATE '2000-04-18', 24, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'High School Graduate', 'Housewife', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Princess Galarcon Calamba', 'Calamba', 'Princess', 'Galarcon', 'princess.calamba20@gmail.com', NULL::TEXT, '#20', '20', 'Sibling', DATE '2002-03-08', 22, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'High School Graduate', 'Student', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Jessa Galarcon Calamba', 'Calamba', 'Jessa', 'Galarcon', 'jessa.calamba20@gmail.com', NULL::TEXT, '#20', '20', 'Sibling', DATE '2005-03-09', 19, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'Senior High Graduate', 'Student', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Terrylyn Galarcon Calamba', 'Calamba', 'Terrylyn', 'Galarcon', 'terrylyn.calamba20@gmail.com', NULL::TEXT, '#20', '20', 'Sibling', DATE '2008-01-15', 15, 'Female', 'Female', 'U. Mingading, Arakan, Cotabato', 'Senior High Level', 'Student', 'Kamonsil', 'U. Mingading, Arakan, Cotabato', 'Active'),
    ('Lele Mark Ian Cathum Calamba', 'Calamba', 'Lele Mark Ian', 'Cathum', 'lelemarkian.calamba21@gmail.com', NULL::TEXT, '#21', '21', 'Head', DATE '1998-04-18', 26, 'Male', 'Male', 'ADN, Arakan, Cotabato', 'High School Graduate', 'Construction', 'Kamonsil', 'ADN, Arakan, Cotabato', 'Active'),
    ('Regine Lepardo Calamba', 'Calamba', 'Regine', 'Lepardo', 'regine.calamba21@gmail.com', NULL::TEXT, '#21', '21', 'Sibling', DATE '2008-10-10', 17, 'Female', 'Female', 'ADN, Arakan, Cotabato', 'High School Level', 'Student', 'Kamonsil', 'ADN, Arakan, Cotabato', 'Active'),
    ('Angeles Cabiangan Colambo', 'Colambo', 'Angeles', 'Cabiangan', 'angeles.colambo22@gmail.com', NULL::TEXT, '#22', '22', 'Head', DATE '1972-11-01', 51, 'Female', 'Female', 'Tepodanan, Ilomavis, Kidapawan', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'Tepodanan, Ilomavis, Kidapawan', 'Active'),
    ('Roger Cambal Calamba', 'Calamba', 'Roger', 'Cambal', 'roger.calamba23@gmail.com', NULL::TEXT, '#23', '23', 'Head', DATE '1968-12-26', 56, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Melanie Telloro Calamba', 'Calamba', 'Melanie', 'Telloro', 'melanie.calamba23@gmail.com', NULL::TEXT, '#23', '23', 'Spouse', DATE '1987-12-04', 36, 'Female', 'Female', 'Malapang, Arakan', 'High School Level', 'Housekeeper', 'Kamonsil', 'Malapang, Arakan', 'Active'),
    ('Alven Telloro Calamba', 'Calamba', 'Alven', 'Telloro', 'alven.calamba23@gmail.com', NULL::TEXT, '#23', '23', 'Sibling', DATE '2003-03-06', 16, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 12', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Laurence Telloro Calamba', 'Calamba', 'Laurence', 'Telloro', 'laurence.calamba23@gmail.com', NULL::TEXT, '#23', '23', 'Sibling', DATE '2008-11-24', 15, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 10', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Rufa May Talaman Calamba', 'Calamba', 'Rufa May', 'Talaman', 'rufamay.calamba24@gmail.com', NULL::TEXT, '#24', '24', 'Head', DATE '1998-02-23', 24, 'Female', 'Female', 'U. Mingading, Arakan', 'College Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Bhrent Sebastian Calamba Calamba', 'Calamba', 'Bhrent Sebastian', 'Calamba', 'bhrentsebastian.calamba24@gmail.com', NULL::TEXT, '#24', '24', 'Sibling', DATE '2020-06-15', 4, 'Male', 'Male', 'U. Mingading, Arakan', 'Day Care', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Marivic Pacaco Calicaran', 'Calicaran', 'Marivic', 'Pacaco', 'marivic.calicaran25@gmail.com', NULL::TEXT, '#25', '25', 'Head', DATE '1984-09-27', 39, 'Female', 'Female', 'U. Mingading, Arakan', 'College Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Michael James Calicaran Mingao', 'Mingao', 'Michael James', 'Calicaran', 'michaeljames.mingao25@gmail.com', NULL::TEXT, '#25', '25', 'Sibling', DATE '2001-05-17', 19, 'Male', 'Male', 'Midsayap, Cotabato', '2nd Year College', 'Student', 'Kamonsil', 'Midsayap, Cotabato', 'Active'),
    ('John Paul Calicaran Mingao', 'Mingao', 'John Paul', 'Calicaran', 'johnpaul.mingao25@gmail.com', NULL::TEXT, '#25', '25', 'Sibling', DATE '2006-01-12', 18, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 12', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Athica Gwen Pacao Calicaran', 'Calicaran', 'Athica Gwen', 'Pacao', 'athicagwen.calicaran25@gmail.com', NULL::TEXT, '#25', '25', 'Sibling', DATE '2009-04-24', 14, 'Female', 'Female', 'CRMC, Cotabato', 'Grade 10', 'Student', 'Kamonsil', 'CRMC, Cotabato', 'Active'),
    ('Bismarie Calicaran Avilla', 'Avilla', 'Bismarie', 'Calicaran', 'bismarie.avilla25@gmail.com', NULL::TEXT, '#25', '25', 'Sibling', DATE '2020-08-08', 4, 'Female', 'Female', 'U. Mingading, Arakan', NULL::TEXT, NULL::TEXT, 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Rodrigo Calawigan Calicaran', 'Calicaran', 'Rodrigo', 'Calawigan', 'rodrigo.calicaran26@gmail.com', NULL::TEXT, '#26', '26', 'Head', DATE '1946-07-01', 77, 'Male', 'Male', 'Leon, Iloilo', 'High School Level', 'Farmer', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Elsa Pacao Calicaran', 'Calicaran', 'Elsa', 'Pacao', 'elsa.calicaran26@gmail.com', NULL::TEXT, '#26', '26', 'Spouse', DATE '1949-02-24', 75, 'Female', 'Female', 'Bagulbas, Midsayap', 'High School Level', 'Housekeeper', 'Kamonsil', 'Bagulbas, Midsayap', 'Active'),
    ('Vergelio Cambal Calamba', 'Calamba', 'Vergelio', 'Cambal', 'vergelio.calamba27@gmail.com', NULL::TEXT, '#27', '27', 'Head', DATE '1962-03-20', 64, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Level', 'Farming', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Nelda Camat Calamba', 'Calamba', 'Nelda', 'Camat', 'nelda.calamba27@gmail.com', NULL::TEXT, '#27', '27', 'Spouse', DATE '1963-07-22', 60, 'Female', 'Female', 'U. Mingading, Pikit', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Roger Calawigan Calicaran', 'Calicaran', 'Roger', 'Calawigan', 'roger.calicaran28@gmail.com', NULL::TEXT, '#28', '28', 'Head', DATE '1973-09-29', 50, 'Male', 'Male', 'U. Mingading, Midsayap', 'Elementary Level', 'Farming', 'Kamonsil', 'U. Mingading, Midsayap', 'Active'),
    ('Roda Calawigan Calicaran', 'Calicaran', 'Roda', 'Calawigan', 'roda.calicaran28@gmail.com', NULL::TEXT, '#28', '28', 'Spouse', DATE '1972-04-22', 53, 'Female', 'Female', 'ARPO, Midsayap', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'ARPO, Midsayap', 'Active'),
    ('Jane Calawigan Calicaran', 'Calicaran', 'Jane', 'Calawigan', 'jane.calicaran28@gmail.com', NULL::TEXT, '#28', '28', 'Sibling', DATE '1991-03-13', 32, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 10', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Jeremie Calawigan Calicaran', 'Calicaran', 'Jeremie', 'Calawigan', 'jeremie.calicaran28@gmail.com', NULL::TEXT, '#28', '28', 'Sibling', DATE '2002-12-13', 22, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 12', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Prince Shane Calawigan Calicaran', 'Calicaran', 'Prince Shane', 'Calawigan', 'princeshane.calicaran29@gmail.com', NULL::TEXT, '#29', '29', 'Head', DATE '1982-08-28', 42, 'Male', 'Male', 'Leon, Iloilo', 'High School Level', 'Farmer', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Princes Agudera Calicaran', 'Calicaran', 'Princes', 'Agudera', 'princes.calicaran29@gmail.com', NULL::TEXT, '#29', '29', 'Spouse', DATE '1983-08-08', 40, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Kent Vincent Talaman Calicaran', 'Calicaran', 'Kent Vincent', 'Talaman', 'kentvincent.calicaran29@gmail.com', NULL::TEXT, '#29', '29', 'Sibling', DATE '2003-11-04', 20, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 10', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Kurt Talaman Calicaran', 'Calicaran', 'Kurt', 'Talaman', 'kurt.calicaran29@gmail.com', NULL::TEXT, '#29', '29', 'Sibling', DATE '2008-04-11', 15, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 2', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Danilda Equillas Camat', 'Camat', 'Danilda', 'Equillas', 'danilda.camat30@gmail.com', NULL::TEXT, '#30', '30', 'Head', DATE '1963-01-13', 61, 'Female', 'Female', 'San Isidro, Makilala', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'San Isidro, Makilala', 'Active'),
    ('Danilo Equillas Camat', 'Camat', 'Danilo', 'Equillas', 'danilo.camat30@gmail.com', NULL::TEXT, '#30', '30', 'Spouse', DATE '1966-01-20', 58, 'Male', 'Male', 'Leon, Iloilo', '2nd Year College', 'Driver', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Hernan Calawigan Camat', 'Camat', 'Hernan', 'Calawigan', 'hernan.camat31@gmail.com', NULL::TEXT, '#31', '31', 'Head', DATE '1968-08-25', 55, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Bernadeth Calawigan Camat', 'Camat', 'Bernadeth', 'Calawigan', 'bernadeth.camat31@gmail.com', NULL::TEXT, '#31', '31', 'Spouse', DATE '1972-08-19', 52, 'Female', 'Female', 'U. Mingading, Pikit', 'High School Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Ian Jay Calawigan Camat', 'Camat', 'Ian Jay', 'Calawigan', 'ianjay.camat31@gmail.com', NULL::TEXT, '#31', '31', 'Sibling', DATE '1995-03-28', 29, 'Male', 'Male', 'U. Mingading, Pikit', 'College Level', 'Bag Supplier', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Juvelyn Calawigan Camat', 'Camat', 'Juvelyn', 'Calawigan', 'juvelyn.camat31@gmail.com', NULL::TEXT, '#31', '31', 'Sibling', DATE '1999-04-14', 25, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housewife', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Russel Calawigan Camat', 'Camat', 'Russel', 'Calawigan', 'russel.camat31@gmail.com', NULL::TEXT, '#31', '31', 'Sibling', DATE '2003-06-11', 21, 'Male', 'Male', 'U. Mingading, Arakan', '3rd Year College', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Karen Grace Calawigan Camat', 'Camat', 'Karen Grace', 'Calawigan', 'karengrace.camat31@gmail.com', NULL::TEXT, '#31', '31', 'Sibling', DATE '2011-04-28', 13, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 6', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Paris Camat', 'Camat', 'Paris', NULL::TEXT, 'paris.camat32@gmail.com', NULL::TEXT, '#32', '32', 'Head', DATE '1972-03-02', 52, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Maricel Camat', 'Camat', 'Maricel', NULL::TEXT, 'maricel.camat32@gmail.com', NULL::TEXT, '#32', '32', 'Spouse', DATE '1978-03-10', 46, 'Female', 'Female', 'U. Mingading, Pikit', 'High School Graduate', 'Housewife', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Ivan Cris Camat', 'Camat', 'Ivan Cris', NULL::TEXT, 'ivancris.camat32@gmail.com', NULL::TEXT, '#32', '32', 'Sibling', DATE '1998-06-10', 26, 'Male', 'Male', 'U. Mingading, Arakan', 'College Graduate', 'DSWD Staff', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Erson Camat', 'Camat', 'Erson', NULL::TEXT, 'erson.camat32@gmail.com', NULL::TEXT, '#32', '32', 'Sibling', DATE '2000-07-30', 24, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Teacher', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Liezyl Camat', 'Camat', 'Liezyl', NULL::TEXT, 'liezyl.camat32@gmail.com', NULL::TEXT, '#32', '32', 'Sibling', DATE '2005-05-06', 19, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 12', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Lady Gill Camat', 'Camat', 'Lady Gill', NULL::TEXT, 'ladygill.camat32@gmail.com', NULL::TEXT, '#32', '32', 'Sibling', DATE '2008-05-19', 16, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 10', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Dando Jr. Camat', 'Camat', 'Dando Jr.', NULL::TEXT, 'dandojr.camat33@gmail.com', NULL::TEXT, '#33', '33', 'Sibling', DATE '2014-10-14', 9, 'Male', 'Male', NULL::TEXT, 'Grade 4', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Eduardo Caballero Camat', 'Camat', 'Eduardo', 'Caballero', 'eduardo.camat34@gmail.com', NULL::TEXT, '#34', '34', 'Head', DATE '1971-06-25', 52, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Graduate', 'Farming', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Euberta Caballero Camat', 'Camat', 'Euberta', 'Caballero', 'euberta.camat34@gmail.com', NULL::TEXT, '#34', '34', 'Spouse', DATE '1979-08-24', 45, 'Female', 'Female', 'Concepcion, Midsayap', 'High School Level', 'Housekeeper', 'Kamonsil', 'Concepcion, Midsayap', 'Active'),
    ('Brandon James Caballero Camat', 'Camat', 'Brandon James', 'Caballero', 'brandonjames.camat34@gmail.com', NULL::TEXT, '#34', '34', 'Sibling', DATE '2013-09-15', 10, 'Male', 'Male', 'Concepcion, Midsayap', 'Grade 4', 'Student', 'Kamonsil', 'Concepcion, Midsayap', 'Active'),
    ('Shella Caballero Camat', 'Camat', 'Shella', 'Caballero', 'shella.camat34@gmail.com', NULL::TEXT, '#34', '34', 'Sibling', DATE '2015-02-02', 8, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 2', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Geronimo Guerrero Camat', 'Camat', 'Geronimo', 'Guerrero', 'geronimo.camat35@gmail.com', NULL::TEXT, '#35', '35', 'Head', DATE '1949-11-29', 75, 'Male', 'Male', 'Leon, Iloilo', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Teodora Camat Camat', 'Camat', 'Teodora', 'Camat', 'teodora.camat35@gmail.com', NULL::TEXT, '#35', '35', 'Spouse', DATE '1950-08-27', 74, 'Female', 'Female', 'Bagulbas, Pikit', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'Bagulbas, Pikit', 'Active'),
    ('Roger Calamba Camat', 'Camat', 'Roger', 'Calamba', 'roger.camat36@gmail.com', NULL::TEXT, '#36', '36', 'Head', DATE '1972-01-17', 47, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Vivien Calamba Camat', 'Camat', 'Vivien', 'Calamba', 'vivien.camat36@gmail.com', NULL::TEXT, '#36', '36', 'Spouse', DATE '1968-11-05', 56, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Janice Cara Calamba Camat', 'Camat', 'Janice Cara', 'Calamba', 'janicecara.camat36@gmail.com', NULL::TEXT, '#36', '36', 'Sibling', DATE '2002-04-12', 22, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 10', 'Seller', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Venice Cleah Calamba Camat', 'Camat', 'Venice Cleah', 'Calamba', 'venicecleah.camat36@gmail.com', NULL::TEXT, '#36', '36', 'Sibling', DATE '2012-09-22', 12, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 7', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ryan Jay Moe Tangin Camat', 'Camat', 'Ryan Jay Moe', 'Tangin', 'ryanjaymoe.camat37@gmail.com', NULL::TEXT, '#37', '37', 'Head', DATE '1992-02-03', 32, 'Male', 'Male', 'U. Mingading, Arakan', 'College Level', 'Laborer', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Rugina Ponte Camat', 'Camat', 'Rugina', 'Ponte', 'rugina.camat37@gmail.com', NULL::TEXT, '#37', '37', 'Spouse', DATE '2000-10-18', 24, 'Female', 'Female', 'ADN, Kidapawan', 'College Level', 'Farmer', 'Kamonsil', 'ADN, Kidapawan', 'Active'),
    ('Teopisto Jr. Calamba Camat', 'Camat', 'Teopisto Jr.', 'Calamba', 'teopistojr.camat38@gmail.com', NULL::TEXT, '#38', '38', 'Head', DATE '1969-11-28', 54, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Diane Tanion Camat', 'Camat', 'Diane', 'Tanion', 'diane.camat38@gmail.com', NULL::TEXT, '#38', '38', 'Spouse', DATE '1978-05-23', 45, 'Female', 'Female', 'Upper Bulatukan, Midsayap', '3rd Year College', 'Housekeeper', 'Kamonsil', 'Upper Bulatukan, Midsayap', 'Active'),
    ('Ron Carlton Equillas Camat', 'Camat', 'Ron Carlton', 'Equillas', 'roncarlton.camat38@gmail.com', NULL::TEXT, '#38', '38', 'Sibling', DATE '2004-06-22', 20, 'Male', 'Male', 'Norala, South Cotabato', 'Grade 12', 'Student', 'Kamonsil', 'Norala, South Cotabato', 'Active'),
    ('Johnmarc Kim Equillas Camat', 'Camat', 'Johnmarc Kim', 'Equillas', 'johnmarckim.camat38@gmail.com', NULL::TEXT, '#38', '38', 'Sibling', DATE '2008-04-10', 16, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 10', NULL::TEXT, 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Kyle Rogers Camat', 'Camat', 'Kyle', 'Rogers', 'kyle.camat38@gmail.com', NULL::TEXT, '#38', '38', 'Sibling', DATE '2013-04-24', 11, 'Male', 'Male', 'U. Mingading, Arakan', 'Elementary Level', NULL::TEXT, 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Gloria Cajudo Camat', 'Camat', 'Gloria', 'Cajudo', 'gloria.camat39@gmail.com', NULL::TEXT, '#39', '39', 'Head', DATE '1947-05-09', 76, 'Female', 'Female', 'Leon, Iloilo', 'Elementary Level', 'Housekeeper', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Orlando Jr. Camat Camanaya', 'Camanaya', 'Orlando Jr.', 'Camat', 'orlandojr.camanaya40@gmail.com', NULL::TEXT, '#40', '40', 'Head', DATE '1981-11-23', 43, 'Male', 'Male', 'U. Mingading, Midsayap', 'High School Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Midsayap', 'Active'),
    ('Herminda Camat Camanaya', 'Camanaya', 'Herminda', 'Camat', 'herminda.camanaya40@gmail.com', NULL::TEXT, '#40', '40', 'Spouse', DATE '1988-01-28', 36, 'Female', 'Female', 'U. Mingading, Midsayap', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Midsayap', 'Active'),
    ('Mark Christian Camat Camanaya', 'Camanaya', 'Mark Christian', 'Camat', 'markchristian.camanaya40@gmail.com', NULL::TEXT, '#40', '40', 'Sibling', DATE '2014-03-17', 9, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 4', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Divine Grace Camat Camanaya', 'Camanaya', 'Divine Grace', 'Camat', 'divinegrace.camanaya40@gmail.com', NULL::TEXT, '#40', '40', 'Sibling', DATE '2017-07-16', 6, 'Female', 'Female', 'Poblacion, Makilala', 'Kindergarten 2', 'Student', 'Kamonsil', 'Poblacion, Makilala', 'Active'),
    ('Albert Sr. Cabaries Camino', 'Camino', 'Albert Sr.', 'Cabaries', 'albertsr.camino41@gmail.com', NULL::TEXT, '#41', '41', 'Head', DATE '1961-04-26', 63, 'Male', 'Male', 'Leon, Iloilo', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Mariel Calamba Camino', 'Camino', 'Mariel', 'Calamba', 'mariel.camino41@gmail.com', NULL::TEXT, '#41', '41', 'Spouse', DATE '1968-05-15', 56, 'Female', 'Female', 'U. Mingading, Arakan', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Sheila Mae Calamba Camino', 'Camino', 'Sheila Mae', 'Calamba', 'sheilamae.camino41@gmail.com', NULL::TEXT, '#41', '41', 'Sibling', DATE '1986-06-12', 37, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 10', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Jaden Jr. Calamba Camino', 'Camino', 'Jaden Jr.', 'Calamba', 'jadenjr.camino41@gmail.com', NULL::TEXT, '#41', '41', 'Sibling', DATE '2011-01-30', 13, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 7', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Nico Calamba Camino', 'Camino', 'Nico', 'Calamba', 'nico.camino41@gmail.com', NULL::TEXT, '#41', '41', 'Sibling', DATE '2014-01-25', 10, 'Male', 'Male', NULL::TEXT, 'Grade 6', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Imelda Capilitan Cumagig', 'Cumagig', 'Imelda', 'Capilitan', 'imelda.cumagig42@gmail.com', NULL::TEXT, '#42', '42', 'Head', DATE '1976-08-16', 48, 'Female', 'Female', 'Quezon, Bukidnon', 'Elementary Level', 'Farming', 'Kamonsil', 'Quezon, Bukidnon', 'Active'),
    ('Anel Capilitan Cumagig', 'Cumagig', 'Anel', 'Capilitan', 'anel.cumagig42@gmail.com', NULL::TEXT, '#42', '42', 'Spouse', DATE '1977-04-12', 47, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Arnel Capilitan Cumagig', 'Cumagig', 'Arnel', 'Capilitan', 'arnel.cumagig42@gmail.com', NULL::TEXT, '#42', '42', 'Sibling', DATE '2002-07-30', 21, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 2', 'DSWD Staff', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Arrian Capilitan Cumagig', 'Cumagig', 'Arrian', 'Capilitan', 'arrian.cumagig42@gmail.com', NULL::TEXT, '#42', '42', 'Sibling', DATE '2003-09-01', 17, 'Male', 'Male', NULL::TEXT, 'Grade 3', 'DSWD Staff', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Kim Jery Capilitan Cumagig', 'Cumagig', 'Kim Jery', 'Capilitan', 'kimjery.cumagig42@gmail.com', NULL::TEXT, '#42', '42', 'Sibling', DATE '2007-06-16', 14, 'Male', 'Male', NULL::TEXT, 'Grade 5', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Arca Grace Capilitan Cumagig', 'Cumagig', 'Arca Grace', 'Capilitan', 'arcagrace.cumagig43@gmail.com', NULL::TEXT, '#43', '43', 'Sibling', DATE '2015-02-11', 7, 'Female', 'Female', 'New Leon, Pikit', 'Grade 1', 'Student', 'Kamonsil', 'New Leon, Pikit', 'Active'),
    ('Reynald Candelario Cantero', 'Cantero', 'Reynald', 'Candelario', 'reynald.cantero44@gmail.com', NULL::TEXT, '#44', '44', 'Head', DATE '1980-10-19', 44, 'Male', 'Male', 'U. Mingading, Arakan', 'College Graduate', 'DSWD Staff', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Monina Calamba Campos', 'Campos', 'Monina', 'Calamba', 'monina.campos44@gmail.com', NULL::TEXT, '#44', '44', 'Spouse', DATE '1982-05-12', 42, 'Female', 'Female', 'Makilala, Bukidnon', 'Grade 10', 'Housekeeper', 'Kamonsil', 'Makilala, Bukidnon', 'Active'),
    ('Loreta Cantila Confesor', 'Confesor', 'Loreta', 'Cantila', 'loreta.confesor45@gmail.com', NULL::TEXT, '#45', '45', 'Head', DATE '1946-08-20', 77, 'Female', 'Female', 'Leon, Iloilo', 'Elementary Graduate', 'Farming', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Sotera Calamba Confesor', 'Confesor', 'Sotera', 'Calamba', 'sotera.confesor45@gmail.com', NULL::TEXT, '#45', '45', 'Spouse', DATE '1950-10-21', 73, 'Female', 'Female', 'Kinamada, Pikit', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'Kinamada, Pikit', 'Active'),
    ('Norberto Calamba Confesor', 'Confesor', 'Norberto', 'Calamba', 'norberto.confesor45@gmail.com', NULL::TEXT, '#45', '45', 'Sibling', DATE '1970-06-29', 54, 'Male', 'Male', 'Leon, Iloilo', 'High School Graduate', 'Gardener', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Galicano Mac Calacong Cantomayor', 'Cantomayor', 'Galicano Mac', 'Calacong', 'galicanomac.cantomayor46@gmail.com', NULL::TEXT, '#46', '46', 'Head', DATE '1969-07-19', 55, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'DSWD Staff', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Gladdy Gay Calacong Cantomayor', 'Cantomayor', 'Gladdy Gay', 'Calacong', 'gladdygay.cantomayor46@gmail.com', NULL::TEXT, '#46', '46', 'Sibling', DATE '2007-04-23', 17, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 10', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Eduardo Calicaran Capulutan', 'Capulutan', 'Eduardo', 'Calicaran', 'eduardo.capulutan47@gmail.com', NULL::TEXT, '#47', '47', 'Head', DATE '1950-09-22', 73, 'Male', 'Male', 'Bagulbas, Pikit', 'High School Graduate', 'Carpenter', 'Kamonsil', 'Bagulbas, Pikit', 'Active'),
    ('Carolina Cahul Capulutan', 'Capulutan', 'Carolina', 'Cahul', 'carolina.capulutan47@gmail.com', NULL::TEXT, '#47', '47', 'Spouse', DATE '1952-05-27', 71, 'Female', 'Female', 'Leon, Iloilo', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Rene Cajudol Capulutan', 'Capulutan', 'Rene', 'Cajudol', 'rene.capulutan47@gmail.com', NULL::TEXT, '#47', '47', 'Sibling', DATE '1988-12-01', 30, 'Female', 'Female', 'U. Mingading, Arakan', 'Elementary Level', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Generoso Calicaran Capulutan', 'Capulutan', 'Generoso', 'Calicaran', 'generoso.capulutan48@gmail.com', NULL::TEXT, '#48', '48', 'Head', DATE '1945-05-03', 79, 'Male', 'Male', 'Leon, Iloilo', 'High School Graduate', 'Farmer', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Elisa Calamba Capulutan', 'Capulutan', 'Elisa', 'Calamba', 'elisa.capulutan48@gmail.com', NULL::TEXT, '#48', '48', 'Spouse', DATE '1947-07-07', 77, 'Female', 'Female', 'U. Mingading, Arakan', 'Elementary Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Generosas Calamba Capulutan', 'Capulutan', 'Generosas', 'Calamba', 'generosas.capulutan48@gmail.com', NULL::TEXT, '#48', '48', 'Sibling', DATE '1977-10-10', 46, 'Female', 'Female', 'Macaubuan, Mamasapano', 'Grade 11', 'Housekeeper', 'Kamonsil', 'Macaubuan, Mamasapano', 'Active'),
    ('Gerio Sr. Calamba Capulutan', 'Capulutan', 'Gerio Sr.', 'Calamba', 'geriosr.capulutan49@gmail.com', NULL::TEXT, '#49', '49', 'Head', DATE '1957-07-30', 66, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Jonalyn Camino Capulutan', 'Capulutan', 'Jonalyn', 'Camino', 'jonalyn.capulutan49@gmail.com', NULL::TEXT, '#49', '49', 'Spouse', DATE '1964-06-10', 59, 'Female', 'Female', 'ARPO, Midsayap', 'High School Level', 'Housekeeper', 'Kamonsil', 'ARPO, Midsayap', 'Active'),
    ('Gerio Jr. Camino Capulutan', 'Capulutan', 'Gerio Jr.', 'Camino', 'geriojr.capulutan49@gmail.com', NULL::TEXT, '#49', '49', 'Sibling', DATE '2014-11-15', 9, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 3', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Princess Jean Nina Camino Capulutan', 'Capulutan', 'Princess Jean Nina', 'Camino', 'princessjeannina.capulutan49@gmail.com', NULL::TEXT, '#49', '49', 'Sibling', DATE '2014-04-30', 11, 'Female', 'Female', 'Lilangan, Kabacan', 'Grade 3', 'Student', 'Kamonsil', 'Lilangan, Kabacan', 'Active'),
    ('Jannie Camino Capulutan', 'Capulutan', 'Jannie', 'Camino', 'jannie.capulutan50@gmail.com', NULL::TEXT, '#50', '50', 'Sibling', DATE '2022-10-13', 2, 'Male', 'Male', 'U. Mingading, Midsayap', 'Day Care', 'Student', 'Kamonsil', 'U. Mingading, Midsayap', 'Active'),
    ('Grave Calamba Capulutan', 'Capulutan', 'Grave', 'Calamba', 'grave.capulutan51@gmail.com', NULL::TEXT, '#51', '51', 'Head', DATE '1970-04-08', 53, 'Male', 'Male', 'U. Macasandig, Arakan', 'High School Graduate', 'Laborer', 'Kamonsil', 'U. Macasandig, Arakan', 'Active'),
    ('Annalyn Calamba Telloro', 'Telloro', 'Annalyn', 'Calamba', 'annalyn.telloro51@gmail.com', NULL::TEXT, '#51', '51', 'Spouse', DATE '1990-04-03', 34, 'Female', 'Female', 'U. Macasandig, Arakan', 'College Graduate', 'Housekeeper', 'Kamonsil', 'U. Macasandig, Arakan', 'Active'),
    ('Princess Athena Telloro Capulutan', 'Capulutan', 'Princess Athena', 'Telloro', 'princessathena.capulutan51@gmail.com', NULL::TEXT, '#51', '51', 'Sibling', DATE '2008-12-29', 15, 'Female', 'Female', 'ADN, Kidapawan', NULL::TEXT, NULL::TEXT, 'Kamonsil', 'ADN, Kidapawan', 'Active'),
    ('Rene Glen Talaman Capulutan', 'Capulutan', 'Rene Glen', 'Talaman', 'reneglen.capulutan52@gmail.com', NULL::TEXT, '#52', '52', 'Head', DATE '1977-08-09', 47, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Marivic Calamba Capulutan', 'Capulutan', 'Marivic', 'Calamba', 'marivic.capulutan52@gmail.com', NULL::TEXT, '#52', '52', 'Spouse', DATE '1979-02-05', 45, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Jhan Loo Calamba Capulutan', 'Capulutan', 'Jhan Loo', 'Calamba', 'jhanloo.capulutan52@gmail.com', NULL::TEXT, '#52', '52', 'Sibling', DATE '2007-03-22', 17, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 10', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ben Calamba Capulutan', 'Capulutan', 'Ben', 'Calamba', 'ben.capulutan52@gmail.com', NULL::TEXT, '#52', '52', 'Sibling', DATE '2012-08-12', 12, 'Male', 'Male', 'ARPO, Midsayap', 'Grade 6', 'Student', 'Kamonsil', 'ARPO, Midsayap', 'Active'),
    ('Kyle King Calamba Capulutan', 'Capulutan', 'Kyle King', 'Calamba', 'kyleking.capulutan52@gmail.com', NULL::TEXT, '#52', '52', 'Sibling', DATE '2013-03-21', 11, 'Male', 'Male', 'Kidapawan City Hospital', 'Grade 6', 'Student', 'Kamonsil', 'Kidapawan City Hospital', 'Active'),
    ('Noel Talaman Capulutan', 'Capulutan', 'Noel', 'Talaman', 'noel.capulutan53@gmail.com', NULL::TEXT, '#53', '53', 'Head', DATE '1967-06-11', 56, 'Male', 'Male', 'San Mateo, Norala', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'San Mateo, Norala', 'Active'),
    ('Norlinda Talaman Capulutan', 'Capulutan', 'Norlinda', 'Talaman', 'norlinda.capulutan53@gmail.com', NULL::TEXT, '#53', '53', 'Spouse', DATE '1967-06-22', 56, 'Female', 'Female', 'U. Mingading, Arakan', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ramil Sr. Talaman Capio', 'Capio', 'Ramil Sr.', 'Talaman', 'ramilsr.capio54@gmail.com', NULL::TEXT, '#54', '54', 'Head', DATE '1980-02-11', 44, 'Male', 'Male', 'San Mateo, Norala', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'San Mateo, Norala', 'Active'),
    ('Ramil Jr. Talaman Capio', 'Capio', 'Ramil Jr.', 'Talaman', 'ramiljr.capio54@gmail.com', NULL::TEXT, '#54', '54', 'Sibling', DATE '2016-05-25', 8, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 4', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ruben Vaguias Capio', 'Capio', 'Ruben', 'Vaguias', 'ruben.capio55@gmail.com', NULL::TEXT, '#55', '55', 'Head', DATE '1953-12-05', 40, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Amalia Calamba Capio', 'Capio', 'Amalia', 'Calamba', 'amalia.capio55@gmail.com', NULL::TEXT, '#55', '55', 'Spouse', DATE '1954-01-13', 40, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Surlita Calamba Capio', 'Capio', 'Surlita', 'Calamba', 'surlita.capio55@gmail.com', NULL::TEXT, '#55', '55', 'Sibling', DATE '1984-06-26', 17, 'Female', 'Female', NULL::TEXT, 'Grade 10', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Eunice Calamba Capio', 'Capio', 'Eunice', 'Calamba', 'eunice.capio55@gmail.com', NULL::TEXT, '#55', '55', 'Sibling', DATE '2008-09-25', 15, 'Female', 'Female', NULL::TEXT, 'Grade 12', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Vania Calamba Capio', 'Capio', 'Vania', 'Calamba', 'vania.capio55@gmail.com', NULL::TEXT, '#55', '55', 'Sibling', DATE '2016-03-16', 9, 'Female', 'Female', NULL::TEXT, 'Day Care', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Yassi Calamba Capio', 'Capio', 'Yassi', 'Calamba', 'yassi.capio55@gmail.com', NULL::TEXT, '#55', '55', 'Sibling', DATE '2019-06-16', 7, 'Female', 'Female', NULL::TEXT, 'Grade 2', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Vim D. Garci', 'Garci', 'Vim', 'D.', 'vim.garci56@gmail.com', NULL::TEXT, '#56', '56', 'Head', DATE '2000-04-06', 22, 'Male', 'Male', 'Makilala Amas', 'Grade 10', 'Sari-sari Store', 'Kamonsil', 'Makilala Amas', 'Active'),
    ('Hazel Mae Cabarles Camino', 'Camino', 'Hazel Mae', 'Cabarles', 'hazelmae.camino56@gmail.com', NULL::TEXT, '#56', '56', 'Spouse', DATE '2005-07-04', 19, 'Female', 'Female', 'Amas Hospital, Kidapawan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'Amas Hospital, Kidapawan', 'Active'),
    ('Zepha Rihan Cabarles Carey', 'Carey', 'Zepha Rihan', 'Cabarles', 'zepharihan.carey56@gmail.com', NULL::TEXT, '#56', '56', 'Sibling', DATE '2020-01-27', 3, 'Female', 'Female', NULL::TEXT, 'Grade 1', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Endrequita Calamba Calapate', 'Calapate', 'Endrequita', 'Calamba', 'endrequita.calapate57@gmail.com', NULL::TEXT, '#57', '57', 'Head', DATE '1937-02-10', 88, 'Female', 'Female', 'Leon, Iloilo', 'Elementary Level', 'Housekeeper', 'Kamonsil', 'Leon, Iloilo', 'Active'),
    ('Emelita Calamba Calapate', 'Calapate', 'Emelita', 'Calamba', 'emelita.calapate57@gmail.com', NULL::TEXT, '#57', '57', 'Spouse', DATE '1962-03-15', 62, 'Female', 'Female', 'U. Mingading, Pikit', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Jovin Capapon Clanto', 'Clanto', 'Jovin', 'Capapon', 'jovin.clanto58@gmail.com', NULL::TEXT, '#58', '58', 'Head', DATE '1969-09-03', 54, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Pensioner', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ester Nena Camat Calamba', 'Calamba', 'Ester Nena', 'Camat', 'esternena.calamba58@gmail.com', NULL::TEXT, '#58', '58', 'Spouse', DATE '1974-04-04', 50, 'Female', 'Female', 'Cotabato Regional Hospital', 'Elementary Graduate', 'Government Employee', 'Kamonsil', 'Cotabato Regional Hospital', 'Active'),
    ('Vin Gabriel Calamba Clanto', 'Clanto', 'Vin Gabriel', 'Calamba', 'vingabriel.clanto58@gmail.com', NULL::TEXT, '#58', '58', 'Sibling', DATE '2018-02-28', 6, 'Male', 'Male', NULL::TEXT, 'Grade 1', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Ariel Talaman Dejelia', 'Dejelia', 'Ariel', 'Talaman', 'ariel.dejelia59@gmail.com', NULL::TEXT, '#59', '59', 'Head', DATE '1948-03-14', 75, 'Male', 'Male', 'Pikit', 'High School Graduate', 'Intelligence Staff', 'Kamonsil', 'Pikit', 'Active'),
    ('Anna Rose Calamba Dejelia', 'Dejelia', 'Anna Rose', 'Calamba', 'annarose.dejelia59@gmail.com', NULL::TEXT, '#59', '59', 'Spouse', DATE '1977-05-10', 45, 'Female', 'Female', 'U. Mingading', NULL::TEXT, 'OFW Seaman', 'Kamonsil', 'U. Mingading', 'Active'),
    ('Kizriel Calamba Dejelia', 'Dejelia', 'Kizriel', 'Calamba', 'kizriel.dejelia59@gmail.com', NULL::TEXT, '#59', '59', 'Sibling', DATE '2003-11-30', 20, 'Male', 'Male', NULL::TEXT, NULL::TEXT, 'Teacher', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Margie Tadiangan Endar', 'Endar', 'Margie', 'Tadiangan', 'margie.endar60@gmail.com', NULL::TEXT, '#60', '60', 'Head', DATE '1976-05-07', 48, 'Female', 'Female', 'U. Mingading, Pikit', 'Elementary Graduate', 'Procurement Staff', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Cariño Sr. Dera Vergara', 'Vergara', 'Cariño Sr.', 'Dera', 'carinosr.vergara60@gmail.com', NULL::TEXT, '#60', '60', 'Spouse', DATE '1945-06-18', 78, 'Male', 'Male', 'Kabacan, Pikit', 'High School Level', 'Driver', 'Kamonsil', 'Kabacan, Pikit', 'Active'),
    ('Rica Juan Jean Dera Vergara', 'Vergara', 'Rica Juan Jean', 'Dera', 'ricajuanjean.vergara60@gmail.com', NULL::TEXT, '#60', '60', 'Sibling', DATE '2010-04-24', 14, 'Female', 'Female', NULL::TEXT, 'Grade 8', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('John Mark Paul Tadique Tadique', 'Tadique', 'John Mark Paul', 'Tadique', 'johnmarkpaul.tadique60@gmail.com', NULL::TEXT, '#60', '60', 'Sibling', DATE '2020-01-20', 4, 'Male', 'Male', 'Magpet', 'Grade 6', 'Student', 'Kamonsil', 'Magpet', 'Active'),
    ('Jayson Bulao Gusalon', 'Gusalon', 'Jayson', 'Bulao', 'jayson.gusalon61@gmail.com', NULL::TEXT, '#61', '61', 'Head', DATE '1994-09-30', 30, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Farmer / Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Sheila Marie Labiang Gusalon', 'Gusalon', 'Sheila Marie', 'Labiang', 'sheilamarie.gusalon61@gmail.com', NULL::TEXT, '#61', '61', 'Spouse', DATE '1994-07-01', 30, 'Female', 'Female', NULL::TEXT, 'High School Graduate', 'Housekeeper', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Prince Zian Kent Labiang Gusalon', 'Gusalon', 'Prince Zian Kent', 'Labiang', 'princeziankent.gusalon61@gmail.com', NULL::TEXT, '#61', '61', 'Sibling', DATE '2018-03-21', 6, 'Male', 'Male', NULL::TEXT, 'Grade 1', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Eura Stephane Labiang Gusalon', 'Gusalon', 'Eura Stephane', 'Labiang', 'eurastephane.gusalon61@gmail.com', NULL::TEXT, '#61', '61', 'Sibling', DATE '2021-05-17', 3, 'Female', 'Female', NULL::TEXT, 'Grade 1', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Princess Ela Labiang Gusalon', 'Gusalon', 'Princess Ela', 'Labiang', 'princessela.gusalon61@gmail.com', NULL::TEXT, '#61', '61', 'Sibling', DATE '2022-06-04', 2, 'Female', 'Female', NULL::TEXT, NULL::TEXT, 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Naomudin Boacamin Kahang', 'Kahang', 'Naomudin', 'Boacamin', 'naomudin.kahang62@gmail.com', NULL::TEXT, '#62', '62', 'Head', DATE '1974-12-29', 49, 'Male', 'Male', 'Parang, Maguindanao', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'Parang, Maguindanao', 'Active'),
    ('Hanisa Calacaman Kahang', 'Kahang', 'Hanisa', 'Calacaman', 'hanisa.kahang62@gmail.com', NULL::TEXT, '#62', '62', 'Spouse', DATE '1979-11-21', 47, 'Female', 'Female', 'Parang, Maguindanao', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'Parang, Maguindanao', 'Active'),
    ('Clyde Jefri Calacaman Kahang', 'Kahang', 'Clyde Jefri', 'Calacaman', 'clydejefri.kahang62@gmail.com', NULL::TEXT, '#62', '62', 'Sibling', DATE '2002-11-03', 14, 'Male', 'Male', 'Pikit', 'Grade 11', 'Driver', 'Kamonsil', 'Pikit', 'Active'),
    ('Renato Garcia Labiang', 'Labiang', 'Renato', 'Garcia', 'renato.labiang63@gmail.com', NULL::TEXT, '#63', '63', 'Head', DATE '1949-12-02', 59, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Nin Edna Capulutan Labiang', 'Labiang', 'Nin Edna', 'Capulutan', 'ninedna.labiang63@gmail.com', NULL::TEXT, '#63', '63', 'Spouse', DATE '1967-04-26', 57, 'Female', 'Female', 'Pagangan, Pikit', 'College Level', 'Housekeeper', 'Kamonsil', 'Pagangan, Pikit', 'Active'),
    ('Francis Mark Capulutan Labiang', 'Labiang', 'Francis Mark', 'Capulutan', 'francismark.labiang63@gmail.com', NULL::TEXT, '#63', '63', 'Sibling', DATE '1994-02-24', 30, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Seller', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Divina Jane Capulutan Labiang', 'Labiang', 'Divina Jane', 'Capulutan', 'divinajane.labiang63@gmail.com', NULL::TEXT, '#63', '63', 'Sibling', DATE '1999-10-19', 25, 'Female', 'Female', NULL::TEXT, '2nd Year College', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('John Andrey Capulutan Labiang', 'Labiang', 'John Andrey', 'Capulutan', 'johnandrey.labiang63@gmail.com', NULL::TEXT, '#63', '63', 'Sibling', DATE '2012-10-14', 12, 'Male', 'Male', NULL::TEXT, 'Grade 5', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Michael Taylar Madsapio', 'Madsapio', 'Michael', 'Taylar', 'michael.madsapio64@gmail.com', NULL::TEXT, '#64', '64', 'Head', DATE '1990-09-07', 34, 'Male', 'Male', 'Polomolok, South Cotabato', 'High School Graduate', 'Builder', 'Kamonsil', 'Polomolok, South Cotabato', 'Active'),
    ('Graciechelle Mae Calamba Madsapio', 'Madsapio', 'Graciechelle Mae', 'Calamba', 'graciechellemae.madsapio64@gmail.com', NULL::TEXT, '#64', '64', 'Spouse', DATE '1999-10-18', 29, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ronald Sumalinog Jangco', 'Jangco', 'Ronald', 'Sumalinog', 'ronald.jangco65@gmail.com', NULL::TEXT, '#65', '65', 'Head', DATE '1974-07-27', 49, 'Male', 'Male', 'Buhangin, Davao', 'High School Graduate', 'Farmer', 'Kamonsil', 'Buhangin, Davao', 'Active'),
    ('Midao Calapate Jangco', 'Jangco', 'Midao', 'Calapate', 'midao.jangco65@gmail.com', NULL::TEXT, '#65', '65', 'Spouse', DATE '1978-02-16', 46, 'Female', 'Female', 'U. Mingading, Pikit', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Wily Benhur Calapate Jangco', 'Jangco', 'Wily Benhur', 'Calapate', 'wilybenhur.jangco65@gmail.com', NULL::TEXT, '#65', '65', 'Sibling', DATE '2004-04-22', 20, 'Male', 'Male', NULL::TEXT, 'Grade 11', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Bernard Art Calapate Jangco', 'Jangco', 'Bernard Art', 'Calapate', 'bernardart.jangco65@gmail.com', NULL::TEXT, '#65', '65', 'Sibling', DATE '2007-07-12', 17, 'Male', 'Male', NULL::TEXT, 'Grade 11', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Lhian Brylle Calapate Jangco', 'Jangco', 'Lhian Brylle', 'Calapate', 'lhianbrylle.jangco65@gmail.com', NULL::TEXT, '#65', '65', 'Sibling', DATE '2010-04-02', 14, 'Male', 'Male', NULL::TEXT, 'Grade 3', 'OFW', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Remmy Bantolo Galump', 'Galump', 'Remmy', 'Bantolo', 'remmy.galump66@gmail.com', NULL::TEXT, '#66', '66', 'Head', DATE '1961-04-05', 63, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Angel Joy Talaman Galump', 'Galump', 'Angel Joy', 'Talaman', 'angeljoy.galump66@gmail.com', NULL::TEXT, '#66', '66', 'Spouse', DATE '1979-05-18', 45, 'Female', 'Female', 'U. Mingading, Arakan', 'College Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ralph Ezekiel Cadawas Delavario', 'Delavario', 'Ralph Ezekiel', 'Cadawas', 'ralphezekiel.delavario66@gmail.com', NULL::TEXT, '#66', '66', 'Sibling', DATE '1999-09-18', 24, 'Male', 'Male', 'ADN, Kidapawan', 'Day Care', 'Student', 'Kamonsil', 'ADN, Kidapawan', 'Active'),
    ('Juner Calapate Pacaco', 'Pacaco', 'Juner', 'Calapate', 'juner.pacaco67@gmail.com', NULL::TEXT, '#67', '67', 'Head', DATE '1958-02-11', 65, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Lourdes Labiang Pacaco', 'Pacaco', 'Lourdes', 'Labiang', 'lourdes.pacaco67@gmail.com', NULL::TEXT, '#67', '67', 'Spouse', DATE '1961-06-11', 63, 'Female', 'Female', 'U. Mingading, Pikit', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Edmund Jr. Calaligan Pacaco', 'Pacaco', 'Edmund Jr.', 'Calaligan', 'edmundjr.pacaco67@gmail.com', NULL::TEXT, '#67', '67', 'Sibling', DATE '1971-11-04', 53, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Intern', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ron Ron Calaligan Pacaco', 'Pacaco', 'Ron Ron', 'Calaligan', 'ronron.pacaco67@gmail.com', NULL::TEXT, '#67', '67', 'Sibling', DATE '1996-10-09', 28, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Sales Staff', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Nester Calaligan Pacaco', 'Pacaco', 'Nester', 'Calaligan', 'nester.pacaco67@gmail.com', NULL::TEXT, '#67', '67', 'Sibling', DATE '2001-03-12', 23, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Edwin Mac Macua Pacaco', 'Pacaco', 'Edwin Mac', 'Macua', 'edwinmac.pacaco68@gmail.com', NULL::TEXT, '#68', '68', 'Head', DATE '1967-02-15', 57, 'Male', 'Male', 'Makilala, North Cotabato', 'High School Graduate', 'Farmer', 'Kamonsil', 'Makilala, North Cotabato', 'Active'),
    ('Farel Melody Macua Pacaco', 'Pacaco', 'Farel Melody', 'Macua', 'farelmelody.pacaco68@gmail.com', NULL::TEXT, '#68', '68', 'Spouse', DATE '1993-05-30', 30, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Sales Staff', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ramil Contemplacion Quime', 'Quime', 'Ramil', 'Contemplacion', 'ramil.quime69@gmail.com', NULL::TEXT, '#69', '69', 'Head', DATE '1959-01-19', 65, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Alona Calumpuer Quime', 'Quime', 'Alona', 'Calumpuer', 'alona.quime69@gmail.com', NULL::TEXT, '#69', '69', 'Spouse', DATE '1968-10-21', 56, 'Female', 'Female', 'U. Mingading, Pikit', 'High School Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Romel June Calumpuer Quime', 'Quime', 'Romel June', 'Calumpuer', 'romeljune.quime69@gmail.com', NULL::TEXT, '#69', '69', 'Sibling', DATE '1990-05-20', 34, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Level', 'Driver', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Kent Justine Calumpuer Quime', 'Quime', 'Kent Justine', 'Calumpuer', 'kentjustine.quime69@gmail.com', NULL::TEXT, '#69', '69', 'Sibling', DATE '2008-09-27', 16, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 7', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Jerel B. Quimno', 'Quimno', 'Jerel', 'B.', 'jerel.quimno70@gmail.com', NULL::TEXT, '#70', '70', 'Head', DATE '1973-05-29', 51, 'Male', 'Male', 'U. Mingading, Arakan', 'College Graduate', 'Businessman', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Leah May Tuburan Quimno', 'Quimno', 'Leah May', 'Tuburan', 'leahmay.quimno70@gmail.com', NULL::TEXT, '#70', '70', 'Spouse', DATE '1965-04-20', 58, 'Female', 'Female', 'U. Mingading, Arakan', 'College Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Donnabel Sr. Dacan Rino', 'Rino', 'Donnabel Sr.', 'Dacan', 'donnabelsr.rino71@gmail.com', NULL::TEXT, '#71', '71', 'Head', DATE '1982-11-24', 41, 'Male', 'Male', 'Tomado, Arakan', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'Tomado, Arakan', 'Active'),
    ('Sheralyn Capulutan Rino', 'Rino', 'Sheralyn', 'Capulutan', 'sheralyn.rino71@gmail.com', NULL::TEXT, '#71', '71', 'Spouse', DATE '1994-09-13', 29, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Alex Capulutan Rino', 'Rino', 'Alex', 'Capulutan', 'alex.rino71@gmail.com', NULL::TEXT, '#71', '71', 'Sibling', DATE '2009-07-14', 15, 'Male', 'Male', NULL::TEXT, 'Grade 8', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Shaira Capulutan Rino', 'Rino', 'Shaira', 'Capulutan', 'shaira.rino71@gmail.com', NULL::TEXT, '#71', '71', 'Sibling', DATE '2014-06-11', 10, 'Female', 'Female', NULL::TEXT, 'Grade 4', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Melcar Capulutan Rino', 'Rino', 'Melcar', 'Capulutan', 'melcar.rino71@gmail.com', NULL::TEXT, '#71', '71', 'Sibling', DATE '2017-04-14', 7, 'Male', 'Male', NULL::TEXT, 'Grade 3', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Nathan Jay Capulutan Rino', 'Rino', 'Nathan Jay', 'Capulutan', 'nathanjay.rino71@gmail.com', NULL::TEXT, '#71', '71', 'Sibling', DATE '2018-06-03', 6, 'Male', 'Male', NULL::TEXT, 'Kindergarten', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Jazzy Sy Capulutan Rino', 'Rino', 'Jazzy Sy', 'Capulutan', 'jazzysy.rino71@gmail.com', NULL::TEXT, '#71', '71', 'Sibling', DATE '2021-02-16', 3, 'Female', 'Female', NULL::TEXT, NULL::TEXT, 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Sammy Tecson Rino', 'Rino', 'Sammy', 'Tecson', 'sammy.rino72@gmail.com', NULL::TEXT, '#72', '72', 'Head', DATE '1963-10-19', 60, 'Male', 'Male', 'Tomado, Arakan', 'High School Graduate', 'Job Order Staff', 'Kamonsil', 'Tomado, Arakan', 'Active'),
    ('Michelle Cantomayor Rino', 'Rino', 'Michelle', 'Cantomayor', 'michelle.rino72@gmail.com', NULL::TEXT, '#72', '72', 'Spouse', DATE '1984-05-10', 38, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ken Ken Cantomayor Rino', 'Rino', 'Ken Ken', 'Cantomayor', 'kenken.rino72@gmail.com', NULL::TEXT, '#72', '72', 'Sibling', DATE '2005-01-24', 19, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 9', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ela Jean Cantomayor Rino', 'Rino', 'Ela Jean', 'Cantomayor', 'elajean.rino72@gmail.com', NULL::TEXT, '#72', '72', 'Sibling', DATE '2012-05-28', 12, 'Female', 'Female', 'CRMC Hospital', 'Grade 6', 'Student', 'Kamonsil', 'CRMC Hospital', 'Active'),
    ('Elah Joy Cantomayor Rino', 'Rino', 'Elah Joy', 'Cantomayor', 'elahjoy.rino72@gmail.com', NULL::TEXT, '#72', '72', 'Sibling', DATE '2012-08-08', 11, 'Female', 'Female', NULL::TEXT, 'Grade 6', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Geraldo Sr. Savaron-on Semma', 'Semma', 'Geraldo Sr.', 'Savaron-on', 'geraldosr.semma73@gmail.com', NULL::TEXT, '#73', '73', 'Head', DATE '1948-05-06', 76, 'Male', 'Male', 'Bukidnon', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'Bukidnon', 'Active'),
    ('Maria Capulutan Semma', 'Semma', 'Maria', 'Capulutan', 'maria.semma73@gmail.com', NULL::TEXT, '#73', '73', 'Spouse', DATE '1955-06-24', 69, 'Female', 'Female', 'U. Mingading, Pikit', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Junito Sr. Capulutan Semma', 'Semma', 'Junito Sr.', 'Capulutan', 'junitost.semma73@gmail.com', NULL::TEXT, '#73', '73', 'Sibling', DATE '1978-10-21', 45, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Sari-sari Store', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Junito Jr. Capulutan Semma', 'Semma', 'Junito Jr.', 'Capulutan', 'junitojr.semma73@gmail.com', NULL::TEXT, '#73', '73', 'Sibling', DATE '2000-10-21', 25, 'Male', 'Male', NULL::TEXT, 'High School Graduate', 'Sari-sari Store', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Jemco Capulutan Semma', 'Semma', 'Jemco', 'Capulutan', 'jemco.semma73@gmail.com', NULL::TEXT, '#73', '73', 'Sibling', DATE '1998-04-29', 26, 'Male', 'Male', NULL::TEXT, 'Grade 10', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Venissa Capulutan Semma', 'Semma', 'Venissa', 'Capulutan', 'venissa.semma73@gmail.com', NULL::TEXT, '#73', '73', 'Sibling', DATE '2009-07-20', 15, 'Female', 'Female', NULL::TEXT, 'Grade 10', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Ronald Capulutan Semma', 'Semma', 'Ronald', 'Capulutan', 'ronald.semma74@gmail.com', NULL::TEXT, '#74', '74', 'Head', DATE '1970-04-20', 53, 'Male', 'Male', 'Alamada, Cotabato', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'Alamada, Cotabato', 'Active'),
    ('Mary Ann Capulutan Semma', 'Semma', 'Mary Ann', 'Capulutan', 'maryann.semma74@gmail.com', NULL::TEXT, '#74', '74', 'Spouse', DATE '2001-06-14', 23, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Mylene Mae Galarpe Semma', 'Semma', 'Mylene Mae', 'Galarpe', 'mylenemae.semma74@gmail.com', NULL::TEXT, '#74', '74', 'Sibling', DATE '2018-09-19', 6, 'Female', 'Female', NULL::TEXT, 'Kindergarten', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Sharmaine Capulutan Semma', 'Semma', 'Sharmaine', 'Capulutan', 'sharmaine.semma74@gmail.com', NULL::TEXT, '#74', '74', 'Sibling', DATE '2020-04-28', 4, 'Female', 'Female', NULL::TEXT, NULL::TEXT, 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Jenefer Camat Tadiogue', 'Tadiogue', 'Jenefer', 'Camat', 'jenefer.tadiogue75@gmail.com', NULL::TEXT, '#75', '75', 'Head', DATE '1983-01-22', 41, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Kelly James Camat Tadiogue', 'Tadiogue', 'Kelly James', 'Camat', 'kellyjames.tadiogue75@gmail.com', NULL::TEXT, '#75', '75', 'Sibling', DATE '2014-06-04', 10, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 3', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ruben Camat Calaligan', 'Calaligan', 'Ruben', 'Camat', 'ruben.calaligan75@gmail.com', NULL::TEXT, '#75', '75', 'Sibling', DATE '1985-01-22', 39, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Graduate', 'OFW', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Rubelyn Catama Calaligan', 'Calaligan', 'Rubelyn', 'Catama', 'rubelyn.calaligan75@gmail.com', NULL::TEXT, '#75', '75', 'Sibling', DATE '1988-08-01', 36, 'Female', 'Female', NULL::TEXT, 'Grade 11', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Junicer Paul Calaligan Tadiogue', 'Tadiogue', 'Junicer Paul', 'Calaligan', 'junicerpaul.tadiogue75@gmail.com', NULL::TEXT, '#75', '75', 'Sibling', DATE '2008-11-18', 16, 'Female', 'Female', NULL::TEXT, NULL::TEXT, 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Josemar Talaman Tadiogue', 'Tadiogue', 'Josemar', 'Talaman', 'josemar.tadiogue76@gmail.com', NULL::TEXT, '#76', '76', 'Head', DATE '1979-02-01', 45, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Heromin Talaman Tadiogue', 'Tadiogue', 'Heromin', 'Talaman', 'heromin.tadiogue76@gmail.com', NULL::TEXT, '#76', '76', 'Spouse', DATE '1969-09-25', 55, 'Male', 'Male', 'Malita, Davao', 'High School Level', 'Construction', 'Kamonsil', 'Malita, Davao', 'Active'),
    ('Kim Christle Talaman Tadiogue', 'Tadiogue', 'Kim Christle', 'Talaman', 'kimchristle.tadiogue76@gmail.com', NULL::TEXT, '#76', '76', 'Sibling', DATE '2008-03-29', 16, 'Male', 'Male', 'Kapalong, Davao', 'High School Graduate', 'Applicant', 'Kamonsil', 'Kapalong, Davao', 'Active'),
    ('Crispin Talaman Tadiogue', 'Tadiogue', 'Crispin', 'Talaman', 'crispin.tadiogue77@gmail.com', NULL::TEXT, '#77', '77', 'Head', DATE '1964-01-18', 59, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Rose Jane Calawin Tadiogue', 'Tadiogue', 'Rose Jane', 'Calawin', 'rosejane.tadiogue77@gmail.com', NULL::TEXT, '#77', '77', 'Spouse', DATE '1965-04-28', 57, 'Female', 'Female', 'U. Mingading, Pikit', 'Elementary Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Norlyn Camino Tadiogue', 'Tadiogue', 'Norlyn', 'Camino', 'norlyn.tadiogue77@gmail.com', NULL::TEXT, '#77', '77', 'Sibling', DATE '2004-07-07', 19, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 11', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Marivic Camino Tadiogue', 'Tadiogue', 'Marivic', 'Camino', 'marivic.tadiogue77@gmail.com', NULL::TEXT, '#77', '77', 'Sibling', DATE '2014-09-10', 10, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 3', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Jobert Camino Tadiogue', 'Tadiogue', 'Jobert', 'Camino', 'jobert.tadiogue77@gmail.com', NULL::TEXT, '#77', '77', 'Sibling', DATE '2002-04-29', 22, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 3', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Carlito Sr. Cabigol Talaman', 'Talaman', 'Carlito Sr.', 'Cabigol', 'carlitosr.talaman78@gmail.com', NULL::TEXT, '#78', '78', 'Head', DATE '1952-01-01', 72, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Antonia Cabigol Talaman', 'Talaman', 'Antonia', 'Cabigol', 'antonia.talaman78@gmail.com', NULL::TEXT, '#78', '78', 'Spouse', DATE '1960-04-28', 65, 'Female', 'Female', 'Con Hesus', 'High School Level', 'Housekeeper', 'Kamonsil', 'Con Hesus', 'Active'),
    ('Dranreb Aldoma Talaman', 'Talaman', 'Dranreb', 'Aldoma', 'dranreb.talaman79@gmail.com', NULL::TEXT, '#79', '79', 'Head', DATE '1998-09-25', 26, 'Male', 'Male', 'U. Mingading, Arakan', 'High School Level', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Jean Aldoma Talaman', 'Talaman', 'Jean', 'Aldoma', 'jean.talaman79@gmail.com', NULL::TEXT, '#79', '79', 'Spouse', DATE '1968-01-03', 56, 'Female', 'Female', NULL::TEXT, NULL::TEXT, 'Teacher', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Jenny May Aldoma Talaman', 'Talaman', 'Jenny May', 'Aldoma', 'jennymay.talaman79@gmail.com', NULL::TEXT, '#79', '79', 'Sibling', DATE '2013-05-08', 10, 'Female', 'Female', NULL::TEXT, 'Grade 5', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Carlito Jr. Cabigol Talaman', 'Talaman', 'Carlito Jr.', 'Cabigol', 'carlitojr.talaman80@gmail.com', NULL::TEXT, '#80', '80', 'Head', DATE '1957-01-10', 67, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Jocelyn Cabrera Talaman', 'Talaman', 'Jocelyn', 'Cabrera', 'jocelyn.talaman80@gmail.com', NULL::TEXT, '#80', '80', 'Spouse', DATE '1966-06-15', 58, 'Female', 'Female', 'Makilala', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'Makilala', 'Active'),
    ('Beverly Cabrera Talaman', 'Talaman', 'Beverly', 'Cabrera', 'beverly.talaman80@gmail.com', NULL::TEXT, '#80', '80', 'Sibling', DATE '1995-05-10', 29, 'Female', 'Female', 'Kabacan', 'High School Graduate', 'OFW', 'Kamonsil', 'Kabacan', 'Active'),
    ('Carlito Sr. Cabrera Talaman', 'Talaman', 'Carlito Sr.', 'Cabrera', 'carlitosr.talaman81@gmail.com', NULL::TEXT, '#81', '81', 'Head', DATE '1957-01-10', 65, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Jocelyn Cabrera Talaman', 'Talaman', 'Jocelyn', 'Cabrera', 'jocelyn.talaman81@gmail.com', NULL::TEXT, '#81', '81', 'Spouse', DATE '1966-06-15', 58, 'Female', 'Female', 'Makilala', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'Makilala', 'Active'),
    ('Jhon Carlo Jr. Cabigol Talaman', 'Talaman', 'Jhon Carlo Jr.', 'Cabigol', 'jhoncarlot.talaman81@gmail.com', NULL::TEXT, '#81', '81', 'Sibling', DATE '1996-12-19', 27, 'Male', 'Male', 'U. Mingading, Arakan', 'Senior High Graduate', 'Driver', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Norberto Talaman Mandapat', 'Mandapat', 'Norberto', 'Talaman', 'norberto.mandapat82@gmail.com', NULL::TEXT, '#82', '82', 'Head', DATE '1972-01-01', 52, 'Male', 'Male', 'Kapalong, Davao', 'High School Graduate', 'Farmer', 'Kamonsil', 'Kapalong, Davao', 'Active'),
    ('Juner Calapate Talaman', 'Talaman', 'Juner', 'Calapate', 'juner.talaman83@gmail.com', NULL::TEXT, '#83', '83', 'Head', DATE '1965-05-31', 59, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Level', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Jaylyn Telloro Talaman', 'Talaman', 'Jaylyn', 'Telloro', 'jaylyn.talaman83@gmail.com', NULL::TEXT, '#83', '83', 'Spouse', DATE '1973-07-06', 50, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Vhon Telloro Talaman', 'Talaman', 'Vhon', 'Telloro', 'vhon.talaman83@gmail.com', NULL::TEXT, '#83', '83', 'Sibling', DATE '2016-11-12', 7, 'Male', 'Male', 'U. Mingading, Arakan', 'Grade 1', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('June Calamba Talaman', 'Talaman', 'June', 'Calamba', 'june.talaman84@gmail.com', NULL::TEXT, '#84', '84', 'Head', DATE '1979-11-24', 44, 'Male', 'Male', 'U. Mingading, Pikit', 'High School Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Joyce Canencia Talaman', 'Talaman', 'Joyce', 'Canencia', 'joyce.talaman84@gmail.com', NULL::TEXT, '#84', '84', 'Spouse', DATE '1980-07-21', 43, 'Female', 'Female', 'San Mateo, Pikit', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'San Mateo, Pikit', 'Active'),
    ('Kriss Jean Canencia Talaman', 'Talaman', 'Kriss Jean', 'Canencia', 'krissjean.talaman84@gmail.com', NULL::TEXT, '#84', '84', 'Sibling', DATE '2006-06-04', 18, 'Female', 'Female', NULL::TEXT, '1st Year College', 'Student', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Kertz Patrece Camino Talaman', 'Talaman', 'Kertz Patrece', 'Camino', 'kertzpatrece.talaman84@gmail.com', NULL::TEXT, '#84', '84', 'Sibling', DATE '2018-09-07', 15, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 9', 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Nemesio Calamba Talaman', 'Talaman', 'Nemesio', 'Calamba', 'nemesio.talaman85@gmail.com', NULL::TEXT, '#85', '85', 'Head', DATE '1962-04-17', 61, 'Male', 'Male', 'U. Mingading, Pikit', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Gloceria Calapate Talaman', 'Talaman', 'Gloceria', 'Calapate', 'gloceria.talaman85@gmail.com', NULL::TEXT, '#85', '85', 'Spouse', DATE '1963-06-15', 62, 'Female', 'Female', 'U. Mingading, Pikit', 'Elementary Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Pikit', 'Active'),
    ('Maris Calapate Talaman', 'Talaman', 'Maris', 'Calapate', 'maris.talaman85@gmail.com', NULL::TEXT, '#85', '85', 'Sibling', DATE '1991-03-09', 33, 'Male', 'Male', 'U. Mingading, Arakan', 'College Graduate', 'Government Employee', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ben Carl Jr. Talaman Cartan', 'Cartan', 'Ben Carl Jr.', 'Talaman', 'bencarljr.cartan85@gmail.com', NULL::TEXT, '#85', '85', 'Sibling', DATE '2018-04-08', 6, 'Male', 'Male', 'NCPC Hospital', 'Kindergarten', 'Student', 'Kamonsil', 'NCPC Hospital', 'Active'),
    ('Jopmel Catiil Telloro', 'Telloro', 'Jopmel', 'Catiil', 'jopmel.telloro86@gmail.com', NULL::TEXT, '#86', '86', 'Head', DATE '1985-04-22', 39, 'Male', 'Male', 'U. Mingading, Arakan', 'Senior High Graduate', 'Sari-sari Store', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Angelene Capulutan Arellano', 'Arellano', 'Angelene', 'Capulutan', 'angelene.arellano86@gmail.com', NULL::TEXT, '#86', '86', 'Spouse', DATE '2006-04-02', 18, 'Female', 'Female', 'U. Mingading, Arakan', 'Grade 10', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Ashley Capulutan Melano Telloro', 'Telloro', 'Ashley', 'Capulutan Melano', 'ashley.telloro86@gmail.com', NULL::TEXT, '#86', '86', 'Sibling', DATE '2022-11-03', 2, 'Female', 'Female', 'U. Mingading, Arakan', NULL::TEXT, 'Student', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Marvin Catiil Telloro', 'Telloro', 'Marvin', 'Catiil', 'marvin.telloro87@gmail.com', NULL::TEXT, '#87', '87', 'Head', DATE '2000-02-02', 24, 'Male', 'Male', 'U. Mingading, Arakan', 'Senior High Graduate', 'Sari-sari Store', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Zira Jien Nicole Baculawan Catarao', 'Catarao', 'Zira Jien Nicole', 'Baculawan', 'ziarienicole.catarao87@gmail.com', NULL::TEXT, '#87', '87', 'Spouse', DATE '2020-12-18', 3, 'Female', 'Female', 'Kathakanon, Arakan', 'Senior High Graduate', 'Housekeeper', 'Kamonsil', 'Kathakanon, Arakan', 'Active'),
    ('Vin Hanz Catama Telloro', 'Telloro', 'Vin Hanz', 'Catama', 'vinhanz.telloro87@gmail.com', NULL::TEXT, '#87', '87', 'Sibling', DATE '2022-09-21', 2, 'Male', 'Male', 'Kathakanon, Arakan', 'Senior High Graduate', 'Construction', 'Kamonsil', 'Kathakanon, Arakan', 'Active'),
    ('Melchor Catiil Telloro', 'Telloro', 'Melchor', 'Catiil', 'melchor.telloro88@gmail.com', NULL::TEXT, '#88', '88', 'Head', DATE '1959-09-14', 64, 'Male', 'Male', 'Malapang, Arakan', 'Elementary Graduate', 'Farmer', 'Kamonsil', 'Malapang, Arakan', 'Active'),
    ('Angelito Jr. Banares Oraiz', 'Oraiz', 'Angelito Jr.', 'Banares', 'angelitojr.oraiz89@gmail.com', NULL::TEXT, '#89', '89', 'Head', DATE '1972-05-15', 52, 'Male', 'Male', 'Banisilon, North Cotabato', 'High School Graduate', 'Construction', 'Kamonsil', 'Banisilon, North Cotabato', 'Active'),
    ('Marged Lilibeth Capulutan Oraiz', 'Oraiz', 'Marged Lilibeth', 'Capulutan', 'margedlilibeth.oraiz89@gmail.com', NULL::TEXT, '#89', '89', 'Spouse', DATE '1975-03-17', 49, 'Female', 'Female', 'U. Mingading, Arakan', 'High School Graduate', 'Housekeeper', 'Kamonsil', 'U. Mingading, Arakan', 'Active'),
    ('Angelito III Capulutan Oraiz', 'Oraiz', 'Angelito III', 'Capulutan', 'angelitoiii.oraiz89@gmail.com', NULL::TEXT, '#89', '89', 'Sibling', DATE '2004-04-05', 20, 'Male', 'Male', NULL::TEXT, 'Associate Graduate', 'Truck Driver', 'Kamonsil', NULL::TEXT, 'Active'),
    ('Rhan Talaman Traque', 'Traque', 'Rhan', 'Talaman', 'rhan.traque90@gmail.com', NULL::TEXT, '#90', '90', 'Head', DATE '1993-06-01', 29, 'Male', 'Male', 'Datu Piang, Maguindanao', NULL::TEXT, 'Farmer', 'Kamonsil', 'Datu Piang, Maguindanao', 'Active'),
    ('Alimah Guimba Traque', 'Traque', 'Alimah', 'Guimba', 'alimah.traque90@gmail.com', NULL::TEXT, '#90', '90', 'Spouse', DATE '2000-10-15', 23, 'Female', 'Female', 'Norala, South Cotabato', 'Day Care', 'Construction', 'Kamonsil', 'Norala, South Cotabato', 'Active'),
    ('Rhamadhani Guimba Traque', 'Traque', 'Rhamadhani', 'Guimba', 'rhamadhani.traque90@gmail.com', NULL::TEXT, '#90', '90', 'Sibling', DATE '2021-10-16', 3, 'Female', 'Female', 'ADN, Arakan', NULL::TEXT, 'Student', 'Kamonsil', 'ADN, Arakan', 'Active')
),
updated_residents AS (
  UPDATE public.residents AS resident
  SET full_name = COALESCE(NULLIF(TRIM(resident.full_name), ''), seed.full_name),
      last_name = COALESCE(NULLIF(TRIM(resident.last_name), ''), seed.last_name),
      first_name = COALESCE(NULLIF(TRIM(resident.first_name), ''), seed.first_name),
      middle_name = COALESCE(NULLIF(TRIM(resident.middle_name), ''), seed.middle_name),
      email = CASE
        WHEN seed.purok = 'Kamonsil' THEN seed.email
        ELSE COALESCE(NULLIF(TRIM(resident.email), ''), seed.email)
      END,
      phone = COALESCE(NULLIF(TRIM(resident.phone), ''), seed.phone),
      house_no = CASE
        WHEN seed.purok = 'Kamonsil' THEN seed.house_no
        ELSE COALESCE(NULLIF(TRIM(resident.house_no), ''), seed.house_no)
      END,
      household_no = CASE
        WHEN seed.purok = 'Kamonsil' THEN seed.household_no
        ELSE COALESCE(NULLIF(TRIM(resident.household_no), ''), seed.household_no)
      END,
      relationship_to_household_head = CASE
        WHEN seed.purok = 'Kamonsil' THEN seed.relationship_to_household_head
        ELSE COALESCE(NULLIF(TRIM(resident.relationship_to_household_head), ''), seed.relationship_to_household_head)
      END,
      birthday = COALESCE(resident.birthday, seed.birthday),
      age = COALESCE(resident.age, seed.age),
      sex = COALESCE(NULLIF(TRIM(resident.sex), ''), seed.sex),
      gender = COALESCE(NULLIF(TRIM(resident.gender), ''), seed.gender),
      birthplace = COALESCE(NULLIF(TRIM(resident.birthplace), ''), seed.birthplace),
      educational_attainment = COALESCE(NULLIF(TRIM(resident.educational_attainment), ''), seed.educational_attainment),
      occupation = COALESCE(NULLIF(TRIM(resident.occupation), ''), seed.occupation),
      purok = COALESCE(NULLIF(TRIM(resident.purok), ''), seed.purok),
      address = COALESCE(NULLIF(TRIM(resident.address), ''), seed.address),
      status = COALESCE(NULLIF(TRIM(resident.status), ''), seed.status),
      updated_at = NOW()
  FROM resident_seed AS seed
  WHERE LOWER(COALESCE(resident.email, '')) = LOWER(seed.email)
     OR (
       public.normalize_resident_claim(resident.full_name) = public.normalize_resident_claim(seed.full_name)
       AND resident.birthday = seed.birthday
     )
  RETURNING seed.email
)
INSERT INTO public.residents (
  full_name,
  last_name,
  first_name,
  middle_name,
  email,
  phone,
  house_no,
  household_no,
  relationship_to_household_head,
  birthday,
  age,
  sex,
  gender,
  birthplace,
  educational_attainment,
  occupation,
  purok,
  address,
  status
)
SELECT seed.full_name,
       seed.last_name,
       seed.first_name,
       seed.middle_name,
       seed.email,
       seed.phone,
       seed.house_no,
       seed.household_no,
       seed.relationship_to_household_head,
       seed.birthday,
       seed.age,
       seed.sex,
       seed.gender,
       seed.birthplace,
       seed.educational_attainment,
       seed.occupation,
       seed.purok,
       seed.address,
       seed.status
FROM resident_seed AS seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.residents AS resident
  WHERE LOWER(COALESCE(resident.email, '')) = LOWER(seed.email)
     OR (
       public.normalize_resident_claim(resident.full_name) = public.normalize_resident_claim(seed.full_name)
       AND resident.birthday = seed.birthday
     )
);

-- Create a table for document templates if needed
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  processing_time TEXT,
  fee TEXT,
  template_file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.document_templates
ADD COLUMN IF NOT EXISTS template_file_path TEXT;

-- Replace sample document templates with the real barangay Word templates.
DELETE FROM public.document_templates
WHERE template_name IN (
  'Barangay Clearance',
  'Certificate of Residency',
  'Business Permit',
  'Barangay ID',
  'Indigency Certificate',
  'Good Moral Certificate',
  'Travel Authority',
  'NBI Clearance Request',
  'Certificate of Indigency',
  'Business Permit Certification',
  'RSBSA Certification',
  'Solo Parent Certification',
  '4Ps Certification'
)
OR document_type IN (
  'Clearance',
  'Residency Certificate',
  'Business Permit',
  'ID Card',
  'Indigency Certificate',
  'Good Moral Certificate',
  'Travel Authority',
  'NBI Clearance',
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'RSBSA Certification',
  'Solo Parent Certification',
  '4Ps Certification'
);

INSERT INTO public.document_templates (
  template_name,
  document_type,
  description,
  requirements,
  processing_time,
  fee,
  template_file_path
)
SELECT sample.template_name,
       sample.document_type,
       sample.description,
       sample.requirements,
       sample.processing_time,
       sample.fee,
       sample.template_file_path
FROM (VALUES
  ('Barangay Clearance', 'Barangay Clearance', 'Official barangay clearance based on existing barangay records and good standing in the community', 'Valid ID; proof of residency; purpose of request', '1 day', 'As assessed by barangay office', '/files/document-templates/cert.barangay-clearance.docx'),
  ('Certificate of Residency', 'Certificate of Residency', 'Certifies that the requester is a bona fide resident of Barangay Upper Mingading', 'Valid ID; proof of residency; purpose of request', '1 day', 'As assessed by barangay office', '/files/document-templates/Cert.Residency-Templates.docx'),
  ('Certificate of Indigency', 'Certificate of Indigency', 'Certifies low-income or indigent status for assistance and official requirements', 'Valid ID; proof of residency; purpose of request', '1 day', 'As assessed by barangay office', '/files/document-templates/Cert.indigency-templates.docx'),
  ('Business Permit', 'Business Permit', 'Barangay certification for business permit application and local business verification', 'Valid ID; barangay clearance; business details; purpose of request', '1 day', 'As assessed by barangay office', '/files/document-templates/Cert.BUSINESS-Permit.docx'),
  ('RSBSA Certification', 'RSBSA Certification', 'Certification for farmers and fisherfolk registration in the Registry System for Basic Sectors in Agriculture', 'Valid ID; farm or crop details; proof of residency', '1 day', 'As assessed by barangay office', '/files/document-templates/cert.Rsbsa-templates.docx'),
  ('Solo Parent Certification', 'Solo Parent Certification', 'Barangay certification supporting solo parent application or related legal purpose', 'Valid ID; proof of residency; supporting solo parent document; purpose of request', '1 day', 'As assessed by barangay office', '/files/document-templates/Cert.-solo-parent-Templates.docx'),
  ('4Ps Certification', '4Ps Certification', 'Barangay certification for Pantawid Pamilyang Pilipino Program or change-grantee requirements', 'Valid ID; proof of residency; 4Ps details; purpose of request', '1 day', 'As assessed by barangay office', '/files/document-templates/Barangay-Cert.templates.-4ps.docx')
) AS sample(template_name, document_type, description, requirements, processing_time, fee, template_file_path);

-- Livelihood programs and job opportunities
CREATE TABLE IF NOT EXISTS public.livelihood_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Program',
  organization TEXT,
  description TEXT,
  eligibility TEXT,
  slots INTEGER,
  location TEXT,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livelihood_posts_category ON public.livelihood_posts(category);
CREATE INDEX IF NOT EXISTS idx_livelihood_posts_status ON public.livelihood_posts(status);
CREATE INDEX IF NOT EXISTS idx_livelihood_posts_deadline ON public.livelihood_posts(deadline);
CREATE INDEX IF NOT EXISTS idx_livelihood_posts_created_at ON public.livelihood_posts(created_at);

INSERT INTO public.livelihood_posts
  (title, category, organization, description, eligibility, slots, location, contact, status, deadline)
SELECT sample.title,
       sample.category,
       sample.organization,
       sample.description,
       sample.eligibility,
       sample.slots,
       sample.location,
       sample.contact,
       sample.status,
       sample.deadline::DATE
FROM (VALUES
  ('TESDA Computer Literacy Training', 'Program', 'Barangay Upper Mingading', 'Basic computer literacy training for residents.', 'Open to residents 18 years old and above', 30, 'Barangay Hall', 'Barangay Office', 'Open', '2026-06-15'),
  ('Community Job Fair', 'Job', 'Municipal PESO', 'Local employers will accept applicants for entry-level positions.', 'Bring resume and valid ID', 80, 'Aleosan Gymnasium', 'PESO Office', 'Open', '2026-06-20'),
  ('Urban Gardening Livelihood Program', 'Program', 'Agriculture Office', 'Starter kits and coaching for backyard vegetable production.', 'Priority for low-income households', 25, 'Barangay Nursery', 'Agriculture Coordinator', 'Open', '2026-07-01')
) AS sample(title, category, organization, description, eligibility, slots, location, contact, status, deadline)
WHERE NOT EXISTS (SELECT 1 FROM public.livelihood_posts);

-- Barangay announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  audience TEXT NOT NULL DEFAULT 'All Residents',
  status TEXT NOT NULL DEFAULT 'Draft',
  publish_date DATE DEFAULT CURRENT_DATE,
  expires_at DATE,
  sms_recipient_phones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS sms_recipient_phones TEXT;

CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_category ON public.announcements(category);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_date ON public.announcements(publish_date);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at);

-- Barangay organizational chart
CREATE TABLE IF NOT EXISTS public.organization_officials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  committee TEXT,
  focus_area TEXT,
  contact TEXT,
  email TEXT,
  photo_url TEXT,
  background TEXT,
  level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_officials_level ON public.organization_officials(level);
CREATE INDEX IF NOT EXISTS idx_organization_officials_sort_order ON public.organization_officials(sort_order);

INSERT INTO public.announcements
(title, body, category, audience, status, publish_date, expires_at)
SELECT sample.title,
       sample.body,
       sample.category,
       sample.audience,
       sample.status,
       sample.publish_date::DATE,
       sample.expires_at::DATE
FROM (VALUES
  ('Job Fair: June 20, 2026', 'Residents are invited to attend the community job fair. Bring a resume and valid ID.', 'Livelihood', 'All Residents', 'Published', '2026-06-01', '2026-06-21'),
  ('Free TESDA Computer Literacy Training', 'Registration is open at the barangay office for free computer literacy training.', 'Training', 'All Residents', 'Published', '2026-06-03', '2026-06-16'),
  ('Clean-Up Drive this Saturday', 'All puroks are encouraged to join the community clean-up drive.', 'Community', 'All Residents', 'Published', '2026-06-05', '2026-06-12')
) AS sample(title, body, category, audience, status, publish_date, expires_at)
WHERE NOT EXISTS (SELECT 1 FROM public.announcements);

-- AI knowledge trainer entries used by resident assistant
CREATE TABLE IF NOT EXISTS public.ai_knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  audience TEXT NOT NULL DEFAULT 'All Residents',
  status TEXT NOT NULL DEFAULT 'Active',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  effective_date DATE,
  expires_at DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_knowledge_source_unique
ON public.ai_knowledge_items(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_status ON public.ai_knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_category ON public.ai_knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_source_type ON public.ai_knowledge_items(source_type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_effective_date ON public.ai_knowledge_items(effective_date);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_expires_at ON public.ai_knowledge_items(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_updated_at ON public.ai_knowledge_items(updated_at);

-- Document request management
CREATE TABLE IF NOT EXISTS public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_requests_status ON public.document_requests(status);
CREATE INDEX IF NOT EXISTS idx_document_requests_created_at ON public.document_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_document_requests_resident_id ON public.document_requests(resident_id);

-- Resident dashboard notifications for completed document requests
CREATE TABLE IF NOT EXISTS public.resident_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  document_request_id UUID REFERENCES public.document_requests(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resident_notifications_resident_id ON public.resident_notifications(resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_notifications_created_at ON public.resident_notifications(created_at);

-- Document requests are intentionally not seeded.

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livelihood_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can read residents" ON public.residents;
DROP POLICY IF EXISTS "Admins can insert residents" ON public.residents;
DROP POLICY IF EXISTS "Residents can submit pending registrations" ON public.residents;
DROP POLICY IF EXISTS "Admins can update residents" ON public.residents;
DROP POLICY IF EXISTS "Admins can delete residents" ON public.residents;
DROP POLICY IF EXISTS "Anyone can read document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Admins can insert document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Admins can update document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Admins can delete document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Anyone can read livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can insert livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can update livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Admins can delete livelihood posts" ON public.livelihood_posts;
DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can read organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can insert organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can update organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Admins can delete organization officials" ON public.organization_officials;
DROP POLICY IF EXISTS "Residents can read active AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can insert AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can update AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Admins can delete AI knowledge" ON public.ai_knowledge_items;
DROP POLICY IF EXISTS "Residents can read own requests" ON public.document_requests;
DROP POLICY IF EXISTS "Residents can create own requests" ON public.document_requests;
DROP POLICY IF EXISTS "Local resident login can read requests" ON public.document_requests;
DROP POLICY IF EXISTS "Local resident login can create requests" ON public.document_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.document_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON public.document_requests;
DROP POLICY IF EXISTS "Residents can read own notifications" ON public.resident_notifications;
DROP POLICY IF EXISTS "Local resident login can read notifications" ON public.resident_notifications;
DROP POLICY IF EXISTS "Local resident login can update notifications" ON public.resident_notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.resident_notifications;
DROP POLICY IF EXISTS "Anyone can read profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read document template files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload document template files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update document template files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete document template files" ON storage.objects;

-- Storage policies for profile photos
CREATE POLICY "Anyone can read profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload own profile photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own profile photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policies for document templates
CREATE POLICY "Anyone can read document template files"
ON storage.objects FOR SELECT
USING (bucket_id = 'document-templates');

CREATE POLICY "Admins can upload document template files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'document-templates'
  AND public.current_user_role() = 'admin'
);

CREATE POLICY "Admins can update document template files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'document-templates'
  AND public.current_user_role() = 'admin'
)
WITH CHECK (
  bucket_id = 'document-templates'
  AND public.current_user_role() = 'admin'
);

CREATE POLICY "Admins can delete document template files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'document-templates'
  AND public.current_user_role() = 'admin'
);

-- RLS policies for user_profiles
CREATE POLICY "Users can read own profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
ON public.user_profiles FOR SELECT
USING (public.current_user_role() = 'admin');

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    role <> 'admin'
    OR public.current_user_role() = 'admin'
  )
);

CREATE POLICY "Service role can insert profiles"
ON public.user_profiles FOR INSERT TO service_role
WITH CHECK (true);

-- RLS policies for residents
CREATE POLICY "Anyone can read residents"
ON public.residents FOR SELECT
USING (true);

CREATE POLICY "Admins can insert residents"
ON public.residents FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Residents can submit pending registrations"
ON public.residents FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'Pending'
  AND NULLIF(TRIM(full_name), '') IS NOT NULL
  AND NULLIF(TRIM(email), '') IS NOT NULL
  AND NULLIF(TRIM(house_no), '') IS NOT NULL
);

CREATE POLICY "Admins can update residents"
ON public.residents FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete residents"
ON public.residents FOR DELETE
USING (public.current_user_role() = 'admin');

-- RLS policies for document_templates
CREATE POLICY "Anyone can read document templates"
ON public.document_templates FOR SELECT
USING (true);

CREATE POLICY "Admins can insert document templates"
ON public.document_templates FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update document templates"
ON public.document_templates FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete document templates"
ON public.document_templates FOR DELETE
USING (public.current_user_role() = 'admin');

-- RLS policies for livelihood_posts
CREATE POLICY "Anyone can read livelihood posts"
ON public.livelihood_posts FOR SELECT
USING (true);

CREATE POLICY "Admins can insert livelihood posts"
ON public.livelihood_posts FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update livelihood posts"
ON public.livelihood_posts FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete livelihood posts"
ON public.livelihood_posts FOR DELETE
USING (public.current_user_role() = 'admin');

-- RLS policies for announcements
CREATE POLICY "Anyone can read announcements"
ON public.announcements FOR SELECT
USING (true);

CREATE POLICY "Admins can insert announcements"
ON public.announcements FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update announcements"
ON public.announcements FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete announcements"
ON public.announcements FOR DELETE
USING (public.current_user_role() = 'admin');

-- RLS policies for organization officials
CREATE POLICY "Anyone can read organization officials"
ON public.organization_officials FOR SELECT
USING (true);

CREATE POLICY "Admins can insert organization officials"
ON public.organization_officials FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update organization officials"
ON public.organization_officials FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete organization officials"
ON public.organization_officials FOR DELETE
USING (public.current_user_role() = 'admin');

-- RLS policies for AI knowledge
CREATE POLICY "Residents can read active AI knowledge"
ON public.ai_knowledge_items FOR SELECT
USING (
  (
    status = 'Active'
    AND COALESCE(audience, 'All Residents') <> 'Admin Only'
    AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
    AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  )
  OR public.current_user_role() = 'admin'
);

CREATE POLICY "Admins can insert AI knowledge"
ON public.ai_knowledge_items FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins can update AI knowledge"
ON public.ai_knowledge_items FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete AI knowledge"
ON public.ai_knowledge_items FOR DELETE
USING (public.current_user_role() = 'admin');

-- RLS policies for document_requests
CREATE POLICY "Residents can read own requests"
ON public.document_requests FOR SELECT
USING (
  resident_id = (SELECT resident_id FROM public.user_profiles WHERE id = auth.uid())
  OR public.current_user_role() = 'admin'
);

CREATE POLICY "Residents can create own requests"
ON public.document_requests FOR INSERT
WITH CHECK (
  resident_id = (SELECT resident_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Capstone local resident login uses residents.email + house_no rather than Supabase Auth.
-- These policies allow that frontend session to create and view its own request records.
CREATE POLICY "Local resident login can read requests"
ON public.document_requests FOR SELECT
USING (true);

CREATE POLICY "Local resident login can create requests"
ON public.document_requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update requests"
ON public.document_requests FOR UPDATE
USING (public.current_user_role() = 'admin')
WITH CHECK (true);

CREATE POLICY "Admins can delete requests"
ON public.document_requests FOR DELETE
USING (public.current_user_role() = 'admin');

-- RLS policies for resident_notifications
CREATE POLICY "Residents can read own notifications"
ON public.resident_notifications FOR SELECT
USING (
  resident_id = (SELECT resident_id FROM public.user_profiles WHERE id = auth.uid())
  OR public.current_user_role() = 'admin'
);

CREATE POLICY "Local resident login can read notifications"
ON public.resident_notifications FOR SELECT
USING (true);

CREATE POLICY "Local resident login can update notifications"
ON public.resident_notifications FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can insert notifications"
ON public.resident_notifications FOR INSERT
WITH CHECK (public.current_user_role() = 'admin');

-- Refresh Supabase/PostgREST's schema cache so new tables are visible immediately.
NOTIFY pgrst, 'reload schema';
