-- Safe import for pasted Purok Muslim resident rows, households 490-641.
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
  SELECT $_muslim_paste_490_641$
Household No.,Username,Full Name,Purok,Address,Date of Birth,Age,Sex,Relationship,Birthplace
490,Sobdat.Arjo,Sobdat Arjo Guiabar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 07, 1992,32,M,Head,Purok Muslim, Aleosan, Cotabato
491,Hylene.Kalim,Hylene Kalim Guiabar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 24, 1992,32,F,Spouse,Purok Muslim, Aleosan, Cotabato
492,Soraida.Kalim,Soraida Kalim Guiabar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 04, 2015,11,F,Child,Purok Muslim, Aleosan, Cotabato
493,Salahadin.Kalim,Salahadin Kalim Guiabar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 19, 2014,10,M,Child,Purok Muslim, Aleosan, Cotabato
494,Dawod.Kalim,Dawod Kalim Guiabar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 18, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
495,Wapeq.Kalim,Wapeq Kalim Guiabar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 18, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
496,Esmael.Madato,Esmael Madato Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 14, 1961,65,M,Head,Purok Muslim, Aleosan, Cotabato
497,Bebeng.Samama,Bebeng Samama Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 24, 1961,65,F,Spouse,Purok Muslim, Aleosan, Cotabato
498,Monera.Samama,Monera Samama Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 26, 1982,44,F,Child,Purok Muslim, Aleosan, Cotabato
499,Jayriza.Samama,Jayriza Samama Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 11, 1991,35,F,Child,Purok Muslim, Aleosan, Cotabato
500,Monfa.Sippi,Monfa Sippi Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 10, 1985,41,M,Head,Purok Muslim, Aleosan, Cotabato
501,Johara.Andotuan,Johara Andotuan Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 21, 1990,36,F,Spouse,Purok Muslim, Aleosan, Cotabato
502,Jahinzier.Andotuan,Jahinzier Andotuan Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 14, 2020,5,M,Child,Purok Muslim, Aleosan, Cotabato
503,Joinah.Andotuan,Joinah Andotuan Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 28, 2024,2,F,Child,Purok Muslim, Aleosan, Cotabato
504,Jeddah.Andotuan,Jeddah Andotuan Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 28, 2024,2,F,Child,Purok Muslim, Aleosan, Cotabato
505,King.Gandawali,King Gandawali Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 18, 1981,45,M,Head,Purok Muslim, Aleosan, Cotabato
506,Monisa.Kulintang,Monisa Kulintang Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 27, 1987,39,F,Spouse,Purok Muslim, Aleosan, Cotabato
507,Munnaifa.Kulintang,Munnaifa Kulintang Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 08, 2013,13,F,Child,Purok Muslim, Aleosan, Cotabato
508,Mari.For.Kulintang,Mari For Kulintang Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 11, 2014,10,F,Child,Purok Muslim, Aleosan, Cotabato
509,Mohidein.Kulintang,Mohidein Kulintang Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 25, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
510,Jomboy.Luway,Jomboy Luway Cota,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 10, 1969,57,M,Head,Purok Muslim, Aleosan, Cotabato
511,Jomarris.Mamenting,Jomarris Mamenting Samemen,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 07, 2012,14,F,Spouse,Purok Muslim, Aleosan, Cotabato
512,Tombay.Lindongan,Tombay Lindongan Cota,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 10, 1969,57,M,Head,Purok Muslim, Aleosan, Cotabato
513,Joharis.Mamenting,Joharis Mamenting Cota,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 07, 2012,14,F,Spouse,Purok Muslim, Aleosan, Cotabato
514,Jun.Kulintang,Jun Kulintang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 30, 1983,43,M,Head,Purok Muslim, Aleosan, Cotabato
515,Baby.Johaina.Kulintang,Baby Johaina Kulintang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 23, 2007,20,F,Spouse,Purok Muslim, Aleosan, Cotabato
516,Norhaya.Diagao,Norhaya Diagao Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 30, 1984,42,F,Child,Purok Muslim, Aleosan, Cotabato
517,Datuwan.Nagil,Datuwan Nagil Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 25, 1949,57,M,Head,Purok Muslim, Aleosan, Cotabato
518,Bailani.Sanduyungan,Bailani Sanduyungan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 22, 1972,54,F,Spouse,Purok Muslim, Aleosan, Cotabato
519,Nabil.Sanduyungan,Nabil Sanduyungan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 15, 2010,16,M,Child,Purok Muslim, Aleosan, Cotabato
520,Hassan.Sanduyungan,Hassan Sanduyungan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 09, 2012,14,M,Child,Purok Muslim, Aleosan, Cotabato
521,Norhan.Sanduyungan,Norhan Sanduyungan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 14, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
522,Aliboe.Salaban,Aliboe Salaban Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 23, 2008,18,F,Spouse,Purok Muslim, Aleosan, Cotabato
523,Alehan.Salaban,Alehan Salaban Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 14, 2024,2,M,Child,Purok Muslim, Aleosan, Cotabato
524,Jonathan.Kuli,Jonathan Kuli Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 04, 1991,29,M,Head,Purok Muslim, Aleosan, Cotabato
525,Norhiana.Kulintang,Norhiana Kulintang Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 30, 1998,28,F,Spouse,Purok Muslim, Aleosan, Cotabato
526,Ashya.Amarah.Kulintang,Ashya Amarah Kulintang Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 19, 2022,4,F,Child,Purok Muslim, Aleosan, Cotabato
527,Tonton.Idsla,Tonton Idsla Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 01, 1988,38,M,Head,Purok Muslim, Aleosan, Cotabato
528,Wahida.Rahman,Wahida Rahman Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 07, 1982,44,F,Spouse,Purok Muslim, Aleosan, Cotabato
529,Hayrien.Rahman,Hayrien Rahman Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 03, 2011,15,F,Child,Purok Muslim, Aleosan, Cotabato
530,Haymie.Rahman,Haymie Rahman Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 10, 2013,13,M,Child,Purok Muslim, Aleosan, Cotabato
531,Kaido.Dogondoy,Kaido Dogondoy Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 01, 1950,76,M,Head,Purok Muslim, Aleosan, Cotabato
532,Malaolem.Idsla,Malaolem Idsla Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 19, 1948,78,F,Spouse,Purok Muslim, Aleosan, Cotabato
533,Arbaya.Idsla,Arbaya Idsla Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 08, 1986,40,F,Child,Purok Muslim, Aleosan, Cotabato
534,Sawdi.Kulubow,Sawdi Kulubow Abdulgani,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 12, 1995,31,M,Head,Purok Muslim, Aleosan, Cotabato
535,Sandra.Gandawali,Sandra Gandawali Abdulgani,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 20, 1998,28,F,Spouse,Purok Muslim, Aleosan, Cotabato
536,Norwedy.Gandawali,Norwedy Gandawali Abdulgani,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 11, 2019,7,F,Child,Purok Muslim, Aleosan, Cotabato
537,Norsitie.Gandawali,Norsitie Gandawali Abdulgani,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 21, 2022,4,F,Child,Purok Muslim, Aleosan, Cotabato
538,Abdulah.Kuta,Abdulah Kuta Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 09, 1999,27,M,Head,Purok Muslim, Aleosan, Cotabato
539,Mosripa.Lagayan,Mosripa Lagayan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 04, 2003,23,F,Spouse,Purok Muslim, Aleosan, Cotabato
540,Jalil.Lagayan,Jalil Lagayan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 09, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
541,Jamela.Lagayan,Jamela Lagayan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 28, 2021,5,F,Child,Purok Muslim, Aleosan, Cotabato
542,Jamell.Lagayan,Jamell Lagayan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 30, 2022,4,M,Child,Purok Muslim, Aleosan, Cotabato
543,Rashid.Kulintang,Rashid Kulintang Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 26, 1980,42,M,Head,Purok Muslim, Aleosan, Cotabato
544,Arbaya.Gandawali,Arbaya Gandawali Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 25, 1983,43,F,Spouse,Purok Muslim, Aleosan, Cotabato
545,Arshid.Gandawali,Arshid Gandawali Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 27, 2009,17,M,Child,Purok Muslim, Aleosan, Cotabato
546,Arshad.Gandawali,Arshad Gandawali Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 10, 2010,16,M,Child,Purok Muslim, Aleosan, Cotabato
547,Arshida.Gandawali,Arshida Gandawali Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 24, 2013,7,F,Child,Purok Muslim, Aleosan, Cotabato
548,Idzragil.Gandawali,Idzragil Gandawali Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 14, 2019,4,M,Child,Purok Muslim, Aleosan, Cotabato
549,Rashad.Gandawali,Rashad Gandawali Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 07, 2022,4,M,Child,Purok Muslim, Aleosan, Cotabato
550,Datuwan.Pilaga,Datuwan Pilaga Pandian,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 02, 1949,77,M,Head,Purok Muslim, Aleosan, Cotabato
551,Dindikan.Talipasan,Dindikan Talipasan Pandian,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 10, 1975,51,F,Spouse,Purok Muslim, Aleosan, Cotabato
552,Harris.Talipasan,Harris Talipasan Pandian,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 04, 2017,9,M,Child,Purok Muslim, Aleosan, Cotabato
553,Datucan.Nagli,Datucan Nagli Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 02, 1967,59,M,Head,Purok Muslim, Aleosan, Cotabato
554,Celia.Oresco,Celia Oresco Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 04, 1971,55,F,Spouse,Purok Muslim, Aleosan, Cotabato
555,Jomrah.Oresco,Jomrah Oresco Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 20, 2009,17,M,Child,Purok Muslim, Aleosan, Cotabato
556,Jorodin.Oresco,Jorodin Oresco Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 13, 2005,21,M,Child,Purok Muslim, Aleosan, Cotabato
557,Jovianis.Oresco,Jovianis Oresco Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 12, 2001,25,M,Head,Purok Muslim, Aleosan, Cotabato
558,Sarah.Butuan,Sarah Butuan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 05, 1999,27,F,Spouse,Purok Muslim, Aleosan, Cotabato
559,Ali-Yarner.Butuan,Ali-Yarner Butuan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 11, 2022,4,M,Child,Purok Muslim, Aleosan, Cotabato
560,Jomaric.Oresco,Jomaric Oresco Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 05, 1988,38,M,Head,Purok Muslim, Aleosan, Cotabato
561,Sadriah.Masulot,Sadriah Masulot Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 25, 1994,34,F,Spouse,Purok Muslim, Aleosan, Cotabato
562,Salahodin.Masulot,Salahodin Masulot Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 07, 2011,15,M,Child,Purok Muslim, Aleosan, Cotabato
563,Bassser.Masulot,Bassser Masulot Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 09, 2013,13,M,Child,Purok Muslim, Aleosan, Cotabato
564,Samiro.Masulot,Samiro Masulot Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 02, 2015,11,F,Child,Purok Muslim, Aleosan, Cotabato
565,Yaser.Masulot,Yaser Masulot Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 21, 2014,10,M,Child,Purok Muslim, Aleosan, Cotabato
566,Aliben.Balad,Aliben Balad Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 07, 1992,34,M,Head,Purok Muslim, Aleosan, Cotabato
567,Sarah.Asi,Sarah Asi Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 20, 1997,29,F,Spouse,Purok Muslim, Aleosan, Cotabato
568,Alfaris.Asi,Alfaris Asi Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 21, 2021,4,M,Child,Purok Muslim, Aleosan, Cotabato
569,Aljamer.Asi,Aljamer Asi Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 10, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
570,Laling.Luway,Laling Luway Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 07, 1944,82,M,Head,Purok Muslim, Aleosan, Cotabato
571,Gionda.Kulintang,Gionda Kulintang Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 09, 1954,72,F,Spouse,Purok Muslim, Aleosan, Cotabato
572,Mohamed.Dayong,Mohamed Dayong Ismail,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 23, 2013,13,M,Child,Purok Muslim, Aleosan, Cotabato
573,Ghianmoden.Guiabar,Ghianmoden Guiabar Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 21, 1968,58,M,Head,Purok Muslim, Aleosan, Cotabato
574,Melanie.Oresco,Melanie Oresco Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 08, 1970,56,F,Spouse,Purok Muslim, Aleosan, Cotabato
575,Hasnuddin.Oresco,Hasnuddin Oresco Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 17, 2000,24,M,Child,Purok Muslim, Aleosan, Cotabato
576,Nasser.Oresco,Nasser Oresco Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 23, 2002,22,M,Child,Purok Muslim, Aleosan, Cotabato
577,Nororisa.Oresco,Nororisa Oresco Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 16, 2007,19,F,Child,Purok Muslim, Aleosan, Cotabato
578,Mohamegeden.Oresco,Mohamegeden Oresco Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 31, 2009,17,M,Child,Purok Muslim, Aleosan, Cotabato
579,Boyna.Jane.Oresco,Boyna Jane Oresco Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 23, 2013,13,F,Child,Purok Muslim, Aleosan, Cotabato
580,Bainema.Oresco,Bainema Oresco Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 12, 1991,35,M,Head,Purok Muslim, Aleosan, Cotabato
581,Jainodinen.Miel,Jainodinen Miel Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 19, 1994,32,F,Spouse,Purok Muslim, Aleosan, Cotabato
582,Jhasnia.Miel,Jhasnia Miel Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 26, 2012,12,F,Child,Purok Muslim, Aleosan, Cotabato
583,Jasnia.Miel,Jasnia Miel Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 12, 2014,10,F,Child,Purok Muslim, Aleosan, Cotabato
584,Jumailca.Miel,Jumailca Miel Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 25, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
585,Jhomaiden.Miel,Jhomaiden Miel Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 04, 2006,20,M,Head,Purok Muslim, Aleosan, Cotabato
586,Nasrola.Dresco,Nasrola Dresco Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 15, 2005,21,F,Spouse,Purok Muslim, Aleosan, Cotabato
587,Hasmia.Bokar,Hasmia Bokar Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 02, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
588,Jamila.Bokar,Jamila Bokar Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 05, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
589,King.Pajaoa,King Pajaoa Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 02, 1992,34,F,Spouse,Purok Muslim, Aleosan, Cotabato
590,Johara.Kalim,Johara Kalim Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 05, 2015,11,F,Child,Purok Muslim, Aleosan, Cotabato
591,Princess.Jomaica.Kalim,Princess Jomaica Kalim Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 23, 2017,9,F,Child,Purok Muslim, Aleosan, Cotabato
592,Fawriana.Kalim,Fawriana Kalim Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 01, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
593,Farmina.Kalim,Farmina Kalim Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 23, 1995,31,M,Head,Purok Muslim, Aleosan, Cotabato
594,Jomarivie.Catanus,Jomarivie Catanus Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 23, 1999,27,F,Spouse,Purok Muslim, Aleosan, Cotabato
595,Alliah.Kato,Alliah Kato Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 15, 2017,7,F,Child,Purok Muslim, Aleosan, Cotabato
596,Jho'lianna.Kato,Jho'lianna Kato Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 15, 2019,5,F,Child,Purok Muslim, Aleosan, Cotabato
597,Jophainner.Kato,Jophainner Kato Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 24, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
598,Al-Jomer.Kato,Al-Jomer Kato Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 10, 1996,30,M,Head,Purok Muslim, Aleosan, Cotabato
599,Johari.Kuton,Johari Kuton Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 25, 1996,30,F,Spouse,Purok Muslim, Aleosan, Cotabato
600,Bailen.Kalim,Bailen Kalim Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 13, 2022,4,F,Child,Purok Muslim, Aleosan, Cotabato
601,Al-Amera.Kalim,Al-Amera Kalim Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 05, 1987,39,M,Head,Purok Muslim, Aleosan, Cotabato
602,Roco.Kulintang,Roco Kulintang Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 24, 1984,42,F,Spouse,Purok Muslim, Aleosan, Cotabato
603,Fairode.Kido,Fairode Kido Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 11, 2010,16,M,Child,Purok Muslim, Aleosan, Cotabato
604,Ammer.Kido,Ammer Kido Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 11, 2018,8,M,Child,Purok Muslim, Aleosan, Cotabato
605,Ariane.Kido,Ariane Kido Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 03, 2013,13,F,Child,Purok Muslim, Aleosan, Cotabato
606,Al-Rynn.Kido,Al-Rynn Kido Simon,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 18, 2010,16,M,Child,Purok Muslim, Aleosan, Cotabato
607,Al-Juhayber.Kido,Al-Juhayber Kido Simon,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 27, 2000,26,M,Head,Purok Muslim, Aleosan, Cotabato
608,Al-Eborohim.Mamaluba,Al-Eborohim Mamaluba Philes,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 08, 1999,27,F,Spouse,Purok Muslim, Aleosan, Cotabato
609,Sandro.Paido,Sandro Paido Philes,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 05, 2001,25,M,Head,Purok Muslim, Aleosan, Cotabato
610,Al-Ikbar.Mamaluba,Al-Ikbar Mamaluba Philes,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 10, 2005,21,F,Spouse,Purok Muslim, Aleosan, Cotabato
611,Aisen.Saban,Aisen Saban Philes,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 06, 1983,43,M,Head,Purok Muslim, Aleosan, Cotabato
612,Rahib.Kulintang,Rahib Kulintang Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 17, 1993,33,F,Spouse,Purok Muslim, Aleosan, Cotabato
613,Ulamboay.Sinalimbo,Ulamboay Sinalimbo Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 17, 2010,16,M,Child,Purok Muslim, Aleosan, Cotabato
614,Rohama.Sinalimbo,Rohama Sinalimbo Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 11, 2012,14,F,Child,Purok Muslim, Aleosan, Cotabato
615,Rohmaneni.Sinalimbo,Rohmaneni Sinalimbo Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 30, 2014,12,M,Child,Purok Muslim, Aleosan, Cotabato
616,Rohman.Sinalimbo,Rohman Sinalimbo Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 22, 2010,10,M,Child,Purok Muslim, Aleosan, Cotabato
617,Rohaimon.Sinalimbo,Rohaimon Sinalimbo Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 25, 1958,68,F,Head,Purok Muslim, Aleosan, Cotabato
618,Latipa.Rachman,Latipa Rachman Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 12, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
619,Monema.Rachman,Monema Rachman Philos,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 18, 1984,42,M,Head,Purok Muslim, Aleosan, Cotabato
620,Joymar.Philos,Joymar Philos Baman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 31, 1982,44,F,Spouse,Purok Muslim, Aleosan, Cotabato
621,Jomar.Philos,Jomar Philos Baman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 29, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
622,Rubon.Mauyag,Rubon Mauyag Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 12, 2021,9,M,Child,Purok Muslim, Aleosan, Cotabato
623,Zukeila.Ahmad,Zukeila Ahmad Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 28, 1969,57,M,Head,Purok Muslim, Aleosan, Cotabato
624,Loujane.Ahmad,Loujane Ahmad Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 19, 1984,40,F,Spouse,Purok Muslim, Aleosan, Cotabato
625,Lazeez.Ahmad,Lazeez Ahmad Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 19, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
626,Merodin.Rachman,Merodin Rachman Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 01, 1997,24,M,Head,Purok Muslim, Aleosan, Cotabato
627,Monisa.Hiceta,Monisa Hiceta Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 10, 2000,24,F,Spouse,Purok Muslim, Aleosan, Cotabato
628,Jassam.Zayn.Hiceta,Jassam Zayn Hiceta Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 16, 2021,5,F,Child,Purok Muslim, Aleosan, Cotabato
629,Mastura.Sagadan,Mastura Sagadan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 07, 1975,49,F,Head,Purok Muslim, Aleosan, Cotabato
630,Bainang.Dalandanas,Bainang Dalandanas Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 08, 1985,41,M,Spouse,Purok Muslim, Aleosan, Cotabato
631,Bai.Shannon.Dalandanas,Bai Shannon Dalandanas Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 10, 1980,46,F,Child,Purok Muslim, Aleosan, Cotabato
632,Akmad.Bakar,Akmad Bakar Bakar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 22, 2009,18,M,Head,Purok Muslim, Aleosan, Cotabato
633,Bainot.Bakar,Bainot Bakar Bakar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 15, 2010,16,F,Spouse,Purok Muslim, Aleosan, Cotabato
634,Pasmia.Bakar,Pasmia Bakar Bakar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 23, 2014,10,F,Child,Purok Muslim, Aleosan, Cotabato
635,Komeni.Bakar,Komeni Bakar Bakar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 21, 2018,8,M,Child,Purok Muslim, Aleosan, Cotabato
636,Abdulah.Bakar,Abdulah Bakar Bakar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 16, 2022,4,M,Child,Purok Muslim, Aleosan, Cotabato
637,Albazeir.Bakar,Albazeir Bakar Bakar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 21, 2000,24,M,Head,Purok Muslim, Aleosan, Cotabato
638,Mohamod.Bakar,Mohamod Bakar Bakar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 07, 2007,24,F,Spouse,Purok Muslim, Aleosan, Cotabato
639,Hamser.UTD,Hamser UTD Ampatuan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 03, 2021,5,F,Child,Purok Muslim, Aleosan, Cotabato
640,Almanie.Mamaluba,Almanie Mamaluba Ampatuan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 03, 2021,5,F,Child,Purok Muslim, Aleosan, Cotabato
641,Ashley.Mamaluba,Ashley Mamaluba Ampatuan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 03, 2021,5,F,Child,Purok Muslim, Aleosan, Cotabato
$_muslim_paste_490_641$::TEXT AS raw_text
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
        THEN LEFT(username_base, 22) || ROW_NUMBER() OVER (PARTITION BY username_base ORDER BY source_line)::TEXT
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
