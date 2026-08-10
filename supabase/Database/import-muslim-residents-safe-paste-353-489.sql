-- Safe import for pasted Purok Muslim resident rows, households 353-489.
-- This script does NOT delete, archive, or update existing resident records.
-- It only inserts residents that do not already match by full name + household number + birthday.
-- For source rows with incomplete/truncated data, missing fields are imported as NULL and matching uses full name + household number.
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
  SELECT $_muslim_paste_353_489$
Household No.,Username,Full Name,Purok,Address,Date of Birth,Age,Sex,Relationship,Birthplace
353,Atiraham.Asi,Atiraham Asi Bacar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 09, 2019,8,M,Child,Purok Muslim, Aleosan, Cotabato
354,Macasagal.Abo,Macasagal Abo Bonega,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 04, 1967,59,M,Head,Purok Muslim, Aleosan, Cotabato
355,Dido.Diagao,Dido Diagao Bonega,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 22, 1979,47,F,Spouse,Purok Muslim, Aleosan, Cotabato
356,Datucan.Diagao,Datucan Diagao Bonega,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 21, 2005,20,M,Child,Purok Muslim, Aleosan, Cotabato
357,Jehad.Diagao,Jehad Diagao Bonega,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 08, 2010,16,M,Child,Purok Muslim, Aleosan, Cotabato
358,Sar-af.Diagao,Sar-af Diagao Bonega,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 06, 2015,11,M,Child,Purok Muslim, Aleosan, Cotabato
359,Jawer.Diagao,Jawer Diagao Bonega,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 10, 2019,8,M,Child,Purok Muslim, Aleosan, Cotabato
360,Hajimen.Mamaluba,Hajimen Mamaluba Kalibo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 09, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
361,Hana.Bonega,Hana Bonega Kalibo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 10, 1997,29,F,Spouse,Purok Muslim, Aleosan, Cotabato
362,Royad.Rachman,Royad Rachman Kalibo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 12, 2017,9,M,Child,Purok Muslim, Aleosan, Cotabato
363,Reyani.Rachman,Reyani Rachman Kalibo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 01, 2019,5,F,Child,Purok Muslim, Aleosan, Cotabato
364,Renn.Rachman,Renn Rachman Kalibo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 04, 2022,5,F,Child,Purok Muslim, Aleosan, Cotabato
365,Pangandaman.Usman,Pangandaman Usman Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 10, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
366,Anna.Gandawali,Anna Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 07, 2005,21,F,Spouse,Purok Muslim, Aleosan, Cotabato
367,Sittie.Naddeeya.Gandawali,Sittie Naddeeya Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 13, 2022,5,F,Child,Purok Muslim, Aleosan, Cotabato
368,Jowahier.Gandawali,Jowahier Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 23, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
369,Rey.mort.Ginapal,Rey mort Ginapal Dandang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 10, 1998,28,M,Head,Purok Muslim, Aleosan, Cotabato
370,Washmiya.Ginapal,Washmiya Ginapal Dandang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 24, 1996,28,F,Spouse,Purok Muslim, Aleosan, Cotabato
371,Samsudin.Suliek,Samsudin Suliek Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 08, 1986,39,M,Head,Purok Muslim, Aleosan, Cotabato
372,Mona.Mamaluba,Mona Mamaluba Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 24, 1998,28,F,Spouse,Purok Muslim, Aleosan, Cotabato
373,Samiruden.Mamaluba,Samiruden Mamaluba Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 28, 2011,15,M,Child,Purok Muslim, Aleosan, Cotabato
374,Samrod.Mamaluba,Samrod Mamaluba Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 16, 2014,10,M,Child,Purok Muslim, Aleosan, Cotabato
375,Samer.Mamaluba,Samer Mamaluba Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 17, 2020,7,M,Child,Purok Muslim, Aleosan, Cotabato
376,Samraida.Mamaluba,Samraida Mamaluba Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 01, 2025,1,F,Child,Purok Muslim, Aleosan, Cotabato
377,Ping.Kalis,Ping Kalis Kuten,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 29, 1977,49,M,Head,Purok Muslim, Aleosan, Cotabato
378,Rakma.Mustapha,Rakma Mustapha Kuten,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 16, 1978,49,F,Spouse,Purok Muslim, Aleosan, Cotabato
379,Dapo.Sagadan,Dapo Sagadan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 01, 1982,44,M,Head,Purok Muslim, Aleosan, Cotabato
380,Parida.Kalibo,Parida Kalibo Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 01, 1988,38,F,Spouse,Purok Muslim, Aleosan, Cotabato
381,Asnaida.Kalibo,Asnaida Kalibo Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 13, 2005,21,F,Child,Purok Muslim, Aleosan, Cotabato
382,Asmina.Kalibo,Asmina Kalibo Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 24, 2010,15,F,Child,Purok Muslim, Aleosan, Cotabato
383,Asraingai.Kalibo,Asraingai Kalibo Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 26, 2012,14,M,Child,Purok Muslim, Aleosan, Cotabato
384,Alam.Kalibo,Alam Kalibo Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 01, 2019,12,M,Child,Purok Muslim, Aleosan, Cotabato
385,Asly.Kalibo,Asly Kalibo Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 10, 2018,8,F,Child,Purok Muslim, Aleosan, Cotabato
386,Dalaan.Landasan,Dalaan Landasan Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 17, 1959,67,M,Head,Purok Muslim, Aleosan, Cotabato
387,Kadiagua.Usman,Kadiagua Usman Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 08, 1968,58,F,Spouse,Purok Muslim, Aleosan, Cotabato
388,Fatima.Usman,Fatima Usman Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 05, 2005,21,F,Child,Purok Muslim, Aleosan, Cotabato
389,Rasul.Sandigan,Rasul Sandigan Dagandang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 17, 2007,19,M,Head,Purok Muslim, Aleosan, Cotabato
390,Asna.Kulintang,Asna Kulintang Dagandang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 24, 2008,18,F,Spouse,Purok Muslim, Aleosan, Cotabato
391,Asraifa.Kulintang,Asraifa Kulintang Dagandang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 22, 2024,2,F,Child,Purok Muslim, Aleosan, Cotabato
392,Alimodin.Sagadan,Alimodin Sagadan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 30, 1979,47,M,Head,Purok Muslim, Aleosan, Cotabato
393,Moncera.Sanang,Moncera Sanang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 02, 1984,42,F,Spouse,Purok Muslim, Aleosan, Cotabato
394,Mohanie.Sanang,Mohanie Sanang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 10, 2007,19,F,Child,Purok Muslim, Aleosan, Cotabato
395,Mayra.Sanang,Mayra Sanang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 18, 2010,16,F,Child,Purok Muslim, Aleosan, Cotabato
396,Mohanadi.Sanang,Mohanadi Sanang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 11, 2012,14,M,Child,Purok Muslim, Aleosan, Cotabato
397,Mot.maina.Sanang,Mot maina Sanang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 08, 2020,7,F,Child,Purok Muslim, Aleosan, Cotabato
398,Mohaina.Sanang,Mohaina Sanang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 08, 2020,7,F,Child,Purok Muslim, Aleosan, Cotabato
399,Saminina.Sagadan,Saminina Sagadan Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 14, 1974,52,F,Head,Purok Muslim, Aleosan, Cotabato
400,Maher.Sanang,Maher Sanang Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 14, 2017,9,M,Spouse,Purok Muslim, Aleosan, Cotabato
401,Tomas.Valinten,Tomas Valinten Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 06, 1969,57,M,Head,Purok Muslim, Aleosan, Cotabato
402,Makabimbang.Usman,Makabimbang Usman Sinalimbo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 05, 1972,52,F,Spouse,Purok Muslim, Aleosan, Cotabato
403,Monalisa.Talipuko,Monalisa Talipuko Sinalimbo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 24, 2002,24,F,Child,Purok Muslim, Aleosan, Cotabato
404,Boisan.Talipuko,Boisan Talipuko Sinalimbo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 20, 2013,13,M,Child,Purok Muslim, Aleosan, Cotabato
405,Jonathan.Talipuko,Jonathan Talipuko Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 06, 1990,34,M,Head,Purok Muslim, Aleosan, Cotabato
406,Senia.Olimpin,Senia Olimpin Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 10, 2004,22,F,Spouse,Purok Muslim, Aleosan, Cotabato
407,Johaindin.Olimpin,Johaindin Olimpin Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 21, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
408,Johaniben.Olimpin,Johaniben Olimpin Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 04, 2025,1,M,Child,Purok Muslim, Aleosan, Cotabato
409,Dalgan.Landasan,Dalgan Landasan Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 07, 1959,67,M,Head,Purok Muslim, Aleosan, Cotabato
410,Kadiagua.Usman,Kadiagua Usman Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 06, 1968,11,F,Spouse,Purok Muslim, Aleosan, Cotabato
411,Fatima.Usman,Fatima Usman Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 05, 2005,20,F,Child,Purok Muslim, Aleosan, Cotabato
412,Jokarni.Kalim,Jokarni Kalim Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 14, 1988,37,M,Head,Purok Muslim, Aleosan, Cotabato
413,Morsalin.Mamenting,Morsalin Mamenting Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 14, 1991,35,F,Spouse,Purok Muslim, Aleosan, Cotabato
414,Justine.Mamenting,Justine Mamenting Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 25, 2009,17,F,Child,Purok Muslim, Aleosan, Cotabato
415,Jamer.Mamenting,Jamer Mamenting Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 15, 2011,15,M,Child,Purok Muslim, Aleosan, Cotabato
416,Julhamen.Mamenting,Julhamen Mamenting Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 25, 2018,8,M,Child,Purok Muslim, Aleosan, Cotabato
417,Samirudin.Rachman,Samirudin Rachman Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 30, 1980,44,M,Head,Purok Muslim, Aleosan, Cotabato
418,Merlyn.Andal,Merlyn Andal Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 23, 1981,45,F,Spouse,Purok Muslim, Aleosan, Cotabato
419,Bai.Sittie.Shamamer.Andal,Bai Sittie Shamamer Andal Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 05, 2012,14,F,Child,Purok Muslim, Aleosan, Cotabato
420,Datu-Samer.Ali,Andal,Datu-Samer Ali Andal Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 01, 2014,12,M,Child,Purok Muslim, Aleosan, Cotabato
421,Hawa.Rachman,Hawa Rachman Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 24, 1944,80,F,Head,Purok Muslim, Aleosan, Cotabato
422,Nasrudin.Rachman,Nasrudin Rachman Solayman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 11, 1981,45,M,Spouse,Purok Muslim, Aleosan, Cotabato
423,Wahab.Masulot,Wahab Masulot Bansil,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 21, 1970,50,M,Head,Purok Muslim, Aleosan, Cotabato
424,Jowener.Mamaluba,Jowener Mamaluba Bansil,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 22, 1973,51,F,Spouse,Purok Muslim, Aleosan, Cotabato
425,Jouaher.Mamaluba,Jouaher Mamaluba Bansil,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 25, 2014,10,M,Child,Purok Muslim, Aleosan, Cotabato
426,Olaida.Kulintang,Olaida Kulintang Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 29, 1942,64,F,Head,Purok Muslim, Aleosan, Cotabato
427,Al.Boser.Mamaluba,Al Boser Mamaluba Philas,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 28, 2005,21,M,Spouse,Purok Muslim, Aleosan, Cotabato
428,Bangan.Kalim,Bangan Kalim Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 03, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
429,Rahima.Totia,Rahima Totia Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 09, 1994,32,F,Spouse,Purok Muslim, Aleosan, Cotabato
430,Bai.Rosiyana.Totia,Bai Rosiyana Totia Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 29, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
431,Ebrohim.Kamidon,Ebrohim Kamidon Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 20, 1988,38,M,Head,Purok Muslim, Aleosan, Cotabato
432,Jasmin.Kulintang,Jasmin Kulintang Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 01, 1988,38,F,Spouse,Purok Muslim, Aleosan, Cotabato
433,Datn.Ben.Kulintang,Datn Ben Kulintang Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 15, 2017,9,M,Child,Purok Muslim, Aleosan, Cotabato
434,Bonhamin.Kulintang,Bonhamin Kulintang Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 15, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
435,Meriam.Pinalin,Meriam Pinalin Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 10, 1941,65,M,Head,Purok Muslim, Aleosan, Cotabato
436,Baser.Kalim,Baser Kalim Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 19, 1994,30,F,Spouse,Purok Muslim, Aleosan, Cotabato
437,Elmor.Makagilik,Elmor Makagilik Dalamdanas,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 02, 1997,29,M,Head,Purok Muslim, Aleosan, Cotabato
438,Norhaida.Kulintang,Norhaida Kulintang Dalamdanas,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 20, 2007,26,F,Spouse,Purok Muslim, Aleosan, Cotabato
439,Jade.Kulintang,Jade Kulintang Dalamdanas,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 17, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
440,Rohib.Kalibo,Rohib Kalibo Totia,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 01, 1993,33,M,Head,Purok Muslim, Aleosan, Cotabato
441,Nebel.Oresco,Nebel Oresco Totia,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 08, 1998,28,F,Spouse,Purok Muslim, Aleosan, Cotabato
442,Jihad.Kulintang,Jihad Kulintang Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 10, 1989,37,M,Head,Purok Muslim, Aleosan, Cotabato
443,Sarapia.Mamenting,Sarapia Mamenting Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 07, 1991,30,F,Spouse,Purok Muslim, Aleosan, Cotabato
444,Jiavier.Mamenting,Jiavier Mamenting Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 04, 2014,10,M,Child,Purok Muslim, Aleosan, Cotabato
445,Jiamil.Mamenting,Jiamil Mamenting Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 20, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
446,Jiamin.Mamenting,Jiamin Mamenting Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 19, 2022,4,F,Child,Purok Muslim, Aleosan, Cotabato
447,Sahed.A,Sahed A Panes,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 22, 1954,72,M,Head,Purok Muslim, Aleosan, Cotabato
448,Norma.Kalibo,Norma Kalibo Panes,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 08, 1976,50,F,Spouse,Purok Muslim, Aleosan, Cotabato
449,Jing.ke.Kalibo,Jing ke Kalibo Panes,Purok Muslim,Upper Ming
450,Jasmine.Lumpingan,Jasmine Lumpingan Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 28, 1968,58,F,Head,Purok Muslim, Aleosan, Cotabato
451,Pompen.Miscolo,Pompen Miscolo Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 07, 1939,87,M,Head,Purok Muslim, Aleosan, Cotabato
452,Dhots.Kalis,Dhots Kalis Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 13, 1984,40,F,Spouse,Purok Muslim, Aleosan, Cotabato
453,Jainoden.Andotuan,Jainoden Andotuan Baraguir,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 15, 2003,23,M,Head,Purok Muslim, Aleosan, Cotabato
454,Bairon.Panialandang,Bairon Panialandang Baraguir,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 17, 2002,24,F,Spouse,Purok Muslim, Aleosan, Cotabato
455,Mujihid.Panialandang,Mujihid Panialandang Baraguir,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 04, 2023,1,M,Child,Purok Muslim, Aleosan, Cotabato
456,Johair.Andotuan,Johair Andotuan Baraguir,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 10, 2006,19,M,Head,Purok Muslim, Aleosan, Cotabato
457,Amera.Homid,Amera Homid Baraguir,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 07, 2007,19,F,Spouse,Purok Muslim, Aleosan, Cotabato
458,Noroden.Kinten,Noroden Kinten Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 17, 1999,27,M,Head,Purok Muslim, Aleosan, Cotabato
459,Aiboi.Omial,Aiboi Omial Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 14, 2005,21,F,Spouse,Purok Muslim, Aleosan, Cotabato
460,Alfiah.Omial,Alfiah Omial Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 10, 2025,1,F,Child,Purok Muslim, Aleosan, Cotabato
461,Harun.Canso,Harun Canso Mibtimbang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 31, 2003,23,M,Head,Purok Muslim, Aleosan, Cotabato
462,Johanon.Mamenting,Johanon Mamenting Mibtimbang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 30, 2004,22,F,Spouse,Purok Muslim, Aleosan, Cotabato
463,Jomhama.Mamenting,Jomhama Mamenting Mibtimbang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 18, 2024,2,F,Child,Purok Muslim, Aleosan, Cotabato
464,Tongan.Kuta,Tongan Kuta Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 05, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
465,Bailyn.Aracilla,Bailyn Aracilla Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 07, 1997,29,F,Spouse,Purok Muslim, Aleosan, Cotabato
466,Aga.Kalis,Aga Kalis Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 24, 1967,59,M,Head,Purok Muslim, Aleosan, Cotabato
467,Norodin.Kuta,Norodin Kuta Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 24, 1996,30,F,Spouse,Purok Muslim, Aleosan, Cotabato
468,Perina.Kuta,Perina Kuta Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 08, 2014,10,F,Child,Purok Muslim, Aleosan, Cotabato
469,Nairah.Balang,Nairah Balang Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 19, 2019,7,F,Child,Purok Muslim, Aleosan, Cotabato
470,Marilyn.Balang,Marilyn Balang Kalim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 11, 2021,5,F,Child,Purok Muslim, Aleosan, Cotabato
471,Cesar.Kabagani,Cesar Kabagani Sangkulongan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 05, 1999,27,M,Head,Purok Muslim, Aleosan, Cotabato
472,Norhaina.Kalimi,Norhaina Kalimi Sangkulongan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 23, 2005,21,F,Spouse,Purok Muslim, Aleosan, Cotabato
473,Baby.Shainah.Kalim,Baby Shainah Kalim Sangkulongan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 29, 2020,4,F,Child,Purok Muslim, Aleosan, Cotabato
474,Esmael.Kalim,Esmael Kalim Sangkulongan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 28, 2022,1,M,Child,Purok Muslim, Aleosan, Cotabato
475,Samuel.Laguiab,Samuel Laguiab Lopez,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 11, 1989,37,M,Head,Purok Muslim, Aleosan, Cotabato
476,Armina.Kutoi,Armina Kutoi Lopez,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 02, 1992,34,F,Spouse,Purok Muslim, Aleosan, Cotabato
477,Aljhim.Kenneth.Kuto,Aljhim Kenneth Kuto Lopez,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 19, 2012,14,M,Child,Purok Muslim, Aleosan, Cotabato
478,Ayah.Jannah.Kuto,Ayah Jannah Kuto Lopez,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 03, 2014,12,F,Child,Purok Muslim, Aleosan, Cotabato
479,Arya.Joseena.Kuto,Arya Joseena Kuto Lopez,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 28, 2016,10,F,Child,Purok Muslim, Aleosan, Cotabato
480,Anya.Janela.Kuto,Anya Janela Kuto Lopez,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 30, 2018,8,F,Child,Purok Muslim, Aleosan, Cotabato
481,Aris.Idslay,Aris Idslay Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 25, 1978,48,M,Head,Purok Muslim, Aleosan, Cotabato
482,Norma.Rachman,Norma Rachman Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 09, 1979,47,F,Spouse,Purok Muslim, Aleosan, Cotabato
483,Bensor.Rachman,Bensor Rachman Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 09, 1998,28,M,Child,Purok Muslim, Aleosan, Cotabato
484,Norhin.Rachman,Norhin Rachman Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 12, 2000,26,M,Child,Purok Muslim, Aleosan, Cotabato
485,Al-Rafy.Rachman,Al-Rafy Rachman Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 18, 2015,11,M,Child,Purok Muslim, Aleosan, Cotabato
486,Ares.Mamenting,Ares Mamenting Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 09, 2009,17,M,Child,Purok Muslim, Aleosan, Cotabato
487,Jovain.Wady,Jovain Wady Amella,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 03, 1997,29,M,Head,Purok Muslim, Aleosan, Cotabato
488,Moharama.Maniano,Moharama Maniano Amella,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 07, 1994,32,F,Spouse,Purok Muslim, Aleosan, Cotabato
489,Najimin.Maniano,Najimin Maniano Amella,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 08, 2021,5,F,Child,Purok Muslim, Aleosan, Cotabato
$_muslim_paste_353_489$::TEXT AS raw_text
),
raw_lines AS (
  SELECT
    line_data.ordinal AS source_line,
    TRIM(line_data.line) AS original_line
  FROM raw_source
  CROSS JOIN LATERAL regexp_split_to_table(raw_text, E'\r?\n') WITH ORDINALITY AS line_data(line, ordinal)
  WHERE TRIM(line_data.line) <> ''
),
normalized_lines AS (
  SELECT
    source_line,
    original_line,
    CASE
      WHEN original_line LIKE '420,Datu-Samer.Ali,Andal,Datu-Samer Ali Andal Solayman,%'
        THEN regexp_replace(original_line, '^420,Datu-Samer[.]Ali,Andal,', '420,Datu-Samer.Ali.Andal,')
      ELSE original_line
    END AS line
  FROM raw_lines
  WHERE source_line > 1
),
parsed_lines AS (
  SELECT
    source_line,
    original_line,
    line,
    regexp_match(
      line,
      '^([^,]+),([^,]+),([^,]+),([^,]+),(.+),([A-Za-z]+ \d{1,2}),\s*(\d{4}),(\d+),([MFmf]),([^,]+),(.+)$'
    ) AS valid_parts,
    regexp_match(line, '^([^,]+),([^,]+),([^,]+),([^,]+),(.+)$') AS truncated_parts
  FROM normalized_lines
),
resident_seed_base AS (
  SELECT
    source_line,
    TRIM(valid_parts[1]) AS house_no,
    TRIM(valid_parts[1]) AS household_no,
    public.normalize_resident_username(valid_parts[2]) AS username_base,
    TRIM(valid_parts[3]) AS full_name,
    regexp_split_to_array(TRIM(valid_parts[3]), '\s+') AS name_parts,
    to_date(TRIM(valid_parts[6]) || ', ' || TRIM(valid_parts[7]), 'FMMonth DD, YYYY') AS birthday,
    TRIM(valid_parts[8])::INTEGER AS age,
    CASE UPPER(TRIM(valid_parts[9]))
      WHEN 'M' THEN 'Male'
      WHEN 'F' THEN 'Female'
      ELSE NULL
    END AS sex,
    TRIM(valid_parts[10]) AS relationship_to_household_head,
    TRIM(valid_parts[11]) AS birthplace,
    'Muslim'::TEXT AS purok,
    TRIM(valid_parts[5]) AS address,
    NULL::TEXT AS source_note
  FROM parsed_lines
  WHERE valid_parts IS NOT NULL

  UNION ALL

  SELECT
    source_line,
    TRIM(truncated_parts[1]) AS house_no,
    TRIM(truncated_parts[1]) AS household_no,
    public.normalize_resident_username(truncated_parts[2]) AS username_base,
    TRIM(truncated_parts[3]) AS full_name,
    regexp_split_to_array(TRIM(truncated_parts[3]), '\s+') AS name_parts,
    NULL::DATE AS birthday,
    NULL::INTEGER AS age,
    NULL::TEXT AS sex,
    NULL::TEXT AS relationship_to_household_head,
    NULL::TEXT AS birthplace,
    'Muslim'::TEXT AS purok,
    TRIM(truncated_parts[5]) AS address,
    'Truncated source row; missing birthday, age, sex, relationship, and birthplace.' AS source_note
  FROM parsed_lines
  WHERE valid_parts IS NULL
    AND truncated_parts IS NOT NULL
    AND line LIKE '449,Jing.ke.Kalibo,Jing ke Kalibo Panes,%'
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
   AND (seed.birthday IS NULL OR resident.birthday = seed.birthday)
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
      AND (seed.birthday IS NULL OR resident.birthday = seed.birthday)
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
   AND seed.birthday IS NOT DISTINCT FROM inserted.birthday
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
  (SELECT COUNT(*) FROM resident_seed_base WHERE source_note IS NOT NULL) AS special_rows,
  (SELECT COUNT(*) FROM parsed_lines WHERE valid_parts IS NULL AND NOT (line LIKE '449,Jing.ke.Kalibo,Jing ke Kalibo Panes,%')) AS skipped_rows,
  (SELECT COUNT(*) FROM inserted_residents) AS inserted_residents,
  (SELECT COUNT(*) FROM existing_residents) AS matched_existing_residents,
  (SELECT COUNT(*) FROM created_accounts) AS created_accounts;

NOTIFY pgrst, 'reload schema';
