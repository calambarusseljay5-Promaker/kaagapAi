-- Safe import for Purok Buklod resident records, households 714-802.
-- Run this full batch in the Supabase SQL Editor after the previous resident imports.
-- Source household groups are remapped by first appearance: 1 -> 714, 2 -> 715, etc.
-- Purok is stored as the app value "Buklod"; missing birthplace values use
-- "Purok Buklod, Upper Mingading, Aleosan, Cotabato".
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

CREATE OR REPLACE FUNCTION public.parse_buklod_birthdate(value TEXT)
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
  FROM regexp_split_to_table($buklod_rows$
HH|Last Name|First Name|Middle Name|Birthday|Sex|Birth Place|Educational Attainment|Occupation
1|Alarcon|Severino Jr.|Libres|December 19, 1990|Male|San Pedro Midsayap Cot.|High School Graduate|Farmer
1|Alarcon|Rose May|Catahum|May 5, 1991|Female|Leon Iloilo|High School Graduate|House Keeper
1|Alarcon|Jasper|Catahum|December 6, 2012|Male|Upper Mingading Aleosan Cot.||Sudent
1|Alarcon|Honey Grace|Catahum|September 21, 2014|Female|Upper Mingading Aleosan Cot.||Student
1|Calawigan|Mercedes|Camit|October 26, 1949|Female|Leon Iloilo||
2|Acanto|Jose Jr.|Catedral|August 5, 1960|Male|Haniway Iloilo|Elementary Graduate|Framer
2|Labiang|Jenelyn|Cajeben|December 31, 1970|Female|Pikit San Mateo|Elementary Graduate|House Keeper
3|Agorete|Anesito|Pagalad|May 25, 1964|Male|Upper Bulanan Midsayap Cot.|High School Graduate|Framer
3|Labiang|Nelma|Singgaya|December 19, 1961|Female|Upper Mingading Pikit Cot.|High School Graduate|House Keeper
4|Aquita|Rodgie|Cagud|December 22, 1976|Male|Cawilihan Aleosan Cot.|Elementary Graduate|Farmer
4|Aquita|Merly|Camat|August 19, 1970|Female|Upper Mingading Pikit Cot.|Elementary Graduate|House Keeper
4|Aquita|Arnel|Camat|July 9, 2001|Male|Upper Mingading Aleosan Cot.|High School Graduate|Armor
4|Aquita|Queeni Claire|Camat|October 28, 2003|Female|Upper Mingading Aleosan Cot.|College Graduate|Student
4|Aquita|Queeni Joy|Camat|October 1, 2005|Female|Upper Mingading Aleosan Cot.|Senior High School Graduate|Student
4|Aquita|Rodgie Jr.|Camat|December 25, 2009|Male|Upper Mingading Aleosan Cot.||Student
5|Arellano|Eric|Calambro|September 14, 1993|Male|Midsayap Cot.|Elementary Level|Farmer
5|Arellano|Christle Mae|Singcuya|December 14, 1990|Female|Upper Mingading Aleosan Cot.|College Graduate|House Keeper
5|Arellano|Erich Joy|Singcuya|December 6, 2019|Female|MDEH Midsayap||
5|Arellano|Jaylon|Singcuya|March 2, 2021|Male|Upper Mingading Aleosan Cot.||
6|Bernal|Garry|Benigno|May 12, 1987|Male|Palao Libungan Cot.|Colleg Level|Farmer
6|Bernal|Michele|Cajutol|May 30, 1988|Female|Macabasa Alamada Cot.|College Graduate|Government Employee
6|Bernal|Hazel Mae|Cajutol|December 3, 2009|Female|Upper Mingading Aleosan Cot.||
6|Bernal|Princess Kaye Charm|Cajutol|December 26, 2010|Female|||
6|Bernal|Rachelle Joy|Cajutol|September 18, 2016|Female|Aleosan Doctor Hospital||
6|Bernal|Zia Blaise|Cajutol|March 9, 2025|Female|||
7|Buagas|Leonardo|Dalogdog|March 3, 1985|Male|Piaro Montay Libungan|High School Graduate|Farmer
7|Buagas|Joylen|Panes|January 25, 1986|Female|Upper Mingading Aleosan Cot.|College Graduate|House Keeper
7|Buagas|Romnick|Singcuya|September 28, 2009|Male|Upper Mingading Aleosan Cot.||
7|Buagas|Swethly Kwen|Singcuya|August 6, 2014|Female|Piaro Montay Libungan||
7|Buagas|Jerecho|Singcuya|April 4, 2017|Male|Upper Mingading Aleosan Cot.||
7|Buagas|Patrict|Singcuya|April 4, 2017|Male|Upper Mingading Aleosan Cot.||
8|Cabana|Argie|Diaz|||||
9|Cabana|Roderick|Diaz|February 13, 1991|Male|Lambayong Sultan Kudarat|High School Graduate|Farmer
9|Cabana|Jovelyn|Cajeben|October 3, 1996|Female|Upper Mingading Aleosan Cot.|High School Graduate|House Keeper
9|Cabana|Angelica Grace|Cajeben|July 30, 2014|Female|Upper Mingading Aleosan Cot.||
9|Cabana|Mary Grace|Cajeben|August 16, 2018|Female|Walker Paanakan Midsayap||
9|Cabana|Angelo|Cajeben|December 12, 2021|Male|Upper Mingading Aleosan Cot.||
10|Cabarles|Jeffrey|Cantomayor|September 13, 2002|Male|Sta. Cruz Aleosan Cot.|High School Graduate|Sales Boy
10|Catahum|Vanessa|Camino|December 24, 2002|Female|Upper Mingading Aleosan Cot.|Senior High School Graduate|House Keeper
10|Catahum|Kaziah Maurine|Camino|August 5, 2022|Female|Aleosan Doctor Hospital||
11|Caburatan|Dennis|Calubo|December 16, 1993|Male|New Leon Aleosan Cot.|High School Graduate|Farmer
11|Caburatan|Rhea Ann|Calubo|December 8, 2000|Female|Lower Lubangan Sampaguita St. Pariz|Senior High School Graduate|House Keeper
11|Caburatan|Kenth Edriane|Calubo|May 27, 2019|Male|Amado Hospital||
11|Caburatan|Khate Andrea|Calubo|June 7, 2021|Female|||
12|Cajeben|Emilyn|Cantomayor|June 8, 1989|Female|Upper Mingading Aleosan Cot.|High School Graduate|
12|Cajeben|Kurth Sherwin|Cantomayor|November 6, 2019|Male|MDCH Midsayap Cot.||
13|Cajiben|Danny|Cantomayor|November 25, 1978|Male|Upper Mingading Aleosan Cot.|High School Graduate|Farmer
13|Alinday|Rosalie|Catahum|January 15, 1983|Female|Tomado Aleosan Cot.|High School Graduate|House Keeper
13|Alinday|Angelica Nicole|Catahum|September 1, 2008|Female|Upper Mingading Aleosan Cot.||
13|Alinday|Chrisha Micaelah|Catahum|December 25, 2011|Female|Upper Mingading Aleosan Cot.||
14|Cajeben|Melbert|Camat|April 14, 1986|Male|Upper Mingading Aleosan Cot.|High School Graduate|Farmer
14|Calamba|Amie Rose|Talaman|August 2, 1988|Female|Upper Mingading Aleosan Cot.|College Graduate|House Keeper
14|Calamba|Phillian Bless|Talaman|September 5, 2015|Female|Upper Mingading Aleosan Cot.||
14|Calamba|Keziah Gweny|Talaman|July 31, 2023|Female|Upper Mingading Aleosan Cot.||
15|Cajeben|Lodivico|Cantomayor|July 6, 1958|Male|Leon Iloilo|Elementary Graduate|Farmer
15|Camat|Sherly|Cantomayor|May 8, 1962|Female|Upper Mingading Pikit Cot.|High School Graduate|House Keeper
16|Cajeben|Jaylord|Camat|March 22, 1999|Male|Upper Mingading Aleosan Cot.|College Graduate|Cafgo
16|Mula Cruz|Bernadeth|Custudio|February 11, 1997|Female||College Graduate|House Keeper
16|Mula Cruz|Ayred Gideon|Custudio|January 29, 2024|Male|5 Star Midsayap||
17|Cajeben|Vymsel|Camat|April 26, 1991|Male|Upper Mingading Aleosan Cot.|College Graduate|Farmer
17|Cagalitan|Hanna Jean|Camat|June 2, 2000|Female|Tomado Aleosan Cot.|College Graduate|Private Employee
18|Cajeben|Emelio|Cantomayor|August 1, 1962|Male|Upper Mingading Pikit Cot.||
18|Cabarles|Lorna|Cantomayor|September 28, 1966|Female|San Mateo Pikit Cot.||
18|Cabarles|Dexter|Cantomayor|July 28, 1999|Male|Upper Mingading Pikit Cot.|College Graduate|Private Employee
19|Cajeben|Bernabe Sr.|Calamba|January 1, 1977|Male|Upper Mingading Pikit Cot.|High School Graduate|Farmer
19|Cajeben|Chaneza||December 27, 1979|Female|Zamboanga Del Norte|High School Graduate|House Keeper
19|Cajeben|Chaneber||August 18, 2003|Male|Upper Mingading Aleosan Cot.||
19|Cajeben|Charles||July 31, 2005|Male|||
19|Cajeben|Sharesa||April 2, 2010|Female|||
19|Cajeben|Charmen Jane||March 30, 2014|Female|||
19|Cajeben|Bernabe Jr.||November 24, 2016|Male|||
20|Cabigonda|Reynold||August 27, 1986|Male|Midpapan 2, Pigcawayan Cot.||
20|Cabigonda|Jackelyn||January 15, 1987|Female|Upper Mingading Aleosan Cot.||
21|Cajeben|Rodrix Sr.|Calawigan|July 21, 1975|Male|Upper Mingading Pikit Cot.||
21|Tahum|Mary Jean|Calawigan|July 10, 1975|Female|Upper Mingading Pikit Cot.||
21|Tahum|Rodrix Jr.|Calawigan|June 14, 2006|Male|Upper Mingading Aleosan Cot.||
21|Tahum|Rey Jay|Calawigan|April 14, 2008|Male|Upper Mingading Aleosan Cot.||
21|Tahum|Erich May|Calawigan|May 26, 2011|Female|Upper Mingading Aleosan Cot.||
21|Tahum|Ian Carl|Calawigan|January 18, 2014|Male|Upper Mingading Aleosan Cot.||
22|Cajeben|Rodrigo|Cantomayor|November 25, 1964|Male|Upper Mingading Pikit Cot.||
22|Calawigan|Mailyn|Caligiran|July 12, 1981|Female|||
22|Calawigan|Reyalyn Joy|Caligiran|January 6, 2010|Female|Upper Mingading Aleosan Cot.||
22|Calawigan|Raisa Grace|Caligiran|September 13, 2014|Female|||
22|Calawigan|Meloh John|Caligiran|January 29, 2021|Male|||
23|Cajiben|Lucila|Calawigan|October 31, 1951|Female|Leon Iloilo||
23|Cajiben|Generoso|Calawigan|July 25, 1978|Male|Upper Mingading Aleosan Cot.||
23|Cajiben|Ariel|Calawigan|September 5, 1987|Male|Upper Mingading Aleosan Cot.||
24|Cajeben|Ronie Sr.|Calawigan|August 27, 1976|Male|Upper Mingading Aleosan Cot.||
24|Cajeben|Mery Joy|Calawigan|September 1, 1978|Female|Upper Mingading Aleosan Cot.||
24|Cajeben|Romnic|Calawigan|May 18, 2003|Male|Upper Mingading Aleosan Cot.||
24|Cajeben|Raffuncil|Calawigan|May 10, 2008|Female|Upper Mingading Aleosan Cot.||
24|Cajeben|Bonnard|Calawigan|January 16, 2012|Male|Upper Mingading Aleosan Cot.||
24|Cajeben|Rhea Mae|Calawigan|December 12, 2010|Female|Upper Mingading Aleosan Cot.||
25|Cajeben|Moreta|Cajutol|March 2, 1958|Female|Leon Iloilo||
25|Cajeben|Juan|Cajutol|October 5, 1977|Male|Upper Mingading Pikit Cot.||
25|Cajeben|Efren|Cajutol|May 16, 1982|Male|Upper Mingading Pikit Cot.||
25|Cajeben|Jilbert|Cajutol|August 16, 1988|Male|Upper Mingading Aleosan Cot.||
25|Cajeben|Jimriel|Cajutol|August 20, 1995|Male|Upper Mingading Aleosan Cot.||
26|Cajeben|Romnick Dave|Calawigan|February 4, 2007|Male|Upper Mingading Aleosan Cot.||
26|Cajeben|Anna Joy|Calawigan||Female|||
26|Cajeben|Afzin Dave|Calawigan||Male|Dualing Hospital||
27|Cajeben|Ronie Jr.|Tahum|February 13, 2001|Male|Upper Mingading Aleosan Cot.||
27|Tagudanao|Cariel|Candole|April 6, 2001|Female|||
27||Princess Joy|Candole|January 24, 2022|Female|Dualing Hospital||
28|Cajutol|Mauro Sr.||August 22, 1964|Male|Leon Iloilo||
28|Cajutol|Wenefreda|Camino|October 15, 1963|Female|Leon Iloilo||
28|Cajutol|Wilbert|Camino|October 30, 2000|Male|Upper Mingading Aleosan Cot.||
28|Cajutol|Monaliza|Camino|March 15, 2004|Female|Upper Mingading Aleosan Cot.||
29|Cajutol|Marven|Camino|September 30, 1990|Male|Alamada North Cot.||
29|Deniaga|Rebecc Rebecca|Cabarles|November 11, 1986|Female|San Mateo Aleosan Cot.||
30|Cajutol|Mauro Jr.||November 6, 2006|Male|Upper Mingading Aleosan Cot.||
30|Tadiaque|KC Jane||March 17, 2007|Female|Katalicanan Aleosan Cot.||
30|Cajutol|ZY Maureen||April 22, 2025|Female|Aleosan District Hospital||
31|Calawigan|Richard Sr.|Caligaran|March 13, 1976|Male|Upper Mingading Pikit Cot.||
31|Bacao|Alma||February 22, 1977|Female|Tolido Cebu||
31|Bacao|Adrian||December 20, 1997|Male|Upper Mingading Aleosan Cot.||
31|Bacao|Airace Joy||January 18, 2007|Female|Upper Mingading Aleosan Cot.||
31|Bacao|Princess||February 20, 2009|Female|Upper Mingading Aleosan Cot.||
31|Bacao|Richyle||March 13, 2011|Female|||
31|Bacao|Richard Jr.||July 2, 2014|Male|||
31|Bacao|Nicely Queen||October 24, 2019|Female|Amado Hospital||
31|Bacao|Rhazel Kent||April 17, 2004|Male|Upper Mingading Aleosan Cot.||
31|Daquioag|Maria Joy||January 9, 2008|Female|||
32|Calawigan|Leonila||March 12, 1948|Female|Bucari Leon Iloilo||
32|Calawigan|Helen||March 13, 1970|Female|Bucari Leon Iloilo||
33|Calawigan|Jeofry|Caligaran|April 16, 1979|Male|Upper Mingading Aleosan Cot.||
33|Catahum|Marry Ann||August 3, 1983|Female|Upper Mingading Aleosan Cot.||
33|Catahum|Prince Kenlly||June 20, 2006|Male|Upper Mingading Aleosan Cot.||
34|Calibayan|Ricky|Malinao|November 27, 1990|Male|Tomado Aleosan Cot.||
34|Calawigan|Cherelyn|Caligiran|September 27, 1987|Female|Upper Mingading Aleosan Cot.||
34|Calawigan|Ricky Boy||November 25, 2011|Male|Tomado Aleosan Cot.||
35|Camat|Jenebert Sr.|Cantomayor|October 25, 1985|Male|Upper Mingading Aleosan Cot.||
35|Jarme|Teresita||October 18, 1988|Female|Kitubod Libungan||
35|Jarme|Jemerie|Jarme|December 12, 2010|Male|Katalicanan Aleosan Cot.||
35|Jarme|Jenebert Jr.|Jarme|December 4, 2012|Male|Katalicanan Aleosan Cot.||
35|Jarme|Christian Dave|Jarme|May 3, 2016|Male|Katalicanan Aleosan Cot.||
36|Camat|Ronald|Cantomayor|November 4, 1976|Male|Upper Mingading Pikit Cot.||
36|Cagape|Rovelyn||July 3, 1982|Female|New Panay Pikit Cot.||
36|Cagape|Roldan|Cagape|March 19, 2001|Male|Upper Mingading Aleosan Cot.||
36|Cagape|Honey Grace|Cagape|December 11, 2005|Female|Upper Mingading Aleosan Cot.||
36|Cagape|Queen Zebel|Cagape|January 18, 2010|Female|Upper Mingading Aleosan Cot.||
37|Cajutol|Marlou||August 20, 1998|Male|Upper Mingading Aleosan Cot.||
37|Cajutol|Joyce||March 7, 1999|Female|Molave drive 1 Novaliches Quezon City||
37|Cajutol|Ezekiel Isaiah||December 11, 2022|Male|SPMC Davao||
38|Calamba|Myrna|Cabana|October 10, 1958|Female|Upper Mingading Pikit Cot.||
38|Calamba|Almar|Capilitan|March 26, 1976|Male|Macabasa Alamada Cot.||
39|Calamba|Paul Jhon|Talaman|May 24, 2008|Male|Upper Mingading Aleosan Cot.||
39|Cullada|Glydel Joy|Malinda|January 11, 2007|Female|Bago Impasug-ong Bukidnon||
40|Calawigan|Allan Mark||March 21, 2001|Male|Upper Mingading Aleosan Cot.||
40|Cadunggan|Shaina||April 23, 2006|Female|Tomado Aleosan Cot.||
41|Calianga|Edwardo|Necesito|April 8, 2002|Male|Pagangan Aleosan Cot.||
41|Calawigan|Jeofa Mae|Catahum|July 9, 2004|Female|Upper Mingading Aleosan Cot.||
41|Calawigan|Kyle Ythan||April 4, 2023|Male|||
42|Cambal|Aurora||November 25, 1945|Female|Leon Iloilo||
42|Cambal|Maufe||April 21, 1983|Female|Upper Mingading Aleosan Cot.||
43|Cambal|Jeonefer|Calawigan|January 27, 1978|Male|Upper Mingading Pikit Cot.||
43|Cambal|Maricel||September 18, 1976|Female|Tomado Pikit Cot.||
43|Cambal|Justin||August 4, 2001|Male|Upper Mingading Aleosan Cot.||
43|Cambal|Junrei||July 8, 2003|Male|||
43|Cambal|Jelika Bea||December 7, 2007|Female|||
43|Cambal|Jedrick Jay||July 30, 2005|Male|||
44|Catahum|Christian Henry|Cajeben|December 20, 2004|Male|Upper Mingading Aleosan Cot.||
44|Catahum|Minche||August 8, 2004|Female|Sitio Condiring Matalam||
44|Catahum|Arkent|Gatchalian|October 17, 2023|Male|Amas Kidapawan Hospital||
45|Catahum|Ronie|Capitle|March 4, 1981|Male|Upper Mingading Pikit Cot.||
45|Cajeben|Lovelyn||November 28, 1984|Female|Upper Mingading Pikit Cot.||
45|Cajeben|Ruffelyn||October 23, 2006|Female|Upper Mingading Aleosan Cot.||
45|Cajeben|Ronniell||March 15, 2010|Male|||
45|Cajeben|Catherine||August 8, 2016|Female|Aleosan District Hospital||
46|Talha|Rodelo|Cajutol|July 21, 1980|Male|||
46|Catahum|Emely||June 6, 1980|Female|||
46|Catahum|Eugene||November 8, 2007|Male|||
46|Catahum|Eucebel||June 16, 2009|Female|||
47|Catahum|Marcelo|Guray|October 17, 1998|Male|Upper Mingading Aleosan Cot.||
47|Corollo|Luisa|Beltran|December 8, 1990|Female|Cagayan de Oro City||
47|Corollo|Cielo Luis||May 29, 2023|Male|Upper Mingading Aleosan Cot.||
48|Catahum|Nicanor|Cabana|January 10, 1962|Male|Upper Mingading Pikit Cot.||
48|Talaron|Verginia||April 29, 1960|Female|Tubungan Iloilo||
49|Catahum|Warlito|Capitle|June 29, 1972|Male|Upper Mingading Pikit Cot.||
49|Catahum|Mylin|Capio|March 22, 1978|Female|Upper Mingading Pikit Cot.||
49|Catahum|Jenie Rose|Capio|May 19, 2001|Female|Upper Mingading Aleosan Cot.||
49|Catahum|Julliana Kate|Capio|April 30, 201|Female|Amado Hospital||
50|Catahum|Romeo|Tadulan|October 13, 1939|Male|Leon Iloilo||
50|Catahum|Vilma||October 4, 1974|Female|Upper Mingading Pikit Cot.||
50|Catahum|Reynold||August 6, 1986|Male|Upper Mingading Pikit Cot.||
51|Catahum|Wennie|Capitle|August 25, 1968|Male|Upper Mingading Pikit Cot.||
51|Catahum|Vilma||April 19, 1971|Female|Leon Iloilo||
51|Catahum|Janriel||September 18, 1991|Male|Upper Mingading Aleosan Cot.||
51|Catahum|Jonathan||February 12, 2004|Male|Upper Mingading Aleosan Cot.||
52|Catahum|Gerald|Capilitan|June 14, 1986|Male|Upper Mingading Aleosan Cot.||
52|Camelote|Maria Christy||September 13, 1992|Female|Leon Iloilo||
52|Camelote|Queenie Love||May 23, 2013|Female|Tomado Aleosan Cot.||
52|Camelote|John Francis||October 10, 2014|Male|Tomado Aleosan Cot.||
52|Camelote|Kristle Jane||April 28, 2019|Female|5 Star Midsayap||
53|Catahum|Paterno|Cabana|November 5, 1955|Male|Leon Iloilo||
53|Calawigan|Nelly|Camit|December 1, 1953|Female|Leon Iloilo||
54|Catahum|Joliver||||||
55|Dela Cuesta|Elmer|Mosquera|October 13, 1971|Male|Canlaon Negros Occidental||
55|Cajeben|Rosalia|Cantomayor|February 11, 1972|Female|Upper Mingading Pikit Cot.||
55|Cajeben|Elmer Jr.||November 5, 1995|Male|Upper Mingading Aleosan Cot.||
55|Cajeben|Eric Lord||June 3, 2001|Male|||
56|Dela Cuesta|Emerald Jhon|Cajeben|May 8, 19997|Male|Upper Mingading Aleosan Cot.||
56|Mallo|Raylene|Caballero|March 26, 2002|Female|Laportuna||
56|Dela Cuesta|Ethaniel|Mallo|November 9, 2021|Male|Upper Mingading Aleosan Cot.||
57|Capio|Ronald|Tahum|October 2, 1977|Male|Upper Mingading Pikit Cot.||
57|Cajeben|Merlyn|Cantomayor|April 2, 1976|Female|Upper Mingading Pikit Cot.||
57|Capio|Frencis Mae|Cajeben|November 7, 1998|Female|Upper Mingading Aleosan Cot.||
57|Capio|Keneth Brayan Rey|Cajeben|May 17, 2000|Male|Upper Mingading Aleosan Cot.||
58|Cambel|Rey||May 16, 1993|Male|San Mateo Aleosan Cot.||
58|Labiang|Angelica Zyra Marie||December 8, 1998|Female|Upper Mingading Aleosan Cot.||
59|Esmael|Ebrahim||January 2, 1995|Male|Liong Datu Piang Maguindanao||
59|Talaman|Hazel Mae||October 11, 1996|Female|Tomado Aleosan North Cot.||
59|Esmael|Bai Aliyah|Talaman|May 26, 2022|Female|Midsayap Doctors Hospital Specialist||
60|Escrupolo|Arnanita|Sigcuya|February 28, 1945|Female|Putotan Iloilo||
61|Escrupolo|Danilo|Singcuya|February 23, 1978|Male|Pob. 2 Midsayap Cot.||
61|Buclasan|Rogelia||August 16, 1981|Female|Manolo Forthrich Bukidnon||
61|Buclasan|Diana Rose||August 6, 2001|Female|Upper Mingading Aleosan Cot.||
61|Buclasan|Roldan||February 14, 2006|Male|Upper Mingading Aleosan Cot.||
61|Buclasan|Dan Harel||May 23, 2007|Male|Upper Mingading Aleosan Cot.||
61|Buclasan|Daniel||March 27, 2011|Male|Upper Mingading Aleosan Cot.||
62|Escrupolo|Ronilo|Singcuya|April, 10, 1973|Male|Binucayan Loreto Agusan||
62|Capilitan|Vicenta||April 21, 1982|Female|Upper Mingading Aleosan Cot.||
62|Escrupolo|Athea Jane|Capilitan|January 8, 2012|Female|Upper Mingading Aleosan Cot.||
62|Escrupolo|Arvilyn Grace|Capilitan|January 27, 2013|Female|Upper Mingading Aleosan Cot.||
62|Escrupolo|Aryalen Kate|Capilitan|July 16, 2017|Female|Upper Mingading Aleosan Cot.||
63|Estember|Lynel|Saban|April 14, 1992|Male|San Mateo Aleosan Cot.||
63|Cajeben|Myzel|Cajuto|March 30, 1991|Female|Upper Mingading Aleosan Cot.||
63|Estember|Mark Lester|Cajeben|October 21, 2019|Male|Upper Mingading Aleosan Cot.||
63|Estember|Lynzel Joy|Cajeben|October 4, 2023|Female|Upper Mingading Aleosan Cot.||
64|Payaga|Den Jave||October 29, 1988|Male|Milaya Midsayap Cot.||
64|Enora|Angeles||November 30, 1984|Female|Upper Mingading Aleosan Cot.||
64|Enora|Angelen||August 19, 2005|Female|Upper Mingading Aleosan Cot.||
64|Enora|Mary Khris||December 12, 2008|Female|Upper Mingading Aleosan Cot.||
64|Enora|Austin Ryan||December 14, 2003|Male|Aleosan District Hospital||
65|Labiang|Aurora|Casia|December 10, 1938|Female|Calinog Iloilo||
65|Labiang|Edmundo|Casia|December 14, 1967|Male|Upper Mingading Pikit Cot.||
65|Labiang|Emillano|Casia|February 9, 1980|Male|Upper Mingading Pikit Cot.||
66|Labiang|Dionesio Sr.|Casia|October 8, 1955|Male|Upper Mingading Pikit Cot.||
66|Francia|Haydee|Andoque|September 11, 1960|Female|Alimodian Iloilo||
66|Labiang|Alven Ian|Francia|November 6, 1993|Male|Upper Mingading Aleosan Cot.||
67|Labiang|Dionesio Jr.|Francia|May 1, 1989|Male|Upper Mingading Aleosan Cot.||
67|Almendral|Mylene||June 20, 1993|Female|Katalicanan Aleosan Cot.||
67|Labiang|Menard|Almendral|March 12, 2012|Male|Upper Mingading Aleosan Cot.||
67|Labiang|Devine Mitch|Almendral|May 8, 2018|Female|Pob. 7 Midsayap||
68|Labiang|Kimwil Rey|Samillano|December 31, 1998|Male|Upper Mingading Aleosan Cot.||
68|Labiang|Jay Zelle|Quismundo|July 22, 2001|Female|Bagolibas Aleosan Cot.||
68|Labiang|Kim Rylle Zeke|Fullo|March 6, 2022|Male|Amado Hospital||
68|Labiang|Kayden Zyrelle|Fullo|August 15, 2023|Male|Amado Hospital||
69|Labiang|Reynaldo|Cajeben|November 26, 1966|Male|Upper Mingading Pikit Cot.||
69|Labiang|Nimfa||January 31, 1979|Female|Sta. Cruz Pikit||
69|Labiang|Vanessa Jame|Samillano|August 28, 2000|Female|Upper Mingading Aleosan Cot.||
69|Labiang|John Rey|Samillano|April 21, 2006|Male|Upper Mingading Aleosan Cot.||
70|Labiang|Kenneth James||November 24, 1996|Male|Upper Mingading Aleosan Cot.||
70|Labiang|Kiesha Arish||May 22, 2019|Female|Amado Hospital||
71|Labiang|Marilyn|Pelegrino|September 20, 1969|Female|Upi Maguindanao||
71|Labiang|Welyn Angela||March 9, 2012|Female|Upper Mingading Aleosan Cot.||
72|Labiang|Moreto|Casia|November 18, 1963|Male|Bukidnon||
72|Serona|Delia||July 18, 1966|Female|Upper Mingading Aleosan Cot.||
73|Labiang|Renata|Serona|June 27, 1987|Male|Bukidnon||
73|Almonares|Marilou||February 26, 1994|Female|Katalicanan Aleosan Cot.||
73|Labiang|Mark|Almonares|September 16, 2011|Male|Upper Mingading Aleosan Cot.||
73|Labiang|John Paul|Almonares|September 15, 2013|Male|Upper Mingading Aleosan Cot.||
73|Labiang|John Loyd|Almonares|September 15, 2013|Male|Welfare Paanakan Clinic||
73|Labiang|Renato Jr.|Almonares|August 26, 2015|Male|Welfare Paanakan Clinic||
73|Labiang|Reymark|Almonares|September 26, 2019|Male|||
73|Labiang|Ezra Gail|Almonares|June 23, 2023|Male|Aleosan District Hospital||
74|Labiang|Ruben||||||
75|Lastimoso|Zaldy|Amondina|November 29, 1985|Male|Malamote Midsayap||
75|Catahum|Noralyn|Calawigan|November 18, 1996|Female|Upper Mingading Aleosan Cot.||
75|Lastimoso|Francis|Catahum|March 10, 2016|Male|Amado Hospital||
75|Lastimoso|Gabriel|Catahum|March 2, 2023|Male|Aleosan District Hospital||
76|Lagsil|Mike Ley|Menson|September 15, 1994|Male|Tubeng Tupi South Cot.||
76|Cajeben|Lorramie|Cabarles|April 6, 1994|Female|Upper Mingading Aleosan Cot.||
76|Lagsil|Kylie Lariza Bhea|Cabarles|September 15, 2015|Female|Upper Mingading Aleosan Cot.||
77|Maderable|Arnold|Calugdan|September 20, 1994|Male|Alamada North Cot.||
77|Cajeben|Ruby Mae|Tahum|May 3, 1997|Female|Upper Mingading Aleosan Cot.||
77|Maderable|Xyza Mae|Cajeben|October 19, 2014|Female|Amado Diaz Hospital||
78|Quemada|Jonel|Mantalaba|June 29, 1987|Male|Nalin Midsayap Cot.||
78|Catahum|Analyn|Talaron|September 8, 1990|Female|Upper Mingading Aleosan Cot.||
78|Quemada|John Clifford|Catahum|July 12, 2010|Male|Nalin Midsayap Cot.||
79|Quime|Renato|Arendon|September 27, 1977|Male|Bitoka Midsayap Cot.||
79|Cajiben|Geraline|Cantomayor|September 21, 1982|Female|Upper Mingading Pikit Cot.||
79|Quime|Zyrene Gayle|Cajiben|March 4, 2011|Female|Upper Mingading Aleosan Cot.||
79|Quime|Shaila Kate|Cajiben|June 6, 2015|Female|Upper Mingading Aleosan Cot.||
80|Saban|Daryl|Cantomayor|May 2, 1990|Male|San Mateo Aleosan Cot.||
80|Cajeben|Janice|Cajutol|July 29, 1997|Female|Upper Mingading Aleosan Cot.||
80|Saban|Daryl Jr.||June 23, 2021|Male|Aleosan District Hospital||
80|Saban|Jan Ryl||March 18, 2026|Male|Aleosan District Hospital||
81|Sabueso|Jose||October 2, 1963|Male|San Mequee Iloilo||
81|Sabueso|Adelaida||November 1, 1966|Female|Upper Mingading Pikit Cot.||
81|Sabueso|Jose Jr.||August 19, 1991|Male|Upper Mingading Aleosan Cot.||
81|Sabueso|Jefrey||August 21, 2000|Male|Upper Mingading Aleosan Cot.||
81|Sabueso|Jesa Mae||October 31, 2004|Female|Upper Mingading Aleosan Cot.||
82|Sabueso|Joey||September 8, 1995|Male|Upper Mingading Aleosan Cot.||
82|Dela Pena|Almera||August 31, 2002|Female|MDCH||
82|Sabueso|Joey Jr.|Dela Pena|April 8, 2025|Male|Dualing District Hospital||
83|Singcuya|Jonebert||||||
84|Singcuya|Jenefer||||||
85|Singcuya|Rogelio|Parana|August 24, 1947|Male|Putotan Iloilo||
85|Panes|Norlinda|Panes|September 20, 1952|Female|Barotac Vieji Iloilo||
85|Singcuya|Junrell||June 16, 1982|Male|Upper Mingading Pikit Cot.||
85|Singcuya|Girlie||March 3, 1984|Female|Upper Mingading Aleosan Cot.||
86|Tahum|Lenjobert|||Male|||
86|Tahum|Jiezel|||Female|||
86|Tahum|Julie Ann|||Female|||
87|Talaman|Nelson||December 25, 1969|Male|Upper Mingading Aleosan Cot.||
87|Talaman|Lida||September 27, 1967|Female|Tomado Aleosan Cot.||
88|Orencia|Ronald||March 24, 1978|Male|||
88|Orencia|Rose||May 27, 1965|Female|||
88|Orencia|Ronald Jr.||August 9, 2002|Male|||
89|Tecson|Ryan|Anfone|July 16, 1990|Male|Takipan Pikit Cot.||
89|Cajutol|Mary Ann||August 16, 1991|Female|Upper Mingading Aleosan Cot.||
89|Tecson|Althea||December 26, 2017|Female|Midsayap Community||
89|Tecson|Alyesha||April 26, 2023|Female|Aeosan District Hospital||
$buklod_rows$, E'\r?\n') WITH ORDINALITY AS line_data(line, ordinal)
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
    NULLIF(TRIM(split_part(line, '|', 9)), '') AS occupation_text
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
    (713 + ROW_NUMBER() OVER (ORDER BY MIN(source_line)))::TEXT AS household_no
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
    public.parse_buklod_birthdate(source.birthdate_text) AS birthday,
    CASE UPPER(source.sex_text)
      WHEN 'M' THEN 'Male'
      WHEN 'MALE' THEN 'Male'
      WHEN 'F' THEN 'Female'
      WHEN 'FEMALE' THEN 'Female'
      ELSE NULL::TEXT
    END AS sex,
    CASE
      WHEN source.birthplace_text IS NULL OR source.birthplace_text IN ('-', 'N/A') THEN 'Purok Buklod, Upper Mingading, Aleosan, Cotabato'
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
    FALSE AS is_4ps_member,
    FALSE AS is_solo_parent,
    NULL::TEXT AS civil_status,
    FALSE AS is_pwd,
    NULL::TEXT AS pwd_type,
    'Buklod'::TEXT AS purok,
    'Purok Buklod, Upper Mingading, Aleosan, Cotabato'::TEXT AS address,
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
        WHEN public.normalize_resident_claim(resident.purok) = public.normalize_resident_claim('Purok Buklod') THEN seed.purok
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
