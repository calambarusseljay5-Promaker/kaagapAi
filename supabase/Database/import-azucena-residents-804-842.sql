-- Safe import for Purok Azucena resident records, households 804-842.
-- Run this full batch in the Supabase SQL Editor after the previous resident imports.
-- Source household groups are remapped by first appearance: 1 -> 804, 2 -> 715, etc.
-- Purok is stored as the app value "Azucena"; missing birthplace values use
-- "Purok Azucena, Upper Mingading, Aleosan, Cotabato".
-- Relationship order per household: first row Head, second row Spouse, all remaining rows Sibling.
-- Portal usernames are generated automatically from first name, last name, and household number.
-- Temporary resident portal password is household_no, then house_no, then the first 8 characters of the resident ID.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = public, extensions;

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

CREATE OR REPLACE FUNCTION public.parse_azucena_birthdate(value TEXT)
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
  clean_value := regexp_replace(clean_value, ',', '', 'g');
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

  IF year_value < 1900 OR year_value > 2100 THEN
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
  FROM regexp_split_to_table($azucena_rows$
HH|Last Name|First Name|Middle Name|Birthday|Sex|Birth Place|Educational Attainment|Occupation|Program
1|Alvarado|Erwin|Albarado|March 1 1981|Male|Toril, Davao City|Elementary Level|Driver|
1|Calamba|Emalyn|Telloro|September 27 1981|Female|Arizona, Midsayap|High School Graduate|Housewife|
1|Alvarado|Erwin|Calamba|January 1 2007|Male|Dualing Dist. Hospital|High School Level||
1|Alvarado|Erick Pado|Calamba|April 28 2015|Male|Dr. Amado Diaz Hospital|||
1|Alvarado|Kate Erieka|Calamba|September 12 2016|Female|MDCHI Midsayap|||
2|Agustin|Sofronio|Caryaga|September 19 1964|Male|Matalam, Cotabato|High School Graduate|Farmer|
2|Cabana|Adelina|Catanus|March 5 1960|Female|Upper. Mingading, Aleosan, Cotabato|High School Graduate|Housewife|
2|Agustin|Shedilen Joy|Cabana|September 16 1992|Female|Upper. Mingading, Aleosan, Cotabato|College Grad||
2|Agustin|John Paul|Cabana|June 4 2004|Male|Matalam, Cotabato|High School Graduate||
2|Agustin|Sheryl|Cabana|November 16 1996|Female|Matalam, Cotabato|College Graduate||
2|Agustin|Michael|Cabana|September 19 1998|Male|Upper. Mingading, Aleosan, Cotabato|High School Graduate||
3|Bello|Rodel|Doblado|February 11 1990|Male|Pigcawayan, Cotabato|High School Graduate|Farmer|
3|Cajeben|May Rose|Cabona|September 25 1995|Female|Upper. Mingading, Aleosan, Cotabato|High School Graduate|Housewife|
3|Bello|Mike Ronniel|Cajeben|December 30 2013|Male|Upper. Mingading, Aleosan, Cotabato|Elementary Level||
3|Bello|Alitha|Cajeben|July 17 2020|Female|Upper. Mingading, Aleosan, Cotabato|Daycare||
4|Caballero|Antonio|Saavedra|April 5 1958|Male|Pikit, Cotabato|Elementary Level|Farmer|
4|Cabanting|Erlinda|Cambalo|September 9 1961|Female|San Mateo, Pikit, Cotabato|High School Graduate|Housewife|
4|Caballero|Rexsun|Cabanting|January 21 1985|Male|Upper. Mingading, Aleosan, Cotabato|High School Graduate|CAFGU|
4|Caballero|Reynold|Cabanting|March 17 1990|Male|Upper. Mingading, Aleosan, Cotabato|High School Graduate|Employee|
4|Caballero|Arniel|Cabanting|March 17 1994|Male|Upper. Mingading, Aleosan, Cotabato|High School Graduate|Employee|
4|Caballero|Arnold|Cabanting|May 21 1996|Male|Upper. Mingading, Aleosan, Cotabato|High School Graduate||
4|Caballero|Dexter|Cabanting|August 21 1996||Upper. Mingading, Aleosan, Cotabato|High School Graduate||
4|Caballero|Arjay|Cabanting|December 2 1998|Male|Upper. Mingading, Aleosan, Cotabato|||
5|Cajeben|Carlos Jr.|Cabana|June 21 1979|Male|Upper. Mingading, Aleosan, Cotabato|High School Graduate|Farmer|
5|Tamagos|Basilia|Calamba|May 20 1977|Female|Upper. Mingading, Aleosan, Cotabato|High School Graduate|Housewife|
5|Cajeben|Carl Bryan|Tamagos|August 10 2005|Male|Upper. Mingading, Aleosan, Cotabato|||
5|Cajeben|Catherine|Tamagos|March 1 2007|Female|Upper. Mingading, Aleosan, Cotabato|||
5|Cajeben|Carlos II|Tamagos|March 20 2009|Male|Upper. Mingading, Aleosan, Cotabato|||
6|Cajeben|Jeffrey|Cabana|August 22 1981|Male|Upper. Mingading, Aleosan, Cotabato|College Level|Farmer|
6|Calamba|Sayne|Tadulan|November 22 1984|Female|Pintel, Aleosan|High School Level|Sales lady|4ps
6|Cajeben|Jeffrey Jr|Calamba|April 23 2007|Male|Upper. Mingading, Aleosan, Cotabato|High SchoolLevel||
7|Cajeben|Jomary|Cabana|June 10 1983|Male|San Mateo, Aleosan|High School Graduate|CAFGU|
7|Manicera|Mila|Malagia|January 28 1983|Female|Kulambeg, Pikit Cotabato|College Level|OFW|
8|Cajeben|Carlos Jr|Cantomayor|October 7 1958|Male|Upper. Mingading, Aleosan, Cotabato|High School Level|Farmer|
8|Cabana|Catalina|Catanus|September 15 1957|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Housewife|
9|Cajeben|Danito|Cambel|March 30 1958|Male|Upper. Mingading, Aleosan, Cotabato||Farmer|
9|Aldamar|Gloria|Calambro|March 20 1959|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Housewife|
9|Cajeben|Jonebert|Aldamar|November 21 1998|Male|Upper. Mingading, Aleosan, Cotabato|High School Level||
9|Caballero|Trixie|Cajeben|December 12 2012|Female|Upper. Mingading, Aleosan, Cotabato|Elementary Level|Student|
10|Cajeben|Warlito|Cambel|March 20 1949|Male|Bucai, Iloilo||Farmer|
10|Calawigan|Lilia|Cantor|July 24 1955|Female|||Housewife|
10|Cajeben|Jocelyn|Calawigan|July 25 1979|Female|Upper. Mingading, Aleosan, Cotabato|||
11|Cajeben|Florencio|Oresco|December 17 1970|Male|Upper. Mingading, Aleosan, Cotabato|High School Level|Farmer|
11|Dalumpines|Meliza|Jaza|December 14 1976|Female|Bagontapay, Mlang, Cotabato|High School Graduate|Housewife|4ps
11|Cajeben|Florane|Dalumpines|March 5 2002|Female|Upper. Mingading, Aleosan, Cotabato|College Graduate|Student|
11|Cajeben|Ivy Joy|Dalumpines|November 5 2003|Female|Upper. Mingading, Aleosan, Cotabato|College Graduate|Student|
11|Cajeben|Bon Carlo|Dalumpines|January 26 2005|Male|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
11|Cajeben|Jessa Mae|Dalumpines|August 8 2007|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
11|Cajeben|Ivan Karl|Dalumpines|January 11 2010|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
11|Cajeben|Carl Jane|Dalumpines|October 18 2012|Female|Upper. Mingading, Aleosan, Cotabato|Elementary Level|Student|
12|Cajeben|Dominica|Oresco|January 29 1951|Female|Upper. Mingading, Aleosan, Cotabato|Elementary Graduate|Housewife|
12|Cajeben|Reynaldo|Oresco|June 6 1968|Male|Upper. Mingading, Aleosan, Cotabato|Elementary Graduate|Farmer|
12|Cajeben|Noli|Oresco|January 9 1973|Male|Upper. Mingading, Aleosan, Cotabato|Elementary Level||
12|Cajeben|Eleazar|Oresco|October 17 1976|Male|Upper. Mingading, Aleosan, Cotabato|Elementary Level||
12|Cajeben|Teresita|Oresco|August 12 1984|Female|Upper. Mingading, Aleosan, Cotabato|High School Graduate|OFW|
12|Soloymon|Norhon|Cajeben|May 5 2003|Male|Upper. Mingading, Aleosan, Cotabato|College Level|Student|
13|Cajeben|Eduardo|Cantomayor|August 9 1971|Male|Pikit, Cotabato|High School Level|Farmer|
13|Calamba|Rosalie|Cantomayor|November 30 1976|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Housewife|
13|Cajeben|Angel Mae|Calamba|May 6 2003|Female|Upper. Mingading, Aleosan, Cotabato|College Grad|Student|
13|Cajeben|Mea Atthea|Calamba|January 23 2006|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
13|Cajeben|Charish Nicol|Calamba|April 13 2010|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
14|Cantomayor|Johnny|Petras|February 25 1977|Male|Pikit, Cotabato|High School Grad|Soldier|
14|Cantomayor|John Lloyd|Tabdina|May 18 2005|Male|Upper. Mingading, Aleosan, Cotabato|College Level|Student|
14|Cantomayor|Ivy Pearl|Tabdina|January 23 2011|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
14|Cantomayor|Johnny Jr|Tabdina|April 25 2016|Male|Upper. Mingading, Aleosan, Cotabato|Elementary Level|Student|
15|Cantomayor|Willy|Oresco|December 4 1964|Male|Upper. Mingading, Aleosan, Cotabato|High School Level|Farmer|
15|Calibayan|Cecil|Oresco|December 14 1969|Female|San Mateo, Pikit, Cotabato|College Grad|Housewife|
15|Cantomayor|Rodolf Vonn Raven|Calibayan|May 30 2004|Male|Upper. Mingading, Aleosan, Cotabato|College Level|Student|
15|Cantomayor|Willy Jr|Calibayan|October 5 2005|Male|Upper. Mingading, Aleosan, Cotabato|College Level|Student|
15|Cantomayor|Wilce Joyce Amor|Calibayan|December 2 2010|Female|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
16|Cantomayor|Ryan|Campollo|July 11 1989|Male|Bagolibas|High School Grad|Farmer|
16|Singcuya|Flora|Opiso|January 6 1988|Female|Misamis Occidental|College Level|Housewife|
16|Cantomayor|Rev Fem|Singcuya|January 9 2011|Female|Midsayap, Cotabato|High School Level|Student|
16|Cantomayor|Rio Frits|Singcuya|February 5 2012|Male|Midsayap, Cotabato|Elementary Level|Student|
16|Cantomayor|Ryan Jr|Singcuya|October 9 2018|Male|Midsayap, Cotabato|Elementary Level|Student|
17|Cantomayor|Reylan|Cabanig|July 10 1990|Male|Upper. Mingading, Aleosan, Cotabato|High School Grad|Farmer|
17|Oresco|Janet|Sanchez|October 12 1993|Female|Upper. Mingading, Aleosan, Cotabato|High School Grad|Housewife|
17|Cantomayor|Queenes Khia|Oresco|July 1 2010|Female|Upper. Mingading, Aleosan, Cotabato|Elementary Level|Student|
17|Cantomayor|Hendrick Lloyd|Oresco|April 28 2016|Male|Upper. Mingading, Aleosan, Cotabato|Elementary Level|Student|
17|Sanchez|Gloria|Campollo|December 8 1948|Female|Iloilo|||
17|Sanchez|Vicente|Campollo|January 8 1948|Male|Iloilo||Farmer|
18|Cantomayor|Rolando|Cajeben|June 14 1968|Male|Pikit, Cotabato||Farmer|
19|Cantomayor|Garry|Mirante|August 3 1981|Male|Upper. Mingading, Aleosan, Cotabato|High School Grad|Farmer|
19|Carpio|Rhea Mae|Andea|July 2 1990|Female|San Mateo|High School Grad|Housewife|
19|Cantomayor|Jaymark|Carpio|August 3 2011|Male|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
19|Cantomayor|John Larry|Carpio|April 30 2016|Male|Upper. Mingading, Aleosan, Cotabato|Elementary Level|Student|
20|Cantomayor|Jerry|Cajeben|August 10 1964|Male|Upper. Mingading, Aleosan, Cotabato|Elementary Level|Farmer|
20|Mirante|Lorna||September 11 1964|Female|Tulunan, Cotabato|High School Grad|Housewife|
20|Cantomayor|Herbert|Mirante|April 22 1989|Male|Upper. Mingading, Aleosan, Cotabato|High School Grad|Guard|
20|Cantomayor|Rosidan|Mirante|August 15 1993|Male|Upper. Mingading, Aleosan, Cotabato|High School Grad|CAFGU|
20|Cantomayor|Jefril|Mirante|April 28 2001|Male|Upper. Mingading, Aleosan, Cotabato|High School Grad|Student|
20|Cantomayor|Richard|Mirante|January 11 1991|Male|Upper. Mingading, Aleosan, Cotabato|High School Level|Student|
21|Cantomayor|Dionesio|Calawigan|June 25 1941|Male|Leon, Iloilo|Elementary Level|Farmer|
21|Calawigan|Endriqueta|Cantor|June 14 1949|Female|Leon, Iloilo|Elementary Level|Housewife|
22|Cantomayor|Avelino|Cajeben|October 20 1972|Male|Pikit, Cotabato|Elementary Grad|Farmer|
22|Sanapan|Mary Jolly|Sabueso|February 16 1976|Female|New Leon|Elementary Grad|Housewife|
22|Cantomayor|Arjay|Sanapan|August 20 1998|Male|Upper. Mingading, Aleosan, Cotabato|High School Grad||
22|Cantomayor|Shaina Rose|Sanapan|January 24 2007|Female|Upper. Mingading, Aleosan, Cotabato|College Level|Student|
22|Cantomayor|Avegel|Sanapan|June 17 2008|Female|Upper. Mingading, Aleosan, Cotabato||Student|
22|Cantomayor|John Lloyd|Sanapan|October 31 1983|Male|Upper Mingading, Aleosan, Cotabato||Student|
23|Calamba|Ebeneze|Cantomayor|July 22 1962|Male|Upper Mingading, Aleosan, Cotabato|High School Level|Farmer|
23|Catanus|Nerie|Calicoron|July 4 1963|Female|Pikit, Cotabato|High School Level|Housewife|
23|Calamba|Aiza Mae|Catanus|July 3 2006|Female|Upper Mingading, Aleosan, Cotabato|High School Level|Student|
24|Calamba|Dolores|Catanus|October 12 1942|Female|Bucan, Iloilo||Housewife|
25|Calamba|Arnel|Camel|October 5 1978|Male|Upper Mingading, Aleosan, Cotabato||Farmer|
25|Agorete|Cristal|Tancio|October 25 1996|Female|Bulanan, Midsayap, Cotabato|High School Level|Housewife|
25|Calamba|Angel Joy|Tadobon|July 18 1999|Female|Upper Mingading, Aleosan, Cotabato|College Level|Student|
25|Calamba|Angelyn|Tadobon|December 24 2004|Female|Upper Mingading, Aleosan, Cotabato|College Level|Student|
26|Calamba|Domingo|Cantomayor|December 20 1960|Male|Pikit, Cotabato|Elementary Grad|Farmer|
26|Telloro|Elsa|Cabaya|May 17 1962|Female|Pikit, Cotabato|High School Grad|Housewife|
27|Cantomayor|Reymond|Calibagan|February 22 1988|Male|Pagadian, Zamboanga del Sur|High School Level|Farmer|
27|Armonio|Maylen|Tenoria|March 18 1987|Female|Alamada,, Cotabato|Elementary Level|Housewife|
27|Cantomayor|Reymark|Armonio|November 27 2016|Male|Salunayan, Midsayap, Cotabato|Elementary Level|Student|
27|Cantomayor|Reymond Jr|Armonio|November 1 2022|Male|Midsayap, Cotabato|||
28|Calamba|Ronilo|Catanus|May 5 1984|Male|Upper Mingading, Aleosan, Cotabato|High School Level|Farmer|
28|Muloc|Lelita|Merggeten|April 25 1988|Female|Blangon|High School Level|Housewife|
29|Calawigan|Tomas|Camit|February 18 1955|Male|Bucari, Leon, Iloilo||Farmer|
29|Cantomayor|Vilma|Cajeben|January 14 1959|Female|Bucari, Leon, Iloilo||Housewife|
29|Calawigan|Drxyler|Cantomayor||Male|Upper Mingading, Aleosan, Cotabato|High School Grad||
30|Calawigan|Virginia|Cantor||Female|Leon, Iloilo|||
31|Calawigan|Crispin|Cantor||Male|||Farmer|
32|Canlero|Joven|Calambro|July 22 1982|Male|Leon, Iloilo|High School Grad|Farmer|
32|Calawigan|Mylen|Cantor|August 5 1984|Female|Cotabato City|Elementary Level|Housewife|
32|Canlero|Myra Janilla|Calawigan|September 28 2014|Female|Amas, Kidapawan City|Elementary Level|Student|
32|Canlaro|Joven Jr|Calawigan|April 11 2017|Male|Upper Mingading, Aleosan, Cotabato|Elementary Level|Student|
33|Canlero|Edgar|Tahum|December 15 1974|Male|Upper Mingading, Aleosan, Cotabato|High School Grad|Farmer|
33|Calawigan|Rubylyn|Cantomayor|October 20 1982|Female|Upper Mingading, Aleosan, Cotabato|High School Level|Housewife|
33|Canlero|Edcil Joy|Calawigan|May 23 2000|Male|Upper Mingading, Aleosan, Cotabato|||
33|Canlero|Jethric Lloyd|Calawibgan|June 13 2004|Male|Upper Mingading, Aleosan, Cotabato|||
33|Canlero|Ivan Carl|Calawigan|March 13 2006|Male|Upper Mingading, Aleosan, Cotabato|||
33|Canlero|Vincent|Calawigan|April 5 2011|Male|Upper Mingading, Aleosan, Cotabato|||
33|Canlero|Junvel Boy|Calawigan|May 22 1990|Male|Upper Mingading, Aleosan, Cotabato|||
34|Campollo|Danilo|Cabana|June 5 1970|Male|Upper Mingading, Aleosan, Cotabato|High School Level|Farmer|
34|Labiang|Leizel|Cajeben|February 19 1973|Female|Upper Mingading, Aleosan, Cotabato|High School|Housewife|
34|Campollo|Karen Obir|Labiang|December 24 1996|Female|Upper Mingading, Aleosan, Cotabato|||
34|Campollo|Kurt Klester|Labiang|October 23 2003|Male|Upper Mingading, Aleosan, Cotabato|College Level|Student|
35|Cantallopez|Elmer|Capulos|April 12 1973|Male|Bulangon|High School|Farmer|
35|Calawigan|Marissa|Cantomayor|January 12 1979|Female|Upper Mingading, Aleosan, Cotabato|High School|Housewife|
35|Cantallopez|Janrell|Calawigan|February 22 1996|Male|Upper Mingading, Aleosan, Cotabato||Student|
35|Cantallopez|Reymark|Calawigan|December 12 2002|Male|Upper Mingading, Aleosan, Cotabato||Student|
36|Catanus|Anita|Camral|July 23 1948|Female|Bucari, Iloilo||Housewife|
36|Catanus|Gaudencio|Camral|May 4 1983|Male|Upper Mingading, Aleosan, Cotabato|||
37|Catanus|Marlon|Cari|September 30 1972|Male|Upper Mingading, Aleosan, Cotabato||Farmer|
37|Ontal|Lialah Gracette||August 24 1977|Female|Parang, Maguindanao|College Grad|Teacher|
37|Catanus|Ralph Anthony|Ontal|January 14 1999|Male|Upper Mingading, Aleosan, Cotabato|College Level|Student|
37|Catanus|John Lloyd|Ontal|January 17 2006|Male|Upper Mingading, Aleosan, Cotabato|College Level|Student|
38|Catanus|Ruben|Calamba|December 26 1968|Male|Upper Mingading, Aleosan, Cotabato|College Grad|Farmer|
38|Elizada|Sheila Mae|Elegcia|September 6 1980|Female|Gimaras, Iloilo|College Grad|Teacher|
38|Catanus|Jollie Mia|Elizada|April 19 2006|Female|Upper Mingading, Aleosan, Cotabato|High School Level|Student|
38|Catanus|Renzele Dave|Elizada|May 3 2007|Male|Upper Mingading, Aleosan, Cotabato|High School Level|Student|
38|Catanus|Jexis Low|Elizada|December 2 2005|Male|Upper Mingading, Aleosan, Cotabato|High School Level|Student|
39|Catanus|Hermoso|Calamba|May 9 1958|Male|San Mateo, Pikit, Cotabato|Elementary Level|Farmer|
39|Cajeben|Jocelyn|Cantomayor|December 7 1960|Female|Upper Mingading, Aleosan, Cotabato|Elementary Level|Housewife|
39|Catanus|Helbert|Cajeben|||Upper Mingading, Aleosan, Cotabato|||
39|Catanus||Cajeben|||Upper Mingading, Aleosan, Cotabato|||
39|Repante||Catanus||||||
$azucena_rows$, E'\r?\n') WITH ORDINALITY AS line_data(line, ordinal)
  WHERE TRIM(line) <> ''
),
parsed_lines AS (
  SELECT
    source_line,
    line
  FROM raw_lines
  WHERE source_line > 1
),
source_rows AS (
  SELECT
    source_line,
    NULLIF(TRIM(split_part(line, '|', 1)), '') AS original_household_no,
    NULLIF(TRIM(split_part(line, '|', 2)), '') AS last_name,
    NULLIF(TRIM(split_part(line, '|', 3)), '') AS first_name,
    NULLIF(TRIM(split_part(line, '|', 4)), '') AS middle_name,
    NULLIF(TRIM(split_part(line, '|', 5)), '') AS birthdate_text,
    NULLIF(TRIM(split_part(line, '|', 6)), '') AS sex_text,
    NULLIF(TRIM(split_part(line, '|', 7)), '') AS birthplace_text,
    NULLIF(TRIM(split_part(line, '|', 8)), '') AS education_text,
    NULLIF(TRIM(split_part(line, '|', 9)), '') AS occupation_text,
    NULLIF(TRIM(split_part(line, '|', 10)), '') AS program_text
  FROM parsed_lines
  WHERE NULLIF(TRIM(split_part(line, '|', 1)), '') IS NOT NULL
    AND (
      NULLIF(TRIM(split_part(line, '|', 2)), '') IS NOT NULL
      OR NULLIF(TRIM(split_part(line, '|', 3)), '') IS NOT NULL
    )
),
household_map AS (
  SELECT
    original_household_no,
    (803 + ROW_NUMBER() OVER (ORDER BY MIN(source_line)))::TEXT AS household_no
  FROM source_rows
  GROUP BY original_household_no
),
resident_seed_base AS (
  SELECT
    source.source_line,
    source.original_household_no,
    map.household_no,
    source.last_name,
    source.first_name,
    NULLIF(source.middle_name, '-') AS middle_name,
    source.birthdate_text,
    public.parse_azucena_birthdate(source.birthdate_text) AS birthday,
    CASE UPPER(source.sex_text)
      WHEN 'M' THEN 'Male'
      WHEN 'MALE' THEN 'Male'
      WHEN 'F' THEN 'Female'
      WHEN 'FEMALE' THEN 'Female'
      ELSE NULL::TEXT
    END AS sex,
    CASE
      WHEN source.birthplace_text IS NULL OR source.birthplace_text IN ('-', 'N/A') THEN 'Purok Azucena, Upper Mingading, Aleosan, Cotabato'
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
    source.program_text,
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
    public.normalize_resident_username(CONCAT_WS('.', first_name, last_name) || household_no) AS username,
    CONCAT_WS(' ', first_name, middle_name, last_name) AS full_name,
    last_name,
    first_name,
    middle_name,
    NULL::TEXT AS email,
    NULL::TEXT AS phone,
    CASE household_order
      WHEN 1 THEN 'Head'
      WHEN 2 THEN 'Spouse'
      ELSE 'Sibling'
    END AS relationship_to_household_head,
    birthday,
    CASE
      WHEN birthday IS NOT NULL AND birthday <= CURRENT_DATE THEN EXTRACT(YEAR FROM age(CURRENT_DATE, birthday))::INTEGER
      ELSE NULL::INTEGER
    END AS age,
    sex,
    sex AS gender,
    birthplace,
    educational_attainment,
    occupation,
    LOWER(COALESCE(program_text, '')) = '4ps' AS is_4ps_member,
    FALSE AS is_solo_parent,
    NULL::TEXT AS civil_status,
    FALSE AS is_pwd,
    NULL::TEXT AS pwd_type,
    'Azucena'::TEXT AS purok,
    'Purok Azucena, Upper Mingading, Aleosan, Cotabato'::TEXT AS address,
    'Active'::TEXT AS status,
    birthdate_text
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
      birthday = COALESCE(resident.birthday, seed.birthday),
      age = COALESCE(resident.age, seed.age),
      sex = COALESCE(NULLIF(TRIM(resident.sex), ''), seed.sex),
      gender = COALESCE(NULLIF(TRIM(resident.gender), ''), seed.gender),
      birthplace = COALESCE(NULLIF(TRIM(resident.birthplace), ''), seed.birthplace),
      educational_attainment = COALESCE(NULLIF(TRIM(resident.educational_attainment), ''), seed.educational_attainment),
      occupation = COALESCE(NULLIF(TRIM(resident.occupation), ''), seed.occupation),
      is_4ps_member = COALESCE(resident.is_4ps_member, FALSE) OR seed.is_4ps_member,
      is_solo_parent = COALESCE(resident.is_solo_parent, FALSE) OR seed.is_solo_parent,
      civil_status = COALESCE(NULLIF(TRIM(resident.civil_status), ''), seed.civil_status),
      is_pwd = COALESCE(resident.is_pwd, FALSE) OR seed.is_pwd,
      pwd_type = COALESCE(NULLIF(TRIM(resident.pwd_type), ''), seed.pwd_type),
      purok = CASE
        WHEN NULLIF(TRIM(resident.purok), '') IS NULL THEN seed.purok
        WHEN public.normalize_resident_claim(resident.purok) = public.normalize_resident_claim('Purok Azucena') THEN seed.purok
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
   AND public.normalize_resident_claim(seed.household_no) = public.normalize_resident_claim(inserted.household_no)
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
  (SELECT COUNT(*) FROM parsed_lines) - (SELECT COUNT(*) FROM source_rows) AS skipped_rows,
  (SELECT COUNT(DISTINCT household_no) FROM resident_seed) AS household_count,
  (SELECT MIN(household_no) FROM resident_seed) AS first_household_no,
  (SELECT MAX(household_no) FROM resident_seed) AS last_household_no,
  (SELECT COUNT(*) FROM resident_seed WHERE birthdate_text IS NOT NULL AND birthday IS NULL) AS unparsed_birthdays,
  (SELECT COUNT(*) FROM updated_residents) AS updated_existing_residents,
  (SELECT COUNT(*) FROM inserted_residents) AS inserted_residents,
  (SELECT COUNT(*) FROM created_accounts) AS created_accounts;

NOTIFY pgrst, 'reload schema';

