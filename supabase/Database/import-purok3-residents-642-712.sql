-- Safe import for Purok-3 resident records, households 642-712.
-- Run this full batch in the Supabase SQL Editor after the previous resident imports.
-- Source household groups are remapped by first appearance: 1 -> 642, 2 -> 643, etc.
-- Purok is stored as the app value "Purok3"; birthplace/address use "Purok-3, Upper Mingading, Aleosan, Cotabato".
-- Existing matching residents are only filled where fields are missing or the birthplace only lacks the Purok-3 prefix.
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

CREATE OR REPLACE FUNCTION public.parse_purok3_birthdate(value TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_value TEXT;
  month_name TEXT;
  day_value INTEGER;
  year_value INTEGER;
  month_value INTEGER;
BEGIN
  clean_value := regexp_replace(TRIM(COALESCE(value, '')), '\.', '', 'g');
  clean_value := regexp_replace(clean_value, '\s+', ' ', 'g');

  IF clean_value = '' OR clean_value = '-' THEN
    RETURN NULL;
  END IF;

  month_name := LOWER(split_part(clean_value, ' ', 1));
  day_value := NULLIF(regexp_replace(split_part(clean_value, ' ', 2), '[^0-9]', '', 'g'), '')::INTEGER;
  year_value := NULLIF(regexp_replace(split_part(clean_value, ' ', 3), '[^0-9]', '', 'g'), '')::INTEGER;
  month_value := CASE month_name
    WHEN 'jan' THEN 1
    WHEN 'january' THEN 1
    WHEN 'feb' THEN 2
    WHEN 'february' THEN 2
    WHEN 'mar' THEN 3
    WHEN 'march' THEN 3
    WHEN 'apr' THEN 4
    WHEN 'april' THEN 4
    WHEN 'may' THEN 5
    WHEN 'jun' THEN 6
    WHEN 'june' THEN 6
    WHEN 'jul' THEN 7
    WHEN 'july' THEN 7
    WHEN 'aug' THEN 8
    WHEN 'august' THEN 8
    WHEN 'sep' THEN 9
    WHEN 'sept' THEN 9
    WHEN 'september' THEN 9
    WHEN 'oct' THEN 10
    WHEN 'october' THEN 10
    WHEN 'nov' THEN 11
    WHEN 'november' THEN 11
    WHEN 'dec' THEN 12
    WHEN 'december' THEN 12
    ELSE NULL
  END;

  IF month_value IS NULL OR day_value IS NULL OR year_value IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN make_date(year_value, month_value, day_value);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END
$$;

WITH raw_lines AS (
  SELECT
    ordinal::INTEGER AS source_line,
    line
  FROM regexp_split_to_table($purok3_rows$
HH No.	Last Name	First Name	Middle Name	Birth Date	Age	Sex	Birth Place	Educational Attainment	Occupation
1	Amador	Alfonso	Asadique	Aug. 15, 1950	74	Male	Purok-3, Upper Mingading, Aleosan, Cotabato	Elementary Level	Housekeeper
1	Amador	Helma	Catahum	Aug. 30, 1958	67	Female	Purok-3, Upper Mingading, Aleosan, Cotabato	Elementary Level	Housekeeper
1	Amador	Edison Mark	Amador	Jan. 9, 2002	23	Male	Purok-3, Upper Mingading, Aleosan, Cotabato	High School Level	Student
2	Arance	Ronan Jr.	Villaver	July 7, 1986	38	M	Upper Mingading, Aleosan, Cotabato	High School Level	Laborer
2	Arance	Sunshine	Camama	Jan. 21, 2002	22	M	Upper Mingading, Aleosan, Cotabato	High School Level	Retired Soldier
2	Arance	Fred Kevin	Camama	Sept. 9, 1989	34	M	Upper Mingading, Aleosan, Cotabato	College Level	OFW
2	Arance	Rolan	Casintahan	Mar. 24, 2001	19	M	Upper Mingading, Aleosan, Cotabato	High School Level	Student
3	Ambao	Harold	Casintahan	Sept. 18, 1981	47	M	Upper Mingading, Aleosan, Cotabato	Grade 8	Student
3	Ambao	Mary Grace	Taguam	Nov. 17, 1978	45	F	Upper Mingading, Aleosan, Cotabato	Grade 9	Farmer
3	Ambao	Precel	Taguam	Sept. 1, 2003	19	F	Upper Mingading, Aleosan, Cotabato	High School Level	Housekeeper
3	Ambao	Hazel Grace	Taguam	Apr. 25, 2009	14	F	Upper Mingading, Aleosan, Cotabato	Grade 10	Student
3	Ambao	Mickaela Joy	Tumbag	May 27, 2001	18	F	Upper Mingading, Aleosan, Cotabato	Grade 12 - College	Student
3	Ambao	Faith Irish	Tumbag	Feb. 18, 2003	16	F	Upper Mingading, Aleosan, Cotabato	Grade 10	Student
4	Belandres	Guillermo Sr.	Tumbag	Feb. 14, 1970	49	M	Purok-3, Upper Mingading, Aleosan, Cotabato	Grade 7	Construction Worker
4	Belotendos	Zyra	Ampie	July 18, 1982	41	F	Upper Mingading, Aleosan, Cotabato	Elementary Level	-
4	Belotendos	Gerald	Calaguas	Apr. 10, 2000	23	M	Upper Mingading, Aleosan, Cotabato	Senior High School Level	OFW
4	Belotendos	Genelyn	Calaguas	Aug. 27, 2002	20	F	Upper Mingading, Aleosan, Cotabato	Senior High School Level	Bakery Worker
4	Belotendos	Jessica	Calaguas	Nov. 8, 2005	18	F	Upper Mingading, Aleosan, Cotabato	Senior High School Level	House Helper
4	Belotendos	Jun Rey	Calaguas	Dec. 16, 2007	16	M	Upper Mingading, Aleosan, Cotabato	High School Level	Sari-sari Store
4	Belotendos	Guilbert Jr.	Calaguas	Mar. 19, 2010	14	M	Upper Mingading, Aleosan, Cotabato	Grade 11	Student
4	Belotendos	Jun-jie	Calaguas	Nov. 4, 2020	-	M	Upper Mingading, Aleosan, Cotabato	Elementary Level	Student
5	Dicta	Rogelio Jr.	Layda	Jun. 2, 1992	32	M	Upper Mingading, Aleosan, Cotabato	High School Level	Security Guard
5	Dicta	Cherly Joy	Camral	Sept. 24, 1992	32	F	Upper Mingading, Aleosan, Cotabato	High School Level	House Keeper
5	Dicta	Roel Ethan	Camral	Sept. 4, 2019	5	M	Upper Mingading, Aleosan, Cotabato	Grade 4	Student
5	Dicta	Stephanie Reina	Camral	Oct. 9, 2023	1	F	Upper Mingading, Aleosan, Cotabato	-	-
5	Dicta	Rodera Jade Jr.	Camral	July 24, 2019	5	M	Upper Mingading, Aleosan, Cotabato	Grade 4	N/A
6	Calamba	Edward	Calamba	Aug. 9, 1970	49	M	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
6	Calamba	Phobe	Estiloso	Feb. 8, 1979	44	F	Upper Mingading, Aleosan, Cotabato	High School Level	House Keeper
6	Calamba	Junyano	Calamba	Aug. 14, 1944	79	M	Purok-3, Upper Mingading, Aleosan, Cotabato	Elementary Level	Business Woman
7	Calamba	Rosarito	Calamba	Sept. 25, 1947	73	M	Purok-3, Upper Mingading, Aleosan, Cotabato	Elementary Level	House Keeper
7	Calamba	Cristina	Orpilla	Nov. 17, 1947	73	F	Purok-3, Upper Mingading, Aleosan, Cotabato	Elementary Level	House Keeper
8	Calamba	Renato	Calamba	July 11, 1976	47	M	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
8	Calamba	Cristine	Calamba	Jun. 30, 1983	43	F	Upper Mingading, Aleosan, Cotabato	High School Level	Housekeeper
8	Calamba	Karen Mae	Calamba	July 24, 2009	14	F	Upper Mingading, Aleosan, Cotabato	High School Level	Laborer / Employment
8	Calamba	Arnelin	Sanchez	Sept. 27, 1986	39	M	Upper Mingading, Aleosan, Cotabato	College Level	Farmer / OFW
10	Calamba	Marivel	Catalina	Oct. 9, 1990	34	F	Upper Mingading, Aleosan, Cotabato	High School Level	Sari-sari Store
10	Calamba	Vissen	Catalina	Apr. 1, 1994	30	M	Upper Mingading, Aleosan, Cotabato	High School Level	Laborer / Farm Worker
11A	Calamba	Jimmelyn	Comahig	July 6, 1991	33	F	Upper Mingading, Aleosan, Cotabato	High School Level	Housewife
11A	Calamba	Timmy	Comahig	July 7, 1993	31	M	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
11A	Calamba	Fresnida	Comahig	Feb. 18, 1945	79	F	Upper Mingading, Aleosan, Cotabato	Elementary	House Keeper
11B	Calamba	Genaro	Estanislao	July 13, 1973	51	M	Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
11B	Calamba	Benifacio	Estanislao	Aug. 20, 1942	82	M	Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
11B	Calamba	Estelita	Estanislao	Dec. 11, 1949	75	F	Upper Mingading, Aleosan, Cotabato	Elementary	House Keeper
11B	Calamba	Marites	Estanislao	June 12, 1974	50	F	Purok-3, Upper Mingading, Aleosan, Cotabato	High School Level	Vendor
11B	Calamba	Estelito Sr.	Estanislao	June 25, 1976	48	M	Upper Mingading, Aleosan, Cotabato	High School Level	Student
14	Calamba	Jolie	Calamba	May 22, 1981	43	F	Upper Mingading, Aleosan, Cotabato	High School Level	Fruit Vendor
14	Calamba	Delian	Calamba	Aug. 13, 1976	48	M	Upper Mingading, Aleosan, Cotabato	High School Level	Laborer
14	Calamba	Jhon Ulysses	Amistad	Nov. 17, 1994	30	M	Upper Mingading, Aleosan, Cotabato	College Level	Student
14	Calamba	Lalite	Amistad	March 25, 2000	24	F	Upper Mingading, Aleosan, Cotabato	High School Level	Student
14	Calamba	Khristel Joy	Amistad	March 2, 2010	14	F	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
14	Calamba	Krisia Joy	Amistad	Nov. 4, 2012	12	F	Upper Mingading, Aleosan, Cotabato	Grade 5	Student
14	Calamba	Krisly Charme	Amistad	June 17, 2017	7	F	Upper Mingading, Aleosan, Cotabato	Grade 2	-
16	Calicdan	Daryl	Feranil	March 13, 1987	37	M	Upper Mingading, Aleosan, Cotabato	College Level	Farmer
16	Calicaran	Nida	Feranil	Aug. 16, 1989	35	F	Upper Mingading, Aleosan, Cotabato	High School Level	House Keeper
16	Calicaran	Daryll	Parreño	Nov. 17, 1976	48	M	Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
16A	Calicaran	Merlita	Parreño	Feb. 19, 1948	76	F	Upper Mingading, Aleosan, Cotabato	Elementary	House Keeper
16A	Calicaran	Vianca	Parreño	June 3, 2006	18	F	Upper Mingading, Aleosan, Cotabato	High School Level	Student
16A	Calicaran	Jan	Parreño	June 3, 2008	16	M	Upper Mingading, Aleosan, Cotabato	High School Level	Student
16A	Calicaran	Riza	Parreño	Aug. 27, 2015	9	F	Aleosan, Cotabato / Kidapawan City	Grade 4	Student
16A	Calicaran	Ruel	Parreño	Oct. 16, 2017	7	M	Aleosan, Cotabato / Kidapawan City	Grade 2	Student
17	Calicaran	Jhonas	Calicaran	Sept. 14, 2007	17	M	Upper Mingading, Aleosan, Cotabato	Grade 8	Student
17	Calicaran	Jones	Calicaran	Aug. 6, 2010	14	M	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
17A	Cajelo	Cyndy Jhon	Calicaran	Nov. 2, 2012	12	F	Upper Mingading, Aleosan, Cotabato	Grade 6	Student
17A	Cajelo	Carla Jean	Calicaran	Aug. 20, 2015	9	F	Upper Mingading, Aleosan, Cotabato	Grade 3	Student
18	Calicaran	Rona	Canafranca	July 19, 1982	42	F	Upper Mingading, Aleosan, Cotabato	High School Level	Housewife
18	Calicaran	Cendylinda	Canafranca	Apr. 23, 2001	23	F	Upper Mingading, Aleosan, Cotabato	High School Level	Student
18	Calicaran	Glenn	Canafranca	Apr. 13, 2008	16	M	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
19A	Calicaran	Raymon	Marte	Dec. 11, 1979	45	M	Upper Mingading, Aleosan, Cotabato	High School Level	Student
19A	Calicaran	Marites	Marte	Nov. 9, 1980	44	F	Upper Mingading, Aleosan, Cotabato	Grade 5	Student
19A	Calicaran	Divino Glory	Marte	Dec. 21, 2014	10	F	Midsayap, North Cotabato	-	-
20	Calzada	Ramon James	Canil	June 30, 1989	35	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
20	Calzada	Gisselle	Benita	Apr. 18, 1993	31	Female	Upper Mingading, Aleosan, Cotabato	High School Level	OFW
20	Calzada	Jeivan	Benita	Feb. 11, 2015	9	Male	Upper Mingading, Aleosan, Cotabato	Grade 3	Student
20	Calzada	Genevieve	Benita	Feb. 19, 1975	49	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Teacher
21	Cinco	Generoso	Junnungan	Feb. 14, 1958	66	Male	Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
21	Cinco	Jhon Hector	Calambro	July 19, 1981	43	Male	Upper Mingading, Aleosan, Cotabato	College Graduate	Student
21	Cinco	Gene Jhoce Piane	Calambro	June 13, 2008	16	Female	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
21	Bongao	Genevieve R.	Calambro	Oct. 24, 2018	6	Female	Upper Mingading, Aleosan, Cotabato	Kindergarten	Student
21	Bongao	Patricio	Calambro	Nov. 23, 1930	94	Male	Purok-3, Upper Mingading, Aleosan, Cotabato	Grade 2	-
22	Calicaran	Agustin	Calamba	Dec. 11, 1976	48	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
22	Calicaran	Amerita	Pantinosa	Apr. 30, 1979	45	Female	Upper Mingading, Aleosan, Cotabato	-	Housekeeper
23	Camral	John	Cahapay	Apr. 1, 1967	57	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
23	Camral	Merla	Cahapay	June 11, 1973	51	Female	Upper Mingading, Aleosan, Cotabato	High School Level	Housekeeper
23	Camral	Jocel Mae	Cahapay	Mar. 29, 1987	37	Female	Upper Mingading, Aleosan, Cotabato	College - 4th Year	Self-Employed
24	Camral	Teodoro	Cahapay	Apr. 4, 1950	74	Male	Upper Mingading, Aleosan, Cotabato	Grade 4	Farmer
24	Camral	Arlyn Meto	Cahapay	Feb. 10, 1975	49	Female	Upper Mingading, Aleosan, Cotabato	Elementary	Housewife
24	Camral	Aron Joy	Cahapay	Feb. 13, 2011	13	Male	Upper Mingading, Aleosan, Cotabato	Grade 6	Student
24	Camral	Jhon Khristle	Cahapay	Jan. 1, 2008	16	Male	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
24	Camral	Jhon Ray	Cahapay	Apr. 26, 2011	13	Male	Upper Mingading, Aleosan, Cotabato	Grade 4	Student
25	Camral	Junia	Cahapay	Sept. 19, 1962	62	Male	Upper Mingading, Aleosan, Cotabato	Grade 8	Farmer
25	Camral	Jenelyn	Cahapay	July 14, 1985	39	Female	Upper Mingading, Aleosan, Cotabato	N/A	Student
25	Camral	Jesily	Cahapay	June 9, 2002	22	Female	Upper Mingading, Aleosan, Cotabato	N/A	-
25	Camral	Vicente	Cahapay	July 14, 2023	1	Male	Upper Mingading, Aleosan, Cotabato	-	-
26	Camral	Jesu Joy	Cahapay	July 14, 1980	44	Female	Upper Mingading, Aleosan, Cotabato	High School Level	Housekeeper
26	Camral	Alexander	Cahapay	July 14, 1979	45	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
26	Camral	Rosalie	Cahapay	Feb. 4, 2002	22	Female	Upper Mingading, Aleosan, Cotabato	High School Level	Housekeeper
27	Camral	Rolando	Cahapay	May 1, 1965	59	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
27	Camral	Othello	Cahapay	May 4, 1971	53	Male	Upper Mingading, Aleosan, Cotabato	College Level	Housekeeper
27	Camral	Chito	Cahapay	Oct. 11, 1975	49	Male	Upper Mingading, Aleosan, Cotabato	College Level	Farmer
28	Camral	Pio	Cahapay	Aug. 9, 1954	70	Male	Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
28	Camral	Maricel	Cahapay	Aug. 19, 1983	41	Female	Upper Mingading, Aleosan, Cotabato	College - 4th Year	Housekeeper
28	Camral	Althea Hiley	Cahapay	June 13, 2023	1	Female	Upper Mingading, Aleosan, Cotabato	N/A	N/A
29	Calicaran	Lucito	Calamba	Sept. 1, 1967	57	Male	Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
29	Calicaran	Nelia	Calamba	Oct. 4, 1974	50	Female	Upper Mingading, Aleosan, Cotabato	Elementary	Housekeeper
30	Calicaran	Nel	Calamba	Nov. 11, 1971	53	Male	Upper Mingading, Aleosan, Cotabato	College Graduate	Government Employee
30	Calicaran	Glen Riel	Calamba	Aug. 18, 1993	31	Male	Upper Mingading, Aleosan, Cotabato	College Graduate	Student
30	Calicaran	Aris Jane	Calamba	May 14, 1992	32	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Government Employee
31	Capilitan	Pearl Yvan Leigh	Antipuesto	June 1, 1988	35	Female	Upper Mingading, Aleosan, Cotabato	Vocational Course	Plantation Worker
31	Capilitan	Faye	Antipuesto	Dec. 27, 1992	31	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Private Employee
31	Capilitan	Fritzy	Antipuesto	June 30, 1992	31	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Private Employee
32	Capilitan	Jerry	Capistrano	Apr. 19, 1981	42	Male	Poblacion, Aleosan, Cotabato / Upper Mingading, Aleosan, Cotabato	College / BS Criminology	Farmer
32	Capilitan	Lorna	Capistrano	July 14, 1982	41	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Housekeeper
32	Capilitan	Jerry Jr.	Capistrano	Feb. 17, 2005	18	Male	Upper Mingading, Aleosan, Cotabato	Grade 12	Student
32	Capilitan	Jhon Rey	Capistrano	Mar. 7, 2007	16	Male	Upper Mingading, Aleosan, Cotabato	Grade 10	Student
32	Capilitan	Kenneth	Capistrano	June 25, 2013	10	Male	Upper Mingading, Aleosan, Cotabato	Grade 4	Student
32	Capilitan	Joan	Capistrano	June 19, 2017	6	Female	Upper Mingading, Aleosan, Cotabato	Grade 1	-
33	Calamba	Renante	Catedral	May 9, 1969	54	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
33	Calamba	Jocelyn	Catedral	Sept. 7, 1972	51	Female	Upper Mingading, Aleosan, Cotabato	High School Level	Housewife
33	Calamba	Arvin Cris	Catedral	Aug. 11, 1994	29	Male	Upper Mingading, Aleosan, Cotabato	College Level	Passenger Jeepney Driver
33	Calamba	Ronalyn	Catedral	Feb. 11, 1996	27	Female	Upper Mingading, Aleosan, Cotabato	High School Level	Housewife
33	Calamba	Nikko Brian	Catedral	Oct. 7, 2000	23	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Student
33	Calamba	Shene Grace	Catedral	Sept. 1, 2006	17	Female	Upper Mingading, Aleosan, Cotabato	Grade 12	Student
34	Calawigan	Elpidio	Calamba	Aug. 7, 1986	37	Male	Upper Mingading, Aleosan, Cotabato / Brgy. Palongog, Aleosan, Cotabato	College / BS Agriculture	Farmer / Driver
35	Calawigan	Thuanne	Camelo	Apr. 9, 1987	36	Male	Upper Mingading, Aleosan, Cotabato	Vocational Course / Heavy Equipment Operator / Driver	-
35	Calawigan	Marilou	Camelo	Nov. 5, 1982	41	Female	Upper Mingading, Aleosan, Cotabato	Elementary	Housewife
35	Calawigan	Jun Rey	Camelo	Mar. 3, 2005	18	Male	Upper Mingading, Aleosan, Cotabato / Poblacion, Aleosan, Cotabato	Grade 10	Student
35	Calawigan	Aira Mae	Camelo	Aug. 18, 2008	15	Female	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
36	Calawigan	Nenita	Canapatan	Apr. 6, 1938	85	Female	Purok-3, Upper Mingading, Aleosan, Cotabato	-	-
36	Calawigan	Zeny	Canapatan	Feb. 3, 1979	44	Female	Poblacion, Aleosan, Cotabato / Kidapawan City	High School Level	Sari-sari Store Owner
36	Calawigan	Jane	Canapatan	Oct. 21, 1980	43	Female	Kidapawan City / Midsayap, Cotabato	College / Science	Teacher
36	Calawigan	Keziahn	lisondra	Feb. 3, 1993	31	Male	Midsayap, North Cotabato	Grade 12 / Science	Student
37	Igcalinos	Aljon	Alfaro	Nov. 17, 1975	33	Male	Brgy. takipan, pikit, Cotabato	College graduate	Soldier
37	Igcalinos	Nezy	caponpon	Feb. 2, 1993	33	Female	Upper Mingading, Aleosan, Cotabato	College graduate	Teacher
37	Igcalinos	Zane	caponpon	Oct. 21, 2019	7	Female	Upper Mingading, Aleosan, Cotabato	Elementary Level	Student
37	Igcalinos	KEZIA	CAPONPON	Dec. 20, 2022		Female	Upper Mingading, Aleosan, Cotabato	decare	student
38	Cabaluna	Leony	altisada	Nov. 19, 1975		Female	Barangay lamot, alemodian	High school graduate	House wife
39	Catanus	Romy	Candarijan	Oct. 7, 1980	45	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
39	Catanus	Franscisca	Candarijan	Apr. 11, 1982	43	Female	Upper Mingading, Aleosan, Cotabato	High School Level	Housekeeper
39	Catanus	Maricris Marie	Candarijan	Nov. 17, 2004	21	Female	Kidapawan City, North Cotabato	Grade 11	Student
39	Catanus	Romar Vince	Candarijan	Apr. 1, 2007	18	Male	Kidapawan City, North Cotabato	Grade 8	Student
39	Catanus	Yenver	Candarijan	Apr. 7, 2021	4	Male	Purok-3 Upper Mingading, Aleosan, Cotabato	-	-
40	Catanus	Romy	Catubay	Apr. 23, 1935	88	Male	Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
40	Catanus	Teodora	Catubay	Apr. 5, 1940	83	Female	Upper Mingading, Aleosan, Cotabato	Elementary	Housekeeper
41	Cambal	Jose Isidro	Camoles	July 18, 1980	45	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Farmer
41	Cambal	Nita	Camoles	June 19, 1987	38	Female	Upper Mingading, Aleosan, Cotabato	College Level	Housekeeper
41	Cambal	Irio Francis	Camoles	Nov. 20, 2011	14	Male	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
41	Cambal	Jhon Ariel	Camoles	Apr. 9, 2017	8	Male	Upper Mingading, Aleosan, Cotabato	Grade 2	Student
41	Cambal	Jhon Paul	Camoles	Sept. 1, 2019	6	Male	Upper Mingading, Aleosan, Cotabato	Kindergarten	-
42	Camral	Isidro	Camoles	Feb. 14, 1954	71	Male	Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
42	Camral	Aida Vilma	Camoles	Aug. 6, 1960	65	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Brgy. Leader / Gov't Employee
42	Camral	Mercedes	Camoles	Apr. 20, 1974	51	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Teacher
43	Caponpon	Nenita	Juticap	June 1, 1975	50	Female	Upper Mingading, Aleosan, Cotabato	High School Level	Housewife
43	Caponpon	Romy	Juticap	Feb. 7, 1987	38	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Laborer
44	Clarito	Montserato	Lascanas	Mar. 9, 1985	40	Male	Kidapawan City, North Cotabato	College	Improvised Business / Sari-sari Store
44	Clarito	Raymund	Canillo	Nov. 3, 1993	32	Male	Kidapawan City, North Cotabato	College	Employee
44	Clarito	Jhulary	Canillo	June 22, 2015	10	Female	Cotabato City, Cotabato	Grade 4	Student
44	Clarito	Thio Lee	Canillo	Nov. 11, 2017	8	Female	Cotabato City, Cotabato	Grade 2	Student
44	Clarito	Ryshemae	Canillo	Apr. 20, 2004	21	Female	Cotabato City, Cotabato	Grade 12	Student
44	Clarito	Ryshemaed	Canillo	Feb. 4, 2010	15	Female	Cotabato City, Cotabato	Grade 7	Student
45	Clarito	Jambert	Almenario	Sept. 19, 1949	75	Male	Upper Mingading, Aleosan, Cotabato	College Graduate	Retired Soldier
45	Clarito	Tinita	Almenario	Jan. 19, 1958	66	Female	Upper Mingading, Aleosan, Cotabato	High School Level	Online Seller
45	Clarito	Jimbert	Almenario	Sept. 21, 2009	15	Male	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
46	Clarito	Isidro	Canama	July 8, 1933	92	Male	Upper Mingading, Aleosan, Cotabato	Non-formal Education	Housekeeper
46	Clarito	Jimena	Canama	Nov. 13, 1938	86	Female	Upper Mingading, Aleosan, Cotabato	Non-formal Education	Housekeeper
46	Clarito	Ian Kent	Canama	Mar. 13, 2011	14	Male	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
46	Clarito	Jhon Mark	Canama	Aug. 4, 2015	10	Male	Upper Mingading, Aleosan, Cotabato	Grade 3	Student
46	Clarito	Liana Kate	Canama	Oct. 21, 2021	4	Female	Upper Mingading, Aleosan, Cotabato	-	-
47	Clarito	Genaro	Canama	1946		Male	Purok-3 Upper Mingading, Aleosan, Cotabato	Elementary	Farmer
47	Clarito	Jenevieve	Canama	Oct. 1996		Female	Upper Mingading, Aleosan, Cotabato	High School Level	Housekeeper
47	Clarito	Reneciel	Canama	Dec. 22, 1991	34	Male	Upper Mingading, Aleosan, Cotabato	Vocational Course	Construction Worker
47	Clarito	Joraste	Canama	-		Female	Purok-3 Upper Mingading, Aleosan, Cotabato	-	-
47	Clarito	Princess Eira Jhoy	Canama	June 27, 2014	11	Female	Upper Mingading, Aleosan, Cotabato	Grade 3	Student
48	Cubin	Rosalie	Canama	Dec. 25, 1969	54	Female	Upper Mingading, Aleosan, Cotabato	Elementary	Housewife
48	Cubin	Jesic	Canama	Mar. 24, 1994	30	Male	Upper Mingading, Aleosan, Cotabato	High School Level	Laborer
48	Cubin	Princess Eira Daul	Canama	June 20, 2019	4	Female	Purok-3 Upper Mingading, Aleosan, Cotabato	Grade 3	Student
49	Caniete	Edmundo	Maricel	Mar. 24, 1975	41	Male	Kabuntalan, Lanao del Sur	Elementary Graduate	Farmer
49	Caniete	Gilberth	Navarate	Nov. 23, 1979	47	Male	Bompayon, Matanum, Cotabato	Elementary Graduate	Farmer
50	Codoy	Maricel	Ganeo	Dec. 29, 1948	36	Female	Malapatan, Bukidnon	High School Graduate	Housekeeper
50	Codoy	Gforibe	Navarate	Jan. 21, 1985	41	Female	Brgy. Caniras, Bukidnon	High School Graduate	Housekeeper
50	Codoy	Michael	Umblin	Aug. 15, 2001	25	Male	Asgayan, Bukidnon	Senior High Graduate	Factory Worker
50	Codoy	Miguel	Umblin	Apr. 15, 2003	23	Male	Asgayan, Bukidnon	Senior High Graduate	Laborer
50	Codoy	Mitchel	Umblin	May 1, 2004	22	Female	Asgayan, Bukidnon	3rd Year College	Student
50	Codoy	Mg-Lyn	Ganeo	Feb. 22, 2010	13	Female	Amas, Kidapawan City / Hospital Mid.	Grade 8	Student
50	Codoy	Mcken	Ganeo	June 18, 2015	11	Male	Amas, Kidapawan City / Hospital Mid.	Grade 5	Student
51	Lemana	Ronie	Sebulco	May 1, 1986	10	Male	Tulerente, Aleosan, Cotabato	Elementary Graduate	Farmer
51	Lemana	Jocelanie	Canama	July 5, 1988	39	Female	Upper Mingading, Aleosan, Cotabato	High School Graduate	Housekeeper
51	Lemana	Jeronnie Dave	Canama	Aug. 13, 2014	12	Male	Upper Mingading, Aleosan, Cotabato	Grade 6	Student
51	Lemana	Mark Jay	Canama	Mar. 18, 2016	10	Male	Upper Mingading, Aleosan, Cotabato	Grade 4	Student
51	Lemana	Prince Zian	Canama	Dec. 14, 2017	9	Male	Upper Mingading, Aleosan, Cotabato	Grade 3	Student
52	Calamba	Ervincz	Calawigan	Oct. 28, 1970	76	Female	Bocari, Libungan, Cotabato	Elementary Graduate	Housekeeper
52	Calamba	Dominico	Bidadilla	Feb. 11, 1980	46	Male	Upper Mingading, Aleosan, Cotabato	College Graduate	Government Employee
53	Panganiban	Jennifer	Villa	July 24, 1987	39	Female	Brgy. Poblacion, Aleosan, Cotabato	Vocational Course	Housewife
53	Panganiban	Riczel	Calamba	Feb. 22, 1988	39	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Teacher
53	Panganiban	Philip Zion	Calamba	Feb. 4, 2004	19	Male	Community Hospital, Midsayap	Grade 3	Student
53	Panganiban	Liliam	Calamba	Dec. 21, 2008	4	Female	Community Hospital, Midsayap	Pre-School / Grade 1	Student
53	Panganiban	Matias Thurdy	Calamba	Oct. 6, 2001	26	Male	Community Hospital, Midsayap	Pre-School	Student
54	Calambro	Lino	Ambanag	Dec. 26, 1980	46	Male	Kabuntalan, Libungan, Cotabato / Ilu-Ilu	High School Graduate	Farmer
54	Calambro	Flora	Tamayosa	Oct. 27, 1992	34	Female	Kabuntalan, Aleosan, Cotabato	High School Graduate	Housekeeper
54	Calambro	Floryd	Tamayosa	Oct. 15, 2017	9	Male	Upper Mingading, Aleosan, Cotabato	Grade 4	Student
55	Olidan	Rogelio	Valera	Sept. 16, 1969	49	Male	Brgy. Matagok, Alamada, Cotabato	High School Graduate	Security Guard
55	Olidan	Jeanette	Calamba	Mar. 15, 1979	40	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Day Care Worker
55	Olidan	Jastine Carl	Calamba	Nov. 25, 2005	21	Male	Living-in, Walnichek, Guzen City	Grade 12	Student
55	Olidan	Checa Jean	Calamba	May 6, 2008	18	Female	Upper Mingading, Aleosan / Cotabato City	1st Year College	Student
55	Olidan	Channa Joy	Calamba	Feb. 25, 2010	16	Female	Cotabato City / Poblacion, Aleosan	Grade 11	Student
55	Olidan	John Clyde	Calamba	Mar. 24, 2012	14	Male	Cotabato City / Poblacion, Aleosan	Grade 9	Student
56	Olidan	Jhanah Mae	Calamba	Sept. 4, 2022	9	Female	Community Hospital, Midsayap	Pre-School / Grade 1	Student
56	Valdez	Paul	Martinez	Apr. 14, 1984	32	Male	Restory Heights, Aleosan, Cotabato	High School Graduate	Sales Boy
56	Valdez	Daisy	Colicaran	July 2, 1984	42	Female	Upper Mingading, Aleosan, Cotabato	High School Graduate	Teacher
56	Valdez	John Paul	Colicaran	Aug. 8, 2007	19	Male	Cotabato City	4th Year College	Student
56	Valdez	Princess Kate	Colicaran	July 10, 2008	18	Female	Tambe, Poblacion, Aleosan / Cotabato City	4th Year College	Student
57	Tamagos	Letecia	Kalibara	Aug. 7, 1976	70	Female	Poblacion, Aleosan, Cotabato / Pikit, North Cotabato	-	-
58	Tamagos	Rufino Jr.	Kalibio	June 30, 1989	34	Male	Katipunan, Aleosan, Cotabato	Elementary Level	Farmer
58	Tamagos	Shiela Mae	Sabulao	Apr. 6, 1995	29	Female	Katipunan, Aleosan, Cotabato	High School Level	Housekeeper
58	Tamagos	Apple	Callaoza	Mar. 8, 2014	10	Female	Upper Mingading, Aleosan, Cotabato	Grade 3	Student
58	Tamagos	Ivan	Jamboza	July 16, 2017	7	Male	Upper Mingading, Aleosan, Cotabato	Grade 1	Student
59	Caalim	Vivencio	Cari	Sept. 20, 1965	59	Male	Upper Mingading, Aleosan, Cotabato	Grade 4	Farmer
59	Caalim	Nelia	Bueno	July 7, 1963	61	Female	Upper Mingading, Aleosan, Cotabato	3rd Year College	Housekeeper
59	Caalim	Vincent	Bueno	Aug. 26, 1970	54	Male	Upper Mingading, Aleosan, Cotabato	3rd Year College	Farmer
60	Caalim	Julius Vience	Bueno	July 1, 1995	29	Male	Upper Mingading, Aleosan, Cotabato	College Graduate	Teacher
60	Caalim	Diane	Abela	-		-	Purok-3 Upper Mingading, Aleosan, Cotabato	-	-
61	Caalim	Aaliyah Blake	Abela	Apr. 26, 1989	27	Male	Pigcawayan Hospital, Midsayap	College Graduate	Teacher
62	Magrenio	Niel	Bueno	Nov. 17, 1994	25	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Housekeeper
62	Magrenio	Willy Jr.	Govas	Dec. 20, 1979	41	Male	Kidapawan, North Cotabato	Elementary Graduate	Farmer
62	Magrenio	Jennifer	Camral	Apr. 28, 1981	43	Female	Upper Mingading, Aleosan, Cotabato	High School Graduate	Housekeeper
62	Magrenio	Wilna Girs	Camral	Sept. 6, 2001	26	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Housekeeper
62	Magrenio	Jhonny	Camral	Oct. 14, 2002	22	Male	Upper Mingading, Aleosan, Cotabato	College Graduate	OFW
62	Magrenio	Jan Grace	Camral	Jan. 25, 2004	21	Female	Upper Mingading, Aleosan, Cotabato	College Level	Homebased
62	Magrenio	Jomaric	Camral	Aug. 27, 2005	22	Male	Upper Mingading, Aleosan, Cotabato	College Level	-
62	Magrenio	Filiberta	Camral	Jan. 25, 2007	18	Male	Upper Mingading, Aleosan, Cotabato	Elementary Graduate	Sales Boy / Ukay-Ukay
62	Magrenio	Kate	Camral	Apr. 27, 2008	19	Female	Upper Mingading, Aleosan, Cotabato	Elementary Graduate	Student
62	Magrenio	Willy Jr. Jr.	Camral	Oct. 2, 2009	17	Male	Upper Mingading, Aleosan, Cotabato	4th Year College	Student
62	Magrenio	Krystelle Joy	Camral	Dec. 6, 2010	16	Female	Upper Mingading, Aleosan, Cotabato	Grade 11	Student
62	Magrenio	Twina	Camral	Oct. 11, 2012	12	Female	Upper Mingading, Aleosan, Cotabato	Grade 10	Student
63	Roderos	Norberto Jr.	Miquel	Dec. 6, 2016	10	Female	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
63	Roderos	Grecita	Miquel	Nov. 4, 2015	11	Female	Upper Mingading, Aleosan, Cotabato	Grade 4	Student
63	Roderos	Noriel Jr.	Calamba	May 6, 1991	41	Male	Bagoingcaya, Mlang, Cotabato	College Graduate	Farmer
63	Roderos	Carine Arandelle	Calamba	Jan. 13, 2013	35	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Housekeeper
63	Roderos	Noel Nicoli	Calamba	Oct. 18, 2014	13	Female	Amas Provincial Hospital, Kidapawan	Grade 8	Student
63	Roderos	Zedie Leonard	Calamba	Nov. 6, 2019	7	Male	Amas Provincial Hospital, Kidapawan	Grade 2	Student
64	Sanapan	Raul	Sabatero	Apr. 4, 1979	46	Male	Community Hospital, Midsayap	Pre-School	Student
64	Sanapan	Jovelyn	Canama	Nov. 24, 1979	44	Female	Katipunan, Aleosan, Cotabato	Elementary Graduate	Farmer
65	Cape	Lariza	Clarito	Apr. 29, 1984	42	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	Government Employee
65	Cape	Michael	Guillenare	July 15, 2003	23	Female	Upper Mingading, Aleosan, Cotabato	College Graduate	On-Temporary
65	Cape	Grace	Cani	Dec. 19, 1970	44	Female	Upper Mingading, Aleosan / Midsayap, Cotabato	College Graduate	Housekeeper
66	Penuna	Romie	Calamba	Jan. 11, 1966	44	Female	Katipunan, Libungan, Cotabato	Vocational Course	Retired Police
67	Cabaya	Piler	Calamba	Mar. 25, 1977	47	Male	Upper Mingading, Aleosan, Cotabato	Vocational Course	Housekeeper
68	uyy	Joseph	Olao	Sept. 26, 1989	34	Male	Boronginan, Alamada, Cotabato	High School Graduate	Diver
68	Jumuag	Dolly	Calicuran	Oct. 17, 1989	34	Female	Upper Mingading, Aleosan, Cotabato	High School Graduate	Merchandising Supervisor
68	Jumuag	Christine Mae	Calicuran	Dec. 7, 2009	14	Female	Boronginan, Alamada, Cotabato	Grade 10	Student
68	Jumuag	Cathrina May	Calicuran	Mar. 7, 2019	7	Female	Kidapawan District Hospital	Grade 2	Student
69	Juacate	Aniceto Jr.	Paulino	July 27, 1988	38	Male	San Pedro, Midsayap, Cotabato	High School	Construction Worker
69	Juacate	Glacyille	Amador	Nov. 26, 1989	28	Female	Upper Mingading, Aleosan, Cotabato	Senior High Graduate	Housemaid
69	Juacate	Brylle Ezric	Amador	July 30, 2019	7	Male	Upper Mingading, Aleosan, Cotabato	Grade 2	Student
70	Misone	Acdy	Dela Pena	Nov. 27, 1987	39	Male	OPRMC, Cotabato	College Graduate	Police Officer
70	Misone	Pabell Fe	Calambro	Feb. 10, 1989	31	Female	Cabalis, Aleosan, Cotabato	College Graduate	Teacher
70	Misone	Erika Venus	Calambro	Feb. 10, 2012	14	Female	Upper Mingading, Aleosan, Cotabato	Grade 9	Student
70	Misone	Aleigh Aisherly	Calambro	Nov. 24, 2013	13	Female	Upper Mingading, Aleosan, Cotabato	Grade 7	Student
71	Esgo	Noridin	Polaba	June 17, 2000	26	Male	Poblacion South Upi, Maguindanao	High School Graduate	Resort Promoter
72	Benit	Renalyn	Espartero	Apr. 13, 2004	22	Female	Rumunanga-ulb, South Upi, Maguindanao	Senior High Graduate	Housekeeper
72	Benit	Mhein Jhon	Benit	Jan. 9, 2026	4 mos.	Male	Dulangan District Hospital, Aleosan, Cotabato	N/A	N/A
$purok3_rows$, E'\r?\n') WITH ORDINALITY AS line_data(line, ordinal)
  WHERE TRIM(line) <> ''
),
parsed_lines AS (
  SELECT
    source_line,
    line,
    string_to_array(line, E'\t') AS parts
  FROM raw_lines
  WHERE source_line > 1
),
source_rows AS (
  SELECT
    source_line,
    NULLIF(TRIM(parts[1]), '') AS original_household_no,
    NULLIF(TRIM(parts[2]), '') AS last_name,
    NULLIF(TRIM(parts[3]), '') AS first_name,
    NULLIF(TRIM(parts[4]), '') AS middle_name,
    NULLIF(TRIM(parts[5]), '') AS birthdate_text,
    NULLIF(TRIM(parts[6]), '') AS age_text,
    NULLIF(TRIM(parts[7]), '') AS sex_text,
    NULLIF(TRIM(parts[8]), '') AS birthplace_text,
    NULLIF(TRIM(parts[9]), '') AS education_text,
    NULLIF(TRIM(parts[10]), '') AS occupation_text
  FROM parsed_lines
  WHERE array_length(parts, 1) = 10
),
household_map AS (
  SELECT
    original_household_no,
    (641 + ROW_NUMBER() OVER (ORDER BY MIN(source_line)))::TEXT AS household_no
  FROM source_rows
  GROUP BY original_household_no
),
resident_seed_base AS (
  SELECT
    source.source_line,
    map.household_no,
    source.last_name,
    source.first_name,
    NULLIF(source.middle_name, '-') AS middle_name,
    public.parse_purok3_birthdate(source.birthdate_text) AS birthday,
    CASE
      WHEN source.age_text ~ '^\d+$' THEN source.age_text::INTEGER
      ELSE NULL::INTEGER
    END AS age,
    CASE UPPER(source.sex_text)
      WHEN 'M' THEN 'Male'
      WHEN 'MALE' THEN 'Male'
      WHEN 'F' THEN 'Female'
      WHEN 'FEMALE' THEN 'Female'
      ELSE NULL
    END AS sex,
    CASE
      WHEN source.birthplace_text IS NULL OR source.birthplace_text IN ('-', 'N/A') THEN 'Purok-3, Upper Mingading, Aleosan, Cotabato'
      WHEN public.normalize_resident_claim(source.birthplace_text) = public.normalize_resident_claim('Upper Mingading, Aleosan, Cotabato') THEN 'Purok-3, Upper Mingading, Aleosan, Cotabato'
      WHEN public.normalize_resident_claim(source.birthplace_text) = public.normalize_resident_claim('Purok-3, Upper Mingading, Aleosan, Cotabato') THEN 'Purok-3, Upper Mingading, Aleosan, Cotabato'
      WHEN public.normalize_resident_claim(source.birthplace_text) = public.normalize_resident_claim('Purok-3 Upper Mingading, Aleosan, Cotabato') THEN 'Purok-3, Upper Mingading, Aleosan, Cotabato'
      ELSE source.birthplace_text
    END AS birthplace,
    CASE
      WHEN source.education_text IS NULL OR source.education_text IN ('-', 'N/A') THEN NULL::TEXT
      ELSE source.education_text
    END AS educational_attainment,
    CASE
      WHEN source.occupation_text IS NULL OR source.occupation_text IN ('-', 'N/A') THEN NULL::TEXT
      ELSE source.occupation_text
    END AS occupation,
    ROW_NUMBER() OVER (PARTITION BY source.original_household_no ORDER BY source.source_line) AS household_order
  FROM source_rows AS source
  JOIN household_map AS map
    ON map.original_household_no = source.original_household_no
),
resident_seed AS (
  SELECT
    source_line,
    household_no AS house_no,
    household_no,
    public.normalize_resident_username(first_name || '.' || last_name || household_no) AS username,
    CONCAT_WS(' ', first_name, middle_name, last_name) AS full_name,
    last_name,
    first_name,
    middle_name,
    NULL::TEXT AS email,
    NULL::TEXT AS phone,
    CASE household_order
      WHEN 1 THEN 'Head'
      WHEN 2 THEN 'Spouse'
      ELSE 'Child'
    END AS relationship_to_household_head,
    birthday,
    age,
    sex,
    sex AS gender,
    birthplace,
    educational_attainment,
    occupation,
    FALSE AS is_4ps_member,
    FALSE AS is_solo_parent,
    NULL::TEXT AS civil_status,
    FALSE AS is_pwd,
    NULL::TEXT AS pwd_type,
    'Purok3'::TEXT AS purok,
    'Purok-3, Upper Mingading, Aleosan, Cotabato'::TEXT AS address,
    'Active'::TEXT AS status
  FROM resident_seed_base
),
updated_residents AS (
  UPDATE public.residents AS resident
  SET full_name = COALESCE(NULLIF(TRIM(resident.full_name), ''), seed.full_name),
      last_name = COALESCE(NULLIF(TRIM(resident.last_name), ''), seed.last_name),
      first_name = COALESCE(NULLIF(TRIM(resident.first_name), ''), seed.first_name),
      middle_name = COALESCE(NULLIF(TRIM(resident.middle_name), ''), seed.middle_name),
      email = COALESCE(NULLIF(TRIM(resident.email), ''), seed.email),
      phone = COALESCE(NULLIF(TRIM(resident.phone), ''), seed.phone),
      house_no = COALESCE(NULLIF(TRIM(resident.house_no), ''), seed.house_no),
      household_no = COALESCE(NULLIF(TRIM(resident.household_no), ''), seed.household_no),
      relationship_to_household_head = COALESCE(NULLIF(TRIM(resident.relationship_to_household_head), ''), seed.relationship_to_household_head),
      birthday = COALESCE(seed.birthday, resident.birthday),
      age = COALESCE(resident.age, seed.age),
      sex = COALESCE(NULLIF(TRIM(resident.sex), ''), seed.sex),
      gender = COALESCE(NULLIF(TRIM(resident.gender), ''), seed.gender),
      birthplace = CASE
        WHEN NULLIF(TRIM(resident.birthplace), '') IS NULL THEN seed.birthplace
        WHEN public.normalize_resident_claim(resident.birthplace) = public.normalize_resident_claim('Upper Mingading, Aleosan, Cotabato') THEN seed.birthplace
        ELSE resident.birthplace
      END,
      educational_attainment = COALESCE(NULLIF(TRIM(resident.educational_attainment), ''), seed.educational_attainment),
      occupation = COALESCE(NULLIF(TRIM(resident.occupation), ''), seed.occupation),
      is_4ps_member = COALESCE(resident.is_4ps_member, FALSE) OR seed.is_4ps_member,
      is_solo_parent = COALESCE(resident.is_solo_parent, FALSE) OR seed.is_solo_parent,
      civil_status = COALESCE(NULLIF(TRIM(resident.civil_status), ''), seed.civil_status),
      is_pwd = COALESCE(resident.is_pwd, FALSE) OR seed.is_pwd,
      pwd_type = COALESCE(NULLIF(TRIM(resident.pwd_type), ''), seed.pwd_type),
      purok = CASE
        WHEN NULLIF(TRIM(resident.purok), '') IS NULL THEN seed.purok
        WHEN public.normalize_resident_claim(resident.purok) = public.normalize_resident_claim('Purok-3') THEN seed.purok
        ELSE resident.purok
      END,
      address = COALESCE(NULLIF(TRIM(resident.address), ''), seed.address),
      status = COALESCE(NULLIF(TRIM(resident.status), ''), seed.status),
      updated_at = NOW()
  FROM resident_seed AS seed
  WHERE public.normalize_resident_claim(resident.full_name) = public.normalize_resident_claim(seed.full_name)
    AND (
      (resident.birthday IS NOT NULL AND seed.birthday IS NOT NULL AND resident.birthday = seed.birthday)
      OR public.normalize_resident_claim(COALESCE(resident.household_no, resident.house_no, '')) = public.normalize_resident_claim(seed.household_no)
    )
    AND COALESCE(resident.status, 'Active') <> 'Archived'
  RETURNING
    resident.id,
    resident.status,
    seed.username,
    resident.house_no,
    resident.household_no
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
      AND (
        (resident.birthday IS NOT NULL AND seed.birthday IS NOT NULL AND resident.birthday = seed.birthday)
        OR public.normalize_resident_claim(COALESCE(resident.household_no, resident.house_no, '')) = public.normalize_resident_claim(seed.household_no)
      )
      AND COALESCE(resident.status, 'Active') <> 'Archived'
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
   AND seed.birthday IS NOT DISTINCT FROM inserted.birthday
),
target_residents AS (
  SELECT * FROM updated_residents
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
  (SELECT COUNT(*) FROM parsed_lines) AS pasted_rows,
  (SELECT COUNT(*) FROM source_rows) AS parsed_rows,
  (SELECT COUNT(*) FROM parsed_lines WHERE array_length(parts, 1) <> 10) AS skipped_rows,
  (SELECT COUNT(DISTINCT household_no) FROM resident_seed) AS household_count,
  (SELECT MIN(household_no) FROM resident_seed) AS first_household_no,
  (SELECT MAX(household_no) FROM resident_seed) AS last_household_no,
  (SELECT COUNT(*) FROM updated_residents) AS updated_existing_residents,
  (SELECT COUNT(*) FROM inserted_residents) AS inserted_residents,
  (SELECT COUNT(*) FROM created_accounts) AS created_accounts;

NOTIFY pgrst, 'reload schema';
