-- Import Malipayon resident records 98-121 into public.residents.
-- Run this in the Supabase SQL Editor.
-- Kept intentionally sparse per request:
-- - house_no and household_no use the leading number from the list
-- - purok is Malipayon
-- - birthday, sex/gender, email, and 4Ps flag are filled when provided
-- - other editable profile fields are left blank
-- - invalid birthday values 08-00-92 and 06-31-07 are imported as NULL

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

CREATE OR REPLACE FUNCTION public.normalize_resident_claim(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(LOWER(COALESCE(value, '')), '[^a-z0-9]', '', 'g')
$$;

WITH resident_seed (
  number_value,
  full_name,
  last_name,
  first_name,
  middle_name,
  email,
  birthday,
  sex,
  is_4ps_member
) AS (
  VALUES
    ('98', 'Julito Campollo Cabaya', 'Cabaya', 'Julito', 'Campollo', 'julito.cabaya@gmail.com', DATE '1962-07-27', 'Male', TRUE),
    ('98', 'Emelie Amorsolo Cabaya', 'Cabaya', 'Emelie', 'Amorsolo', 'emelie.cabaya@gmail.com', DATE '1975-10-15', 'Female', FALSE),
    ('98', 'Jumel Amorsolo Cabaya', 'Cabaya', 'Jumel', 'Amorsolo', 'jumel.cabaya@gmail.com', DATE '1997-12-08', 'Male', FALSE),
    ('98', 'Julie Ann Amorsolo Cabaya', 'Cabaya', 'Julie Ann', 'Amorsolo', 'julie.ann.cabaya@gmail.com', DATE '1999-12-11', 'Female', FALSE),
    ('98', 'Julie Mae Amorsolo Cabaya', 'Cabaya', 'Julie Mae', 'Amorsolo', 'julie.mae.cabaya@gmail.com', DATE '2001-09-15', 'Female', FALSE),
    ('98', 'Julia Amorsolo Cabaya', 'Cabaya', 'Julia', 'Amorsolo', 'julia.cabaya@gmail.com', DATE '2013-09-11', 'Female', FALSE),
    ('98', 'Jesarel Amorsolo Cabaya', 'Cabaya', 'Jesarel', 'Amorsolo', 'jesarel.cabaya@gmail.com', DATE '2007-04-24', 'Male', FALSE),
    ('99', 'Reynaldo Capilitan Cabana', 'Cabana', 'Reynaldo', 'Capilitan', 'reynaldo.cabana@gmail.com', DATE '1966-02-07', 'Male', FALSE),
    ('99', 'Rairbon Maminting Cabana', 'Cabana', 'Rairbon', 'Maminting', 'rairbon.cabana@gmail.com', DATE '1965-07-21', 'Female', FALSE),
    ('99', 'Dionesio Caballero Cabana', 'Cabana', 'Dionesio', 'Caballero', 'dionesio.cabana@gmail.com', DATE '1956-04-14', 'Male', TRUE),
    ('99', 'Rosemarie Capitle Cabana', 'Cabana', 'Rosemarie', 'Capitle', 'rosemarie.cabana@gmail.com', DATE '1976-06-12', 'Male', FALSE),
    ('99', 'Jovanix Capitle Cabana', 'Cabana', 'Jovanix', 'Capitle', 'jovanix.cabana@gmail.com', DATE '1998-02-20', 'Male', FALSE),
    ('100', 'Moreto Sr. Campollo Caballero', 'Caballero', 'Moreto Sr.', 'Campollo', 'moreto.caballero@gmail.com', DATE '1954-04-12', 'Male', TRUE),
    ('100', 'Rutchell Cabalifason Caballero', 'Caballero', 'Rutchell', 'Cabalifason', 'rutchell.caballero@gmail.com', DATE '1959-01-24', 'Female', TRUE),
    ('101', 'Fernando Sr. Campollo Cabalero', 'Cabalero', 'Fernando Sr.', 'Campollo', 'fernando.cabalero@gmail.com', DATE '1956-01-12', 'Male', TRUE),
    ('101', 'Carmelina Benito Cabalero', 'Cabalero', 'Carmelina', 'Benito', 'carmelina.cabalero@gmail.com', DATE '1963-02-02', 'Female', TRUE),
    ('101', 'Ivan Roy Benito Cabalero', 'Cabalero', 'Ivan Roy', 'Benito', 'ivan.roy.cabalero@gmail.com', DATE '1998-05-01', 'Male', FALSE),
    ('101', 'Floriza Mae Benito Cabalero', 'Cabalero', 'Floriza Mae', 'Benito', 'floriza.mae.cabalero@gmail.com', DATE '1995-10-01', 'Female', FALSE),
    ('102', 'Roger Jr. Caballero Latora', 'Latora', 'Roger Jr.', 'Caballero', 'roger.jr.latora@gmail.com', DATE '1991-05-08', 'Male', FALSE),
    ('102', 'Sophie Faith Caballero Latora', 'Latora', 'Sophie Faith', 'Caballero', 'sophie.faith.latora@gmail.com', DATE '2019-11-08', 'Female', FALSE),
    ('102', 'Stephin Caballero Latora', 'Latora', 'Stephin', 'Caballero', 'stephin.latora@gmail.com', DATE '2022-09-02', 'Male', FALSE),
    ('103', 'Ramon Camino Cabresonte', 'Cabresonte', 'Ramon', 'Camino', 'ramon.cabresonte@gmail.com', DATE '1940-08-28', 'Male', TRUE),
    ('103', 'Angaro Cañata Cabresonte', 'Cabresonte', 'Angaro', 'Cañata', 'angaro.cabresonte@gmail.com', DATE '1940-08-10', 'Female', TRUE),
    ('104', 'Josie Cabrestante Cabresonte', 'Cabresonte', 'Josie', 'Cabrestante', 'josie.cabresonte@gmail.com', DATE '1964-01-25', 'Male', FALSE),
    ('104', 'Rosalinda Lago Cabresonte', 'Cabresonte', 'Rosalinda', 'Lago', 'rosalinda.cabresonte@gmail.com', DATE '1969-10-02', 'Female', FALSE),
    ('104', 'Joseph Lego Cabresonte', 'Cabresonte', 'Joseph', 'Lego', 'joseph.cabresonte@gmail.com', DATE '1993-01-16', 'Male', FALSE),
    ('104', 'Kodel Lego Cabresonte', 'Cabresonte', 'Kodel', 'Lego', 'kodel.cabresonte@gmail.com', DATE '1996-05-09', 'Male', FALSE),
    ('104', 'Kossel Lego Cabresonte', 'Cabresonte', 'Kossel', 'Lego', 'kossel.cabresonte@gmail.com', DATE '1999-06-06', 'Female', FALSE),
    ('104', 'Josie Emie Cabrestante Cabresonte', 'Cabresonte', 'Josie Emie', 'Cabrestante', 'josie.emie.cabresonte@gmail.com', DATE '1970-07-21', 'Female', FALSE),
    ('104', 'Vonessa Elho Cabregonde Cabresonte', 'Cabresonte', 'Vonessa Elho', 'Cabregonde', 'vonessa.elho.cabresonte@gmail.com', DATE '2012-09-08', 'Female', FALSE),
    ('104', 'Grayson James Cabrestante Cabresonte', 'Cabresonte', 'Grayson James', 'Cabrestante', 'grayson.james.cabresonte@gmail.com', DATE '2018-06-04', 'Male', FALSE),
    ('104', 'Mark Zion Cabrestante Cabresonte', 'Cabresonte', 'Mark Zion', 'Cabrestante', 'mark.zion.cabresonte@gmail.com', DATE '2019-11-08', 'Female', FALSE),
    ('104', 'Sovero Cabrestante Cabresonte', 'Cabresonte', 'Sovero', 'Cabrestante', 'sovero.cabresonte@gmail.com', DATE '1961-08-08', 'Male', FALSE),
    ('104', 'Clark Cabrestante Cabresonte', 'Cabresonte', 'Clark', 'Cabrestante', 'clark.cabresonte@gmail.com', DATE '1999-10-02', 'Male', FALSE),
    ('105', 'Anacel Gagate Gagate', 'Gagate', 'Anacel', 'Gagate', 'anacel.gagate@gmail.com', DATE '1992-09-28', 'Female', FALSE),
    ('105', 'Ponibart Caliva Gagate', 'Gagate', 'Ponibart', 'Caliva', 'ponibart.gagate@gmail.com', DATE '1993-07-20', 'Male', FALSE),
    ('105', 'Aeron Clint Cabrestante Gagate', 'Gagate', 'Aeron Clint', 'Cabrestante', 'aeron.clint.gagate@gmail.com', DATE '2015-12-15', 'Male', FALSE),
    ('105', 'Gabriel Cabrestante Gagate', 'Gagate', 'Gabriel', 'Cabrestante', 'gabriel.gagate@gmail.com', DATE '2019-04-07', 'Male', FALSE),
    ('106', 'Efren Capilitan Cañata', 'Cañata', 'Efren', 'Capilitan', 'efren.canata@gmail.com', DATE '1965-10-04', 'Male', FALSE),
    ('106', 'Wilma Clarito Cañata', 'Cañata', 'Wilma', 'Clarito', 'wilma.canata@gmail.com', DATE '1969-10-25', 'Female', FALSE),
    ('106', 'Jaspis Clarito Cañata', 'Cañata', 'Jaspis', 'Clarito', 'jaspis.canata@gmail.com', DATE '2008-01-24', 'Male', FALSE),
    ('106', 'Jant Kent Clarito Cañata', 'Cañata', 'Jant Kent', 'Clarito', 'jant.kent.canata@gmail.com', DATE '1998-06-18', 'Male', FALSE),
    ('107', 'Nicolas Cambel Cajeben', 'Cajeben', 'Nicolas', 'Cambel', 'nicolas.cajeben@gmail.com', DATE '1961-12-06', 'Male', TRUE),
    ('107', 'Elnora Aldamar Cajeben', 'Cajeben', 'Elnora', 'Aldamar', 'elnora.cajeben@gmail.com', DATE '1961-12-11', 'Female', TRUE),
    ('107', 'Shielamal Aldamar Cajeben', 'Cajeben', 'Shielamal', 'Aldamar', 'shielamal.cajeben@gmail.com', DATE '1999-05-21', 'Female', FALSE),
    ('108', 'Ervic Sultan Baclay', 'Baclay', 'Ervic', 'Sultan', 'ervic.baclay@gmail.com', NULL::DATE, 'Male', FALSE),
    ('109', 'Engelyca Dejera Idogtante', 'Idogtante', 'Engelyca', 'Dejera', 'engelyca.idogtante@gmail.com', DATE '1997-12-16', 'Female', FALSE),
    ('110', 'Bernadine Camoncha Caigoy', 'Caigoy', 'Bernadine', 'Camoncha', 'bernadine.caigoy@gmail.com', DATE '1981-09-18', 'Male', FALSE),
    ('110', 'Arlene Camoncha Caigoy', 'Caigoy', 'Arlene', 'Camoncha', 'arlene.caigoy@gmail.com', DATE '1980-07-13', 'Female', FALSE),
    ('110', 'Alben Camoncha Caigoy', 'Caigoy', 'Alben', 'Camoncha', 'alben.caigoy@gmail.com', DATE '2002-02-02', 'Male', FALSE),
    ('110', 'Marven Camoncha Caigoy', 'Caigoy', 'Marven', 'Camoncha', 'marven.caigoy@gmail.com', DATE '2004-02-29', 'Male', FALSE),
    ('110', 'Marby Camancha Caigoy', 'Caigoy', 'Marby', 'Camancha', 'marby.caigoy@gmail.com', DATE '2006-03-29', 'Female', FALSE),
    ('111', 'Jesus Cabana Calawrigan', 'Calawrigan', 'Jesus', 'Cabana', 'jesus.calawirigan@gmail.com', DATE '1944-11-20', 'Male', FALSE),
    ('111', 'Luz Cambel Calawrigan', 'Calawrigan', 'Luz', 'Cambel', 'luz.calawirigan@gmail.com', DATE '1947-11-26', 'Female', TRUE),
    ('112', 'Cornelira Camancho Camancho', 'Camancho', 'Cornelira', 'Camancho', 'cornelira.camancho@gmail.com', DATE '1946-09-23', 'Female', TRUE),
    ('113', 'Charlie Calairan Calawrigan', 'Calawrigan', 'Charlie', 'Calairan', 'charlie.calawirigan@gmail.com', DATE '1972-02-02', 'Male', TRUE),
    ('113', 'Helen Capilitan Calawrigan', 'Calawrigan', 'Helen', 'Capilitan', 'helen.calawirigan@gmail.com', DATE '1975-02-10', 'Female', FALSE),
    ('113', 'Hezell Capilitan Calawrigan', 'Calawrigan', 'Hezell', 'Capilitan', 'hezell.calawirigan@gmail.com', DATE '2007-03-12', 'Female', FALSE),
    ('113', 'Charlyn Capilitan Calawrigan', 'Calawrigan', 'Charlyn', 'Capilitan', 'charlyn.calawirigan@gmail.com', DATE '2016-06-03', 'Female', FALSE),
    ('114', 'Jovelyn Calawigan Camancho', 'Camancho', 'Jovelyn', 'Calawigan', 'jovelyn.camancho@gmail.com', DATE '1980-09-19', 'Female', FALSE),
    ('114', 'Aljay Calawigan Camancho', 'Camancho', 'Aljay', 'Calawigan', 'aljay.camancho@gmail.com', DATE '2002-03-26', 'Male', FALSE),
    ('114', 'Aldrin Calawigan Camancho', 'Camancho', 'Aldrin', 'Calawigan', 'aldrin.camancho@gmail.com', DATE '2004-08-04', 'Male', FALSE),
    ('114', 'Albert Jr. Calawigan Camancho', 'Camancho', 'Albert Jr.', 'Calawigan', 'albert.jr.camancho@gmail.com', DATE '2014-04-23', 'Male', FALSE),
    ('114', 'Abigail Hontoc Camancho', 'Camancho', 'Abigail', 'Hontoc', 'abigail.camancho@gmail.com', DATE '2021-12-07', 'Female', FALSE),
    ('115', 'Antonio Limen Gonzales', 'Gonzales', 'Antonio', 'Limen', 'antonio.gonzales@gmail.com', DATE '1955-10-07', 'Male', TRUE),
    ('115', 'Jean Espabo Gonzales', 'Gonzales', 'Jean', 'Espabo', 'jean.gonzales@gmail.com', DATE '1974-10-30', 'Female', FALSE),
    ('115', 'Prince John Gonzales', 'Gonzales', 'Prince John', NULL::TEXT, 'prince.john.gonzales@gmail.com', DATE '2016-07-02', 'Male', FALSE),
    ('116', 'Jen Manaligod Gabrij', 'Gabrij', 'Jen', 'Manaligod', 'jen.gabrij@gmail.com', DATE '1987-10-15', 'Female', FALSE),
    ('117', 'Johnny Sr. Camancho Camancho', 'Camancho', 'Johnny Sr.', 'Camancho', 'johnny.sr.camancho@gmail.com', DATE '1969-10-22', 'Male', TRUE),
    ('117', 'Marilpeth Cabanting Camancho', 'Camancho', 'Marilpeth', 'Cabanting', 'marilpeth.camancho@gmail.com', DATE '1976-03-09', 'Female', FALSE),
    ('117', 'Sandurlyn John Camancho', 'Camancho', 'Sandurlyn John', NULL::TEXT, 'sandurlyn.john.camancho@gmail.com', DATE '1996-06-24', 'Male', FALSE),
    ('117', 'Joven Camancho', 'Camancho', 'Joven', NULL::TEXT, 'joven.camancho@gmail.com', DATE '1998-04-20', 'Male', FALSE),
    ('117', 'Lovelyn Camancho', 'Camancho', 'Lovelyn', NULL::TEXT, 'lovelyn.camancho@gmail.com', DATE '2000-01-27', 'Female', FALSE),
    ('117', 'Ryan Jie Camancho', 'Camancho', 'Ryan Jie', NULL::TEXT, 'ryan.jie.camancho@gmail.com', DATE '2002-08-31', 'Male', FALSE),
    ('117', 'Glory Jean Camancho', 'Camancho', 'Glory Jean', NULL::TEXT, 'glory.jean.camancho@gmail.com', DATE '2005-07-16', 'Female', FALSE),
    ('117', 'Rica Joy Camancho', 'Camancho', 'Rica Joy', NULL::TEXT, 'rica.joy.camancho@gmail.com', NULL::DATE, 'Female', FALSE),
    ('117', 'Johnny Jr. Camancho', 'Camancho', 'Johnny Jr.', NULL::TEXT, 'johnny.jr.camancho@gmail.com', DATE '2009-01-11', 'Male', FALSE),
    ('117', 'Kathryn Camancho', 'Camancho', 'Kathryn', NULL::TEXT, 'kathryn.camancho@gmail.com', DATE '2013-02-01', 'Female', FALSE),
    ('117', 'Klent Daniel Camancho', 'Camancho', 'Klent Daniel', NULL::TEXT, 'klent.daniel.camancho@gmail.com', DATE '2014-11-30', 'Male', FALSE),
    ('117', 'Catherine Gale Camancho', 'Camancho', 'Catherine Gale', NULL::TEXT, 'catherine.gale.camancho@gmail.com', DATE '2017-06-27', 'Female', FALSE),
    ('117', 'Herrence Nathaniel Camancho', 'Camancho', 'Herrence Nathaniel', NULL::TEXT, 'herrence.nathaniel.camancho@gmail.com', DATE '2021-02-25', 'Male', FALSE),
    ('118', 'Ryan Jaig Bandiola', 'Bandiola', 'Ryan Jaig', NULL::TEXT, 'ryan.jaig.bandiola@gmail.com', DATE '1991-10-08', 'Male', FALSE),
    ('118', 'Marjohnny Camancho Bandiola', 'Bandiola', 'Marjohnny', 'Camancho', 'marjohnny.bandiola@gmail.com', DATE '1995-02-03', 'Female', FALSE),
    ('118', 'Zeff Johance Camancho Bandiola', 'Bandiola', 'Zeff Johance', 'Camancho', 'zeff.johance.bandiola@gmail.com', DATE '2012-08-12', 'Male', FALSE),
    ('118', 'Zoff Clive Bandiola', 'Bandiola', 'Zoff Clive', NULL::TEXT, 'zoff.clive.bandiola@gmail.com', DATE '2018-06-28', 'Male', FALSE),
    ('119', 'Effren Tannum Comlero', 'Comlero', 'Effren', 'Tannum', 'effren.comlero@gmail.com', DATE '1972-09-10', 'Male', FALSE),
    ('119', 'Darken Andea Comlero', 'Comlero', 'Darken', 'Andea', 'darken.comlero@gmail.com', DATE '1976-07-24', 'Female', FALSE),
    ('119', 'Johnley Comlero', 'Comlero', 'Johnley', NULL::TEXT, 'johnley.comlero@gmail.com', DATE '2002-02-05', 'Male', FALSE),
    ('119', 'Rica Joy Comlero', 'Comlero', 'Rica Joy', NULL::TEXT, 'rica.joy.comlero@gmail.com', DATE '2004-07-30', 'Male', FALSE),
    ('120', 'Reynaldo Calawigan Capilitan', 'Capilitan', 'Reynaldo', 'Calawigan', 'reynaldo.capilitan@gmail.com', DATE '1969-01-04', 'Male', FALSE),
    ('120', 'Marilvn Talaman Capilitan', 'Capilitan', 'Marilvn', 'Talaman', 'marilyn.capilitan@gmail.com', DATE '1974-02-02', 'Female', FALSE),
    ('120', 'Marvin Capilitan', 'Capilitan', 'Marvin', NULL::TEXT, 'marvin.capilitan@gmail.com', DATE '2000-02-22', 'Male', FALSE),
    ('120', 'Analyn Capilitan', 'Capilitan', 'Analyn', NULL::TEXT, 'analyn.capilitan@gmail.com', DATE '2003-11-22', 'Female', FALSE),
    ('120', 'Roderick Talaman Capilitan', 'Capilitan', 'Roderick', 'Talaman', 'roderick.capilitan@gmail.com', DATE '1982-06-23', 'Male', FALSE),
    ('121', 'Jear Talaman Capilitan', 'Capilitan', 'Jear', 'Talaman', 'jear.capilitan@gmail.com', DATE '1995-12-29', 'Male', FALSE)
),
seed AS (
  SELECT
    number_value AS house_no,
    number_value AS household_no,
    full_name,
    last_name,
    first_name,
    middle_name,
    email,
    birthday,
    sex,
    sex AS gender,
    NULL::INTEGER AS age,
    NULL::TEXT AS phone,
    NULL::TEXT AS relationship_to_household_head,
    NULL::TEXT AS birthplace,
    NULL::TEXT AS educational_attainment,
    NULL::TEXT AS occupation,
    is_4ps_member,
    FALSE AS is_solo_parent,
    NULL::TEXT AS civil_status,
    FALSE AS is_pwd,
    NULL::TEXT AS pwd_type,
    'Malipayon'::TEXT AS purok,
    NULL::TEXT AS address,
    'Active'::TEXT AS status
  FROM resident_seed
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
      purok = COALESCE(NULLIF(TRIM(resident.purok), ''), seed.purok),
      address = COALESCE(NULLIF(TRIM(resident.address), ''), seed.address),
      status = COALESCE(NULLIF(TRIM(resident.status), ''), seed.status),
      updated_at = NOW()
  FROM seed
  WHERE LOWER(COALESCE(resident.email, '')) = LOWER(seed.email)
     OR (
       seed.birthday IS NOT NULL
       AND public.normalize_resident_claim(resident.full_name) = public.normalize_resident_claim(seed.full_name)
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
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.residents AS resident
  WHERE LOWER(COALESCE(resident.email, '')) = LOWER(seed.email)
     OR (
       seed.birthday IS NOT NULL
       AND public.normalize_resident_claim(resident.full_name) = public.normalize_resident_claim(seed.full_name)
       AND resident.birthday = seed.birthday
     )
);

NOTIFY pgrst, 'reload schema';
