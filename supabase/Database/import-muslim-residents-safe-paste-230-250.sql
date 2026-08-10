-- Safe import for pasted Purok Muslim resident rows, households 230-250.
-- Expected pasted resident rows: 106.
-- This script does NOT delete, archive, or update existing resident records.
-- It only inserts residents that do not already match by full name + household number + birthday.
-- It also creates missing resident portal accounts using the pasted Username column.
-- Temporary resident portal password is household_no, then house_no, then the first 8 characters of the resident ID.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS last_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS middle_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS email TEXT;

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
ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT FALSE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS pwd_type TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS purok TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.resident_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  account_status TEXT NOT NULL DEFAULT 'Active',
  must_change_credentials BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.resident_accounts
ADD COLUMN IF NOT EXISTS must_change_credentials BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.resident_accounts
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_accounts_resident_unique
ON public.resident_accounts(resident_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_accounts_username_unique
ON public.resident_accounts(LOWER(username));

CREATE INDEX IF NOT EXISTS idx_resident_accounts_status
ON public.resident_accounts(account_status);

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

CREATE OR REPLACE FUNCTION public.ensure_unique_resident_username(
  p_preferred_username TEXT,
  p_resident_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_base TEXT := LEFT(public.normalize_resident_username(p_preferred_username), 24);
  v_candidate TEXT;
  v_counter INTEGER := 1;
BEGIN
  IF v_base = '' THEN
    v_base := 'resident' || SUBSTRING(p_resident_id::TEXT FROM 1 FOR 8);
  END IF;

  v_candidate := v_base;

  WHILE EXISTS (
    SELECT 1
    FROM public.resident_accounts AS account
    WHERE LOWER(account.username) = LOWER(v_candidate)
      AND account.resident_id <> p_resident_id
  ) LOOP
    v_counter := v_counter + 1;
    v_candidate := LEFT(v_base, 24) || v_counter::TEXT;
  END LOOP;

  RETURN v_candidate;
END
$$;

WITH raw_source AS (
  SELECT $_muslim_paste$
Household No.,Username,Full Name,Purok,Address,Date of Birth,Age,Sex,Relationship,Birthplace
230,Danny.Solayman,Danny Solayman Rahman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 11, 1979,45,M,Head,Purok Muslim, Aleosan, Cotabato
230,Jeana.Balontero,Jeana Balontero Rahman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 22, 1974,50,F,Spouse,Purok Muslim, Aleosan, Cotabato
230,Majaina.Balontero,Majaina Mae Balontero Rahman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 08, 2001,25,F,Child,Purok Muslim, Aleosan, Cotabato
230,Mariam.Bolatero,Mariam Bolatero Rahman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 03, 2011,15,F,Child,Purok Muslim, Aleosan, Cotabato
230,Marram.Bolatero,Marram Bolatero Rahman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 01, 2015,10,F,Child,Purok Muslim, Aleosan, Cotabato
230,Mohanya.Bolatero,Mohanya Bolatero Rahman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 13, 2017,9,F,Child,Purok Muslim, Aleosan, Cotabato
231,Akmad.Kulintang,Akmad Kulintang Palaguyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 21, 1987,37,M,Head,Purok Muslim, Aleosan, Cotabato
231,Shiela.Lumilis,Shiela Lumilis Palaguyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 10, 1984,40,F,Spouse,Purok Muslim, Aleosan, Cotabato
231,Sheny.Lumilis,Sheny Lumilis Palaguyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 13, 2010,16,F,Child,Purok Muslim, Aleosan, Cotabato
231,Miswari.Kuta,Miswari Kuta Palaguyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 27, 1995,29,M,Child,Purok Muslim, Aleosan, Cotabato
231,Thelma.Kulintang,Thelma Kulintang Palaguyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 11, 1990,34,F,Child,Purok Muslim, Aleosan, Cotabato
231,Naqria.Kulintang,Naqria Kulintang Palaguyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 24, 2018,8,F,Child,Purok Muslim, Aleosan, Cotabato
231,Walid.Kulintang,Walid Kulintang Palaguyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 23, 2019,6,M,Child,Purok Muslim, Aleosan, Cotabato
231,Amer.Kulintang,Amer Kulintang Palaguyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 10, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
232,Alabakar.Gandawali,Alabakar Gandawali Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 01, 1975,49,F,Head,Purok Muslim, Aleosan, Cotabato
232,Tayan.Kuta,Tayan Kuta Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 28, 1979,45,M,Spouse,Purok Muslim, Aleosan, Cotabato
232,Mohamied.Palaman,Mohamied Palaman Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 09, 2004,18,M,Child,Purok Muslim, Aleosan, Cotabato
232,Hamida.Palaman,Hamida Palaman Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 09, 2010,14,F,Child,Purok Muslim, Aleosan, Cotabato
232,Almira.Palaman,Almira Palaman Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 17, 2013,11,F,Child,Purok Muslim, Aleosan, Cotabato
232,Ella.Palaman,Ella Palaman Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 13, 2015,8,F,Child,Purok Muslim, Aleosan, Cotabato
232,Mohamad.Palaman,Mohamad Palaman Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 14, 2018,8,M,Child,Purok Muslim, Aleosan, Cotabato
233,Gerald.Kulintang,Gerald Kulintang Coten,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 24, 1985,39,M,Head,Purok Muslim, Aleosan, Cotabato
233,Zukira.Mamenting,Zukira Mamenting Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 16, 1985,39,F,Spouse,Purok Muslim, Aleosan, Cotabato
233,Benjamin.Mamenting,Benjamin Mamenting Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 22, 2008,18,M,Child,Purok Muslim, Aleosan, Cotabato
233,Rainima.Mamenting,Rainima Mamenting Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 14, 2014,10,F,Child,Purok Muslim, Aleosan, Cotabato
233,Bainot.Mamenting,Bainot Mamenting Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 14, 2014,9,F,Child,Purok Muslim, Aleosan, Cotabato
233,Bea.Mamenting,Bea Mamenting Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 01, 2019,7,F,Child,Purok Muslim, Aleosan, Cotabato
234,Sarpanida.Saripkulongan,Sarpanida Saripkulongan Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 26, 1955,69,F,Head,Purok Muslim, Aleosan, Cotabato
234,Jamaica.Raehman,Jamaica Raehman Hamsea,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 14, 2008,18,F,Child,Purok Muslim, Aleosan, Cotabato
234,Jober.Raehman,Jober Raehman Sakal,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 05, 2011,15,M,Child,Purok Muslim, Aleosan, Cotabato
235,Cory.Sangkulongan,Cory Sangkulongan Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 03, 1977,58,M,Head,Purok Muslim, Aleosan, Cotabato
235,Muslimin.Mamenting,Muslimin Mamenting Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 22, 1972,52,M,Child,Purok Muslim, Aleosan, Cotabato
235,Solbani.Kulintang,Solbani Kulintang Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 07, 1971,53,F,Spouse,Purok Muslim, Aleosan, Cotabato
235,Jemalyn.Balad,Jemalyn Balad Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 24, 1999,27,M,Child,Purok Muslim, Aleosan, Cotabato
235,Jamen.Balad,Jamen Balad Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 08, 2004,22,M,Child,Purok Muslim, Aleosan, Cotabato
236,Jenalyn.Balad,Jenalyn Balad Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 14, 1992,34,F,Head,Purok Muslim, Aleosan, Cotabato
236,Norjana.Raehman,Norjana Raehman Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 24, 2019,5,F,Child,Purok Muslim, Aleosan, Cotabato
236,Norjamil.Raehman,Norjamil Raehman Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 15, 2021,4,F,Child,Purok Muslim, Aleosan, Cotabato
237,Bashe.Lviog,Bashe Lviog Madidhis,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 04, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
237,Muslima.Mamenting,Muslima Mamenting Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 05, 1980,46,F,Spouse,Purok Muslim, Aleosan, Cotabato
237,Baincess.Raehman,Baincess Raehman Madidhis,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 25, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
238,Dahinmolok.Cota,Dahinmolok Cota Dalimbong,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 24, 2005,21,M,Head,Purok Muslim, Aleosan, Cotabato
238,Bailyn.Balad,Bailyn Balad Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 28, 2002,24,F,Spouse,Purok Muslim, Aleosan, Cotabato
238,Batjana.Raehman,Batjana Raehman Dalimbang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 23, 2021,5,F,Child,Purok Muslim, Aleosan, Cotabato
238,Bai.bhair.Roethman,Bai.bhair Roethman Dalimbang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 24, 2008,3,F,Child,Purok Muslim, Aleosan, Cotabato
239,Radzak.Sumisiyad,Radzak Sumisiyad Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 15, 1956,68,M,Head,Purok Muslim, Aleosan, Cotabato
239,Zairana.Balad,Zairana Balad Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 11, 1974,50,F,Spouse,Purok Muslim, Aleosan, Cotabato
239,Nasrohiah.Balad,Nasrohiah Balad Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 26, 1998,28,M,Child,Purok Muslim, Aleosan, Cotabato
239,Nasrudin.Balad,Nasrudin Balad Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 04, 1999,27,M,Child,Purok Muslim, Aleosan, Cotabato
239,Nasir.Balad,Nasir Balad Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 28, 2004,22,M,Child,Purok Muslim, Aleosan, Cotabato
240,Jear.Kulintang,Jear Kulintang Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 07, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
240,Baimanot.Palaman,Baimanot Palaman Patundog,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 15, 1990,36,F,Spouse,Purok Muslim, Aleosan, Cotabato
240,Mohamad.Patundog,Mohamad Patundog Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 17, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
241,Toto.Maoyag,Toto Maoyag Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 20, 1985,41,M,Head,Purok Muslim, Aleosan, Cotabato
241,Aleya.Palagnyan,Aleya Palagnyan Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 24, 1985,41,F,Spouse,Purok Muslim, Aleosan, Cotabato
241,Salmia.Palagnyan,Salmia Palagnyan Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 02, 2004,22,F,Child,Purok Muslim, Aleosan, Cotabato
241,Salymera.Palagnyan,Salymera Palagnyan Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 20, 2006,20,F,Child,Purok Muslim, Aleosan, Cotabato
241,Saima.Palagnyan,Saima Palagnyan Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 30, 2008,18,F,Child,Purok Muslim, Aleosan, Cotabato
242,Tho.Andal,Tho Andal Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 03, 1980,46,M,Head,Purok Muslim, Aleosan, Cotabato
242,Sagira.Sandal,Sagira Sandal Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 05, 1984,42,M,Child,Purok Muslim, Aleosan, Cotabato
242,Abdullo.Jess,Abdullo Jess Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 05, 2003,23,M,Child,Purok Muslim, Aleosan, Cotabato
242,Kaharudin.Bakar,Kaharudin Bakar Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 05, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
242,Harris.Zyma,Harris Zyma Bakar Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 26, 2010,16,M,Child,Purok Muslim, Aleosan, Cotabato
242,Sithie.Zyma,Sithie Zyma Bakar Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 22, 2003,28,F,Child,Purok Muslim, Aleosan, Cotabato
242,Mira.Bakar,Mira Bakar Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 29, 2006,20,F,Child,Purok Muslim, Aleosan, Cotabato
242,Dato.Bakar,Dato Bakar Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 24, 2014,13,F,Child,Purok Muslim, Aleosan, Cotabato
242,Jamil.Bakar,Jamil Bakar Kadingilam,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 24, 2016,9,M,Child,Purok Muslim, Aleosan, Cotabato
243,Jebmin.Balad,Jebmin Balad Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 16, 1991,35,M,Head,Purok Muslim, Aleosan, Cotabato
243,Riya.Subpangan,Riya Subpangan Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 30, 1991,35,F,Spouse,Purok Muslim, Aleosan, Cotabato
243,Nadia.Subpangan,Nadia Subpangan Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 10, 1988,38,F,Child,Purok Muslim, Aleosan, Cotabato
244,Samir.Balad,Samir Balad Palagnyan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 31, 2024,2,M,Head,Purok Muslim, Aleosan, Cotabato
244,Allayso.Palagnyan,Allayso Palagnyan Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 28, 2007,19,M,Child,Purok Muslim, Aleosan, Cotabato
245,Tonnie.Saldo,Tonnie Saldo Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 19, 1974,57,F,Head,Purok Muslim, Aleosan, Cotabato
245,Rosida.Kuta,Rosida Kuta Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 02, 1947,57,M,Spouse,Purok Muslim, Aleosan, Cotabato
245,Tahir.Kuta,Tahir Kuta Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 21, 1947,22,M,Child,Purok Muslim, Aleosan, Cotabato
245,Rohina.Saldo,Rohina Saldo Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 07, 2004,15,F,Child,Purok Muslim, Aleosan, Cotabato
245,Busyai.Saldo,Busyai Saldo Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 15, 2011,47,M,Child,Purok Muslim, Aleosan, Cotabato
245,Alinor.Cota,Alinor Cota Andik,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 10, 2017,9,M,Child,Purok Muslim, Aleosan, Cotabato
246,Rasul.Kuta,Rasul Kuta Salato,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 01, 1989,37,M,Head,Purok Muslim, Aleosan, Cotabato
246,Sonia.Kalis,Sonia Kalis Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 04, 1989,37,F,Spouse,Purok Muslim, Aleosan, Cotabato
246,Hamin.E,Hamin E Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 02, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
246,Hairen.E,Hairen E Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 25, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
247,Salindato.Kalis,Salindato Kalis Saldo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 21, 1970,54,M,Head,Purok Muslim, Aleosan, Cotabato
247,Guniarig.Sado,Guniarig Sado Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 12, 1975,51,F,Spouse,Purok Muslim, Aleosan, Cotabato
247,Gunvapar.Sado,Gunvapar Sado Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 31, 2019,12,M,Child,Purok Muslim, Aleosan, Cotabato
247,Hamid.Sado,Hamid Sado Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 15, 2005,21,M,Child,Purok Muslim, Aleosan, Cotabato
248,Andingan.Kalis,Andingan Kalis Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 21, 1981,45,F,Head,Purok Muslim, Aleosan, Cotabato
248,Sandra.Abidin,Sandra Abidin Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 14, 1992,35,M,Child,Purok Muslim, Aleosan, Cotabato
248,Samidin.Abidin,Samidin Abidin Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 07, 2009,17,M,Child,Purok Muslim, Aleosan, Cotabato
248,Solahudin.Abidin,Solahudin Abidin Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 17, 2011,15,M,Child,Purok Muslim, Aleosan, Cotabato
248,Salamidin.Abidin,Salamidin Abidin Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 30, 2013,13,M,Child,Purok Muslim, Aleosan, Cotabato
248,Samir.Abidin,Samir Abidin Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 05, 2015,11,M,Child,Purok Muslim, Aleosan, Cotabato
248,Ebrahim.Abidin,Ebrahim Abidin Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 01, 2017,9,M,Child,Purok Muslim, Aleosan, Cotabato
248,Alimodien.Abidin,Alimodien Abidin Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 08, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
248,Tombooy.Abidin,Tombooy Abidin Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 03, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
249,Remix.Edsangola,Remix Edsangola Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 20, 1987,37,F,Head,Purok Muslim, Aleosan, Cotabato
249,Nono.Kalim,Nono Kalim Edsangola,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 05, 1989,7,M,Spouse,Purok Muslim, Aleosan, Cotabato
249,Norolyn.Kalim,Norolyn Kalim Edsangola,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 28, 2020,4,M,Child,Purok Muslim, Aleosan, Cotabato
249,Nor.on.Kalim,Nor.on Kalim Edsangola,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 17, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
249,Rapael.Kalim,Rapael Kalim Edsangola,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 05, 2022,4,M,Child,Purok Muslim, Aleosan, Cotabato
250,Komo.Kalim,Komo Kalim Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 18, 1984,40,F,Head,Purok Muslim, Aleosan, Cotabato
250,Paiyan.Saokol,Paiyan Saokol Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 21, 1990,34,F,Child,Purok Muslim, Aleosan, Cotabato
250,Alyonson.Tobo,Alyonson Tobo Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 19, 2008,16,M,Child,Purok Muslim, Aleosan, Cotabato
250,Alicia.Sodol,Alicia Sodol Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 02, 2011,13,F,Child,Purok Muslim, Aleosan, Cotabato
250,Aziz.Sodol,Aziz Sodol Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 05, 2014,10,M,Child,Purok Muslim, Aleosan, Cotabato
250,Gunapo.Sodol,Gunapo Sodol Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 06, 2022,2,M,Child,Purok Muslim, Aleosan, Cotabato
$_muslim_paste$::TEXT AS raw_text
),
raw_lines AS (
  SELECT
    line_data.ordinal AS source_line,
    TRIM(line_data.line) AS line
  FROM raw_source
  CROSS JOIN LATERAL regexp_split_to_table(raw_text, E'\r?\n') WITH ORDINALITY AS line_data(line, ordinal)
  WHERE TRIM(line_data.line) <> ''
),
parsed_lines AS (
  SELECT
    source_line,
    line,
    regexp_match(
      line,
      '^([^,]+),([^,]+),([^,]+),([^,]+),(.+),([A-Za-z]+ \d{1,2}),\s*(\d{4}),(\d+),([MFmf]),([^,]+),(.+)$'
    ) AS parts
  FROM raw_lines
  WHERE source_line > 1
),
resident_seed_base AS (
  SELECT
    source_line,
    TRIM(parts[1]) AS house_no,
    TRIM(parts[1]) AS household_no,
    public.normalize_resident_username(parts[2]) AS username_base,
    TRIM(parts[3]) AS full_name,
    regexp_split_to_array(TRIM(parts[3]), '\s+') AS name_parts,
    to_date(TRIM(parts[6]) || ', ' || TRIM(parts[7]), 'FMMonth DD, YYYY') AS birthday,
    TRIM(parts[8])::INTEGER AS age,
    CASE UPPER(TRIM(parts[9]))
      WHEN 'M' THEN 'Male'
      WHEN 'F' THEN 'Female'
      ELSE NULL
    END AS sex,
    TRIM(parts[10]) AS relationship_to_household_head,
    TRIM(parts[11]) AS birthplace,
    'Muslim'::TEXT AS purok,
    TRIM(parts[5]) AS address
  FROM parsed_lines
  WHERE parts IS NOT NULL
),
resident_seed AS (
  SELECT
    source_line,
    house_no,
    household_no,
    CASE
      WHEN COUNT(*) OVER (PARTITION BY username_base) > 1
        THEN LEFT(username_base, 24) || household_no
      ELSE username_base
    END AS username,
    full_name,
    CASE
      WHEN array_length(name_parts, 1) > 1 THEN name_parts[array_length(name_parts, 1)]
      ELSE NULL
    END AS last_name,
    name_parts[1] AS first_name,
    CASE
      WHEN array_length(name_parts, 1) > 2
        THEN array_to_string(name_parts[2:(array_length(name_parts, 1) - 1)], ' ')
      ELSE NULL
    END AS middle_name,
    NULL::TEXT AS email,
    NULL::TEXT AS phone,
    birthday,
    age,
    sex,
    sex AS gender,
    relationship_to_household_head,
    birthplace,
    NULL::TEXT AS educational_attainment,
    NULL::TEXT AS occupation,
    FALSE AS is_4ps_member,
    FALSE AS is_solo_parent,
    NULL::TEXT AS civil_status,
    FALSE AS is_pwd,
    NULL::TEXT AS pwd_type,
    purok,
    address,
    'Active'::TEXT AS status
  FROM resident_seed_base
),
existing_residents AS (
  SELECT
    resident.id,
    resident.status,
    seed.username,
    resident.house_no,
    resident.household_no
  FROM resident_seed AS seed
  JOIN public.residents AS resident
    ON public.normalize_resident_claim(resident.full_name) = public.normalize_resident_claim(seed.full_name)
   AND public.normalize_resident_claim(COALESCE(resident.household_no, resident.house_no, '')) = public.normalize_resident_claim(seed.household_no)
   AND resident.birthday = seed.birthday
  WHERE COALESCE(resident.status, 'Active') <> 'Archived'
),
inserted_residents AS (
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
    is_4ps_member,
    is_solo_parent,
    civil_status,
    is_pwd,
    pwd_type,
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
         seed.is_4ps_member,
         seed.is_solo_parent,
         seed.civil_status,
         seed.is_pwd,
         seed.pwd_type,
         seed.purok,
         seed.address,
         seed.status
  FROM resident_seed AS seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.residents AS resident
    WHERE public.normalize_resident_claim(resident.full_name) = public.normalize_resident_claim(seed.full_name)
      AND public.normalize_resident_claim(COALESCE(resident.household_no, resident.house_no, '')) = public.normalize_resident_claim(seed.household_no)
      AND resident.birthday = seed.birthday
  )
  RETURNING
    id,
    status,
    full_name,
    house_no,
    household_no,
    birthday
),
inserted_with_usernames AS (
  SELECT
    inserted.id,
    inserted.status,
    seed.username,
    inserted.house_no,
    inserted.household_no
  FROM inserted_residents AS inserted
  JOIN resident_seed AS seed
    ON public.normalize_resident_claim(seed.full_name) = public.normalize_resident_claim(inserted.full_name)
   AND public.normalize_resident_claim(seed.household_no) = public.normalize_resident_claim(inserted.household_no)
   AND seed.birthday = inserted.birthday
),
target_residents AS (
  SELECT * FROM existing_residents
  UNION ALL
  SELECT * FROM inserted_with_usernames
),
created_accounts AS (
  INSERT INTO public.resident_accounts (
    resident_id,
    username,
    password_hash,
    account_status,
    must_change_credentials
  )
  SELECT
    target.id,
    public.ensure_unique_resident_username(target.username, target.id),
    crypt(
      COALESCE(
        NULLIF(TRIM(target.household_no), ''),
        NULLIF(TRIM(target.house_no), ''),
        SUBSTRING(target.id::TEXT FROM 1 FOR 8)
      ),
      gen_salt('bf')
    ),
    CASE WHEN target.status = 'Active' THEN 'Active' ELSE 'Inactive' END,
    TRUE
  FROM target_residents AS target
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.resident_accounts AS account
    WHERE account.resident_id = target.id
  )
  ON CONFLICT (resident_id) DO NOTHING
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM resident_seed) AS parsed_rows,
  (SELECT COUNT(*) FROM parsed_lines WHERE parts IS NULL) AS skipped_rows,
  (SELECT COUNT(*) FROM inserted_residents) AS inserted_residents,
  (SELECT COUNT(*) FROM existing_residents) AS matched_existing_residents,
  (SELECT COUNT(*) FROM created_accounts) AS created_accounts;

NOTIFY pgrst, 'reload schema';
