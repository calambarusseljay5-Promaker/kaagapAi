-- Import requested resident records into public.residents.
-- Run this in Supabase SQL Editor if the records do not appear in the app yet.
-- Gmail values are generated from the resident names, house/household numbers
-- follow the "No." column, and phone numbers are intentionally left blank.

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
ADD COLUMN IF NOT EXISTS purok TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

CREATE OR REPLACE FUNCTION public.normalize_resident_claim(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(LOWER(COALESCE(value, '')), '[^a-z0-9]', '', 'g')
$$;

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

NOTIFY pgrst, 'reload schema';
