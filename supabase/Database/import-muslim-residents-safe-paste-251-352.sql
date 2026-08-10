-- Safe import for pasted Purok Muslim resident rows, households 251-352.
-- This script does NOT delete, archive, or update existing resident records.
-- It only inserts residents that do not already match by full name + household number + birthday.
-- For source rows with incomplete birthdays, birthday is imported as NULL and matching uses full name + household number.
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
  SELECT $_muslim_paste_251_352$
Household No.,Username,Full Name,Purok,Address,Date of Birth,Age,Sex,Relationship,Birthplace
251,Harris.Sodol,Harris Sodol,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 29, 2001,25,M,Head,Purok Muslim, Aleosan, Cotabato
251,Bai.lani.Patabandong,Bai.lani Patabandong,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 04, 2005,21,F,Spouse,Purok Muslim, Aleosan, Cotabato
251,Bai.jehan.Kuta,Bai.jehan Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 31, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
252,Jovan.Sodol,Jovan Sodol,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 07, 1997,29,M,Head,Purok Muslim, Aleosan, Cotabato
252,Rosiya.Sodol,Rosiya Sodol,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 03, 1998,28,F,Spouse,Purok Muslim, Aleosan, Cotabato
253,Abdulrahman.Alsoy,Abdulrahman Alsoy Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 17, 2006,20,M,Head,Purok Muslim, Aleosan, Cotabato
253,Annie.Panulandang,Annie Panulandang Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 10, 2007,19,F,Spouse,Purok Muslim, Aleosan, Cotabato
253,Faiza.Panulandang,Faiza Panulandang Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 27, 2024,2,F,Child,Purok Muslim, Aleosan, Cotabato
254,Rayman.Saldo,Rayman Saldo Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 22, 1993,33,M,Head,Purok Muslim, Aleosan, Cotabato
254,Asna.Saldo,Asna Saldo Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 21, 1994,32,F,Spouse,Purok Muslim, Aleosan, Cotabato
255,Taher.Gandawali,Taher Gandawali Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 17, 1980,46,M,Head,Purok Muslim, Aleosan, Cotabato
255,Josephine.Depansor,Josephine Depansor Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 29, 1983,43,F,Spouse,Purok Muslim, Aleosan, Cotabato
255,Bai.Jawahar.Depansor,Bai.Jawahar Depansor Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 05, 2011,15,F,Child,Purok Muslim, Aleosan, Cotabato
255,Jonnie.Thio.Rachman,Jonnie Thio Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 11, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
255,Al.Janer.Kenneth.Depansor,Al.Janer Kenneth Depansor Rachman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 08, 2024,2,M,Child,Purok Muslim, Aleosan, Cotabato
256,Sadazang.Manmayag,Sadazang Manmayag Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 23, 1964,60,F,Head,Purok Muslim, Aleosan, Cotabato
256,Basson.Maminting,Basson Maminting Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 01, 1974,30,M,Spouse,Purok Muslim, Aleosan, Cotabato
256,Mobina.Balad,Mobina Balad Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 29, 2013,13,F,Child,Purok Muslim, Aleosan, Cotabato
256,Norhaina.Balad,Norhaina Balad Mamenting,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 11, 2018,16,F,Child,Purok Muslim, Aleosan, Cotabato
256,Norayna.Palaman,Norayna Palaman Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 24, 2010,14,F,Child,Purok Muslim, Aleosan, Cotabato
257,Mogie.Usop,Mogie Usop Salik,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 12, 1942,82,M,Head,Purok Muslim, Aleosan, Cotabato
257,Palomata.Boladod,Palomata Boladod,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 10, 1957,69,F,Spouse,Purok Muslim, Aleosan, Cotabato
258,Kamesa.Kuta,Kamesa Kuta Baraguir,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 28, 1957,69,F,Head,Purok Muslim, Aleosan, Cotabato
258,Anisa.Baraguir,Anisa Baraguir,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 28, 2015,11,F,Child,Purok Muslim, Aleosan, Cotabato
259,Thugs.Kulintang,Thugs Kulintang Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 11, 1962,62,M,Head,Purok Muslim, Aleosan, Cotabato
259,Laga.Kalim,Laga Kalim Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 01, 1969,57,F,Spouse,Purok Muslim, Aleosan, Cotabato
259,Zahar.Khan.Balad,Zahar Khan Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 20, 2020,6,M,Child,Purok Muslim, Aleosan, Cotabato
260,Homeli.Kalim,Homeli Kalim Indan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 04, 2013,13,M,Head,Purok Muslim, Aleosan, Cotabato
260,Mojahid.Indan,Mojahid Indan Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 12, 2018,8,M,Child,Purok Muslim, Aleosan, Cotabato
260,Bailah.Balad,Bailah Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,18 1991,35,F,Child,Purok Muslim, Aleosan, Cotabato
261,Hosser.Kalim,Hosser Kalim Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 18, 1991,35,M,Head,Purok Muslim, Aleosan, Cotabato
261,Momina.Dimasangkay,Momina Dimasangkay Panulandang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 15, 1996,25,F,Spouse,Purok Muslim, Aleosan, Cotabato
261,Salman.Panulandang,Salman Panulandang Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 16, 1996,12,M,Child,Purok Muslim, Aleosan, Cotabato
261,Saldi.Panulandang,Saldi Panulandang Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 13, 2014,9,M,Child,Purok Muslim, Aleosan, Cotabato
261,Sharina.Balad,Sharina Balad Panulandang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 05, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
262,Mamaela.Palaman,Mamaela Palaman Ibrahim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 13, 1995,31,M,Head,Purok Muslim, Aleosan, Cotabato
262,Norayna.Kalim,Norayna Kalim Balad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 04, 1996,30,F,Spouse,Purok Muslim, Aleosan, Cotabato
262,Haodi.Balad,Haodi Balad Ebrahim,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 28, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
263,Boy.Luuay,Boy Luuay Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 03, 1955,73,M,Head,Purok Muslim, Aleosan, Cotabato
263,Fatima.Kalim,Fatima Kalim Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 07, 1977,49,F,Spouse,Purok Muslim, Aleosan, Cotabato
263,Zokanna.Kalim,Zokanna Kalim Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 22, 2004,22,M,Child,Purok Muslim, Aleosan, Cotabato
263,Erham.Kalim,Erham Kalim Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 27, 2012,19,M,Child,Purok Muslim, Aleosan, Cotabato
264,Alinor.C.Palaman,Alinor C Palaman Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 03, 1994,30,M,Head,Purok Muslim, Aleosan, Cotabato
264,Mimraido.Kuta,Mimraido Kuta Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 29, 1999,27,F,Spouse,Purok Muslim, Aleosan, Cotabato
264,Farisha.Kuta,Farisha Kuta Palaman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 29, 2022,4,F,Child,Purok Muslim, Aleosan, Cotabato
265,Emrom.Kalim,Emrom Kalim Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 17, 1997,29,M,Head,Purok Muslim, Aleosan, Cotabato
265,Hasnorah.S.Kuta,Hasnorah S Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 11, 1998,28,F,Spouse,Purok Muslim, Aleosan, Cotabato
265,Al.yasocd.S.Kuta,Al.yasocd S Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 23, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
265,Ayesha.Sandayugyon,Ayesha Sandayugyon Kuta,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 08, 2024,2,F,Child,Purok Muslim, Aleosan, Cotabato
266,Makmod.Ulcsan,Makmod Ulcsan Abiden,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 28, 1978,48,M,Head,Purok Muslim, Aleosan, Cotabato
266,Noraida.Panday,Noraida Panday Matlindo,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 13, 1979,47,F,Spouse,Purok Muslim, Aleosan, Cotabato
266,Norman.Matlindo,Norman Matlindo Abiden,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 10, 2009,16,M,Child,Purok Muslim, Aleosan, Cotabato
266,Norhamin.Matlindo,Norhamin Matlindo Abiden,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 06, 2011,15,F,Child,Purok Muslim, Aleosan, Cotabato
266,Norrisa.Matlindo,Norrisa Matlindo Abiden,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 20, 2014,13,M,Child,Purok Muslim, Aleosan, Cotabato
266,Norhamid.Matlindo,Norhamid Matlindo Abiden,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 29, 2014,9,M,Child,Purok Muslim, Aleosan, Cotabato
267,Abdulwahid.Lindongan,Abdulwahid Lindongan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 15, 1965,59,M,Head,Purok Muslim, Aleosan, Cotabato
267,Sittie.Lindongan,Sittie Lindongan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 01, 1974,50,F,Spouse,Purok Muslim, Aleosan, Cotabato
267,Fathma.Lindongan,Fathma Lindongan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 10, 2004,20,F,Child,Purok Muslim, Aleosan, Cotabato
267,Bobay.Lindongan,Bobay Lindongan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 11, 2007,17,F,Child,Purok Muslim, Aleosan, Cotabato
267,Esmail.Lindongan,Esmail Lindongan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 12, 2004,20,M,Child,Purok Muslim, Aleosan, Cotabato
267,Khominnie.Lindongan,Khominnie Lindongan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 10, 2010,14,F,Child,Purok Muslim, Aleosan, Cotabato
268,Oks.Lindongan,Oks Lindongan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 25, 1992,39,M,Head,Purok Muslim, Aleosan, Cotabato
268,Dcdo.Sinimpolan,Dcdo Sinimpolan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 03, 1997,29,F,Spouse,Purok Muslim, Aleosan, Cotabato
268,Aisa.Sinimpolan,Aisa Sinimpolan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 17, 2007,9,F,Child,Purok Muslim, Aleosan, Cotabato
268,Aishodin.Sinimpolan,Aishodin Sinimpolan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 04, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
268,Abdul.Rahman.Sinimpolan,Abdul Rahman Sinimpolan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 06, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
269,Meranda.Palaguyan,Meranda Palaguyan Endian,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 06, 1999,27,M,Head,Purok Muslim, Aleosan, Cotabato
269,Kadiagua.Lindongan,Kadiagua Lindongan Usman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 28, 2006,20,F,Spouse,Purok Muslim, Aleosan, Cotabato
269,Reyhad.Usman,Reyhad Usman Endian,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 11, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
270,Kunot.Gandawali,Kunot Gandawali Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 07, 1967,44,M,Head,Purok Muslim, Aleosan, Cotabato
271,Jahara.Kuta,Jahara Kuta Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 05, 1979,47,F,Spouse,Purok Muslim, Aleosan, Cotabato
272,Abdulsatar.Kuta,Abdulsatar Kuta Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 27, 2000,24,M,Child,Purok Muslim, Aleosan, Cotabato
273,Abdul.nawaf.Kuta,Abdul nawaf Kuta Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 04, 2010,14,M,Child,Purok Muslim, Aleosan, Cotabato
274,Mohammina.Kuta,Mohammina Kuta Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 27, 2011,14,F,Child,Purok Muslim, Aleosan, Cotabato
275,Mohasminin.Kuta,Mohasminin Kuta Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 28, 2013,14,M,Child,Purok Muslim, Aleosan, Cotabato
276,Abdulyusif.Kuta,Abdulyusif Kuta Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 11, 2015,11,M,Child,Purok Muslim, Aleosan, Cotabato
277,Mohaima.Kuta,Mohaima Kuta Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 04, 2017,9,F,Child,Purok Muslim, Aleosan, Cotabato
278,Norhata.Gandawali,Norhata Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 05, 1972,54,M,Head,Purok Muslim, Aleosan, Cotabato
279,Almina.Gandawali,Almina Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 30, 2002,29,F,Spouse,Purok Muslim, Aleosan, Cotabato
280,Noron.Gandawali,Noron Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 26, 2008,18,M,Child,Purok Muslim, Aleosan, Cotabato
281,Norshida.Gandawali,Norshida Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 10, 2008,18,F,Child,Purok Muslim, Aleosan, Cotabato
282,Asrap.Gandawali,Asrap Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 09, 2015,11,M,Child,Purok Muslim, Aleosan, Cotabato
283,Nasser.Mariyag,Nasser Mariyag Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 12, 1977,49,M,Head,Purok Muslim, Aleosan, Cotabato
284,Baina.Gandawali,Baina Gandawali Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 09, 1980,44,F,Spouse,Purok Muslim, Aleosan, Cotabato
285,Azis.Gandawali,Azis Gandawali Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 28, 2002,23,M,Child,Purok Muslim, Aleosan, Cotabato
286,Halima.Gandawali,Halima Gandawali Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 06, 2003,20,F,Child,Purok Muslim, Aleosan, Cotabato
287,Datoeha.Gandawali,Datoeha Gandawali Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 22, 2010,17,M,Child,Purok Muslim, Aleosan, Cotabato
288,Yusop.Gandawali,Yusop Gandawali Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 24, 2013,13,M,Child,Purok Muslim, Aleosan, Cotabato
289,Hairea.Gandawali,Hairea Gandawali Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 07, 2016,9,F,Child,Purok Muslim, Aleosan, Cotabato
290,Nolds.Gandawali,Nolds Gandawali Raehman,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 29, 2018,8,M,Child,Purok Muslim, Aleosan, Cotabato
291,Tinggoll.Minaguid,Tinggoll Minaguid Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 29, 1980,46,M,Head,Purok Muslim, Aleosan, Cotabato
292,Aleysa.Kalim,Aleysa Kalim Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 10, 1946,80,F,Spouse,Purok Muslim, Aleosan, Cotabato
293,Paiscal.Andal,Paiscal Andal Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 14, 2003,21,M,Child,Purok Muslim, Aleosan, Cotabato
294,Jowali.Kalim,Jowali Kalim Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 16, 1988,38,M,Head,Purok Muslim, Aleosan, Cotabato
295,Ripa.Kalibo,Ripa Kalibo Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 15, 1990,34,F,Spouse,Purok Muslim, Aleosan, Cotabato
296,Jomaira.Kalibo,Jomaira Kalibo Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 27, 2010,16,F,Child,Purok Muslim, Aleosan, Cotabato
297,Johari.Kalibo,Johari Kalibo Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 03, 2013,13,M,Child,Purok Muslim, Aleosan, Cotabato
298,Johana.Kalibo,Johana Kalibo Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 13, 2016,10,F,Child,Purok Muslim, Aleosan, Cotabato
299,Jomari.Kalibo,Jomari Kalibo Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 28, 2020,7,M,Child,Purok Muslim, Aleosan, Cotabato
300,Pahad.Diagao,Pahad Diagao Lidasan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 07, 1994,32,M,Head,Purok Muslim, Aleosan, Cotabato
301,Patima.Diagao,Patima Diagao Lidasan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 03, 1980,46,F,Spouse,Purok Muslim, Aleosan, Cotabato
302,Parhama.Diagao,Parhama Diagao Lidasan,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 25, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
303,Samirudin.Gandawali,Samirudin Gandawali Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 09, 1996,30,M,Head,Purok Muslim, Aleosan, Cotabato
304,Saudiya.Sumagkon,Saudiya Sumagkon Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 01, 2000,24,F,Spouse,Purok Muslim, Aleosan, Cotabato
305,Saidin.Sumagkon,Saidin Sumagkon Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 16, 2015,5,M,Child,Purok Muslim, Aleosan, Cotabato
306,Sharipa.Sumagkon,Sharipa Sumagkon Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 10, 2023,3,F,Child,Purok Muslim, Aleosan, Cotabato
307,Ayah.Sumagkon,Ayah Sumagkon Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 04, 2025,1,F,Child,Purok Muslim, Aleosan, Cotabato
308,Ali.Kalim,Ali Kalim Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 05, 1981,45,M,Head,Purok Muslim, Aleosan, Cotabato
309,Aga.Manampam,Aga Manampam Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 30, 1988,38,F,Spouse,Purok Muslim, Aleosan, Cotabato
310,Amirodin.Manampam,Amirodin Manampam Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 09, 2012,14,M,Child,Purok Muslim, Aleosan, Cotabato
311,Alnor.Manampam,Alnor Manampam Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 18, 2016,9,M,Child,Purok Muslim, Aleosan, Cotabato
312,Alpiya.Manampam,Alpiya Manampam Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 07, 2018,8,F,Child,Purok Muslim, Aleosan, Cotabato
313,Anie.Manampam,Anie Manampam Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 14, 2020,7,F,Child,Purok Muslim, Aleosan, Cotabato
314,Aljherhan.Manampam,Aljherhan Manampam Gandawali,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 14, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
315,Kalasoma.Diagao,Kalasoma Diagao Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 21, 1942,84,F,Head,Purok Muslim, Aleosan, Cotabato
316,Raison.Diagao,Raison Diagao Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 10, 1989,37,F,Spouse,Purok Muslim, Aleosan, Cotabato
317,Ashrope.Diagao,Ashrope Diagao Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 08, 2012,14,M,Child,Purok Muslim, Aleosan, Cotabato
318,Reinalyn.Diagao,Reinalyn Diagao Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 30, 2015,11,F,Child,Purok Muslim, Aleosan, Cotabato
319,Ali.Diagao,Ali Diagao Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 22, 1974,52,M,Head,Purok Muslim, Aleosan, Cotabato
320,Malaiha.Bonega,Malaiha Bonega Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 10, 1993,33,F,Spouse,Purok Muslim, Aleosan, Cotabato
321,Johaina.Bonega,Johaina Bonega Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 28, 2011,15,F,Child,Purok Muslim, Aleosan, Cotabato
322,Johara.Bonega,Johara Bonega Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 14, 2013,14,F,Child,Purok Muslim, Aleosan, Cotabato
323,Jomaima.Bonega,Jomaima Bonega Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 14, 2015,11,F,Child,Purok Muslim, Aleosan, Cotabato
324,Al-Ikbar.Bonega,Al-Ikbar Bonega Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 27, 2019,9,M,Child,Purok Muslim, Aleosan, Cotabato
325,James.Damulamen,James Damulamen Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 08, 1981,45,M,Head,Purok Muslim, Aleosan, Cotabato
326,Johairo.Zaman,Johairo Zaman Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 25, 2010,14,F,Spouse,Purok Muslim, Aleosan, Cotabato
327,Abdulrakman.Diagao,Abdulrakman Diagao Guiapar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 08, 2000,24,M,Head,Purok Muslim, Aleosan, Cotabato
328,Norhana.Mohamad,Norhana Mohamad Guiapar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 25, 2003,28,F,Spouse,Purok Muslim, Aleosan, Cotabato
329,Guiamod.Mohamad,Guiamod Mohamad Guiapar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 20, 2023,3,M,Child,Purok Muslim, Aleosan, Cotabato
330,Omar.Mamalulon,Omar Mamalulon Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 07, 1983,43,M,Head,Purok Muslim, Aleosan, Cotabato
331,Johanna.Kulintang,Johanna Kulintang Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 20, 1992,39,F,Spouse,Purok Muslim, Aleosan, Cotabato
332,Jolaika.Kulintang,Jolaika Kulintang Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 25, 2013,13,F,Child,Purok Muslim, Aleosan, Cotabato
333,Bai-hanna.Kulintang,Bai-hanna Kulintang Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,December 08, 2015,11,F,Child,Purok Muslim, Aleosan, Cotabato
334,Red-Wanma.Kulintang,Red-Wanma Kulintang Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,October 03, 2019,7,M,Child,Purok Muslim, Aleosan, Cotabato
335,Zamero.Kulintang,Zamero Kulintang Diagao,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 03, 2022,4,F,Child,Purok Muslim, Aleosan, Cotabato
336,Jun.Kulintang,Jun Kulintang Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,June 06, 1982,44,M,Head,Purok Muslim, Aleosan, Cotabato
337,Arbaya.Adok,Arbaya Adok Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 20, 1989,37,F,Spouse,Purok Muslim, Aleosan, Cotabato
338,Alnor.Adok,Alnor Adok Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 07, 2007,19,M,Child,Purok Muslim, Aleosan, Cotabato
339,Almoron.Adok,Almoron Adok Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 18, 2010,16,F,Child,Purok Muslim, Aleosan, Cotabato
340,Annaliza.Adok,Annaliza Adok Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 12, 2014,12,F,Child,Purok Muslim, Aleosan, Cotabato
341,Aljur.Adok,Aljur Adok Mamaluba,Purok Muslim,Upper Mingading, Aleosan, Cotabato,March 10, 2021,5,M,Child,Purok Muslim, Aleosan, Cotabato
342,Ali.Sinarimbo,Ali Sinarimbo Guiapar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,August 04, 1974,50,M,Head,Purok Muslim, Aleosan, Cotabato
343,Kongan.Diagao,Kongan Diagao Guiapar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 13, 1973,51,F,Spouse,Purok Muslim, Aleosan, Cotabato
344,Jowahier.Diagao,Jowahier Diagao Guiapar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,September 15, 2003,23,M,Child,Purok Muslim, Aleosan, Cotabato
345,Sarah.Guia malon,Sarah Guia malon Bolad,Purok Muslim,Upper Mingading, Aleosan, Cotabato,January 23, 1983,42,F,Head,Purok Muslim, Aleosan, Cotabato
346,Alinor.Dalemba,Alinor Dalemba Kulintang,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 04, 2000,20,M,Spouse,Purok Muslim, Aleosan, Cotabato
347,Ebpon.Saldo,Ebpon Saldo Bacar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 10, 1979,52,M,Head,Purok Muslim, Aleosan, Cotabato
348,Tonisa.Asi,Tonisa Asi Bacar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,July 10, 1984,40,F,Spouse,Purok Muslim, Aleosan, Cotabato
349,Karato.Asi,Karato Asi Bacar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,February 22, 2004,22,M,Child,Purok Muslim, Aleosan, Cotabato
350,Aisa.Asi,Aisa Asi Bacar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,May 21, 2007,19,F,Child,Purok Muslim, Aleosan, Cotabato
351,Alimudin.Asi,Alimudin Asi Bacar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,April 01, 2011,15,M,Child,Purok Muslim, Aleosan, Cotabato
352,Elborahim.Asi,Elborahim Asi Bacar,Purok Muslim,Upper Mingading, Aleosan, Cotabato,November 29, 2014,10,M,Child,Purok Muslim, Aleosan, Cotabato
$_muslim_paste_251_352$::TEXT AS raw_text
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
    ) AS valid_parts,
    regexp_match(
      line,
      '^([^,]+),([^,]+),([^,]+),([^,]+),(.+),(\d{1,2}\s+\d{4}),(\d+),([MFmf]),([^,]+),(.+)$'
    ) AS incomplete_date_parts
  FROM raw_lines
  WHERE source_line > 1
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
    TRIM(incomplete_date_parts[1]) AS house_no,
    TRIM(incomplete_date_parts[1]) AS household_no,
    public.normalize_resident_username(incomplete_date_parts[2]) AS username_base,
    TRIM(incomplete_date_parts[3]) AS full_name,
    regexp_split_to_array(TRIM(incomplete_date_parts[3]), '\s+') AS name_parts,
    NULL::DATE AS birthday,
    TRIM(incomplete_date_parts[7])::INTEGER AS age,
    CASE UPPER(TRIM(incomplete_date_parts[8]))
      WHEN 'M' THEN 'Male'
      WHEN 'F' THEN 'Female'
      ELSE NULL
    END AS sex,
    TRIM(incomplete_date_parts[9]) AS relationship_to_household_head,
    TRIM(incomplete_date_parts[10]) AS birthplace,
    'Muslim'::TEXT AS purok,
    TRIM(incomplete_date_parts[5]) AS address,
    'Incomplete source birthday: ' || TRIM(incomplete_date_parts[6]) AS source_note
  FROM parsed_lines
  WHERE valid_parts IS NULL
    AND incomplete_date_parts IS NOT NULL
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
  (SELECT COUNT(*) FROM resident_seed_base WHERE source_note IS NOT NULL) AS incomplete_birthday_rows,
  (SELECT COUNT(*) FROM parsed_lines WHERE valid_parts IS NULL AND incomplete_date_parts IS NULL) AS skipped_rows,
  (SELECT COUNT(*) FROM inserted_residents) AS inserted_residents,
  (SELECT COUNT(*) FROM existing_residents) AS matched_existing_residents,
  (SELECT COUNT(*) FROM created_accounts) AS created_accounts;

NOTIFY pgrst, 'reload schema';
