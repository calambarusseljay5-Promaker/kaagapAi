-- Import continued Malipayon resident records 122-177 into public.residents.
-- Run this in the Supabase SQL Editor after import-malipayon-residents-98-121.sql.
-- Household number is kept from the list: same number means one household/family.
-- All rows use address Upper Mingading, Aleosan, Cotabato and purok Malipayon.
-- 4PS and PWD checkmarks are saved to boolean fields.
-- Senior is derived by the app from birthday/age; there is no separate senior column.
-- Missing/invalid birthday values are imported as NULL:
-- - Ian Kent Cascadan Baliga
-- - Kenneth Cabaya Catarus
-- - Richard Maminting Cabaya (00-27-90)
-- - Arnold Tiros Lienhuo (01-00-70)

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
  is_4ps_member,
  is_pwd,
  birthplace
) AS (
  VALUES
    ('122', 'Lourencio Cunjar Casicadan', 'Casicadan', 'Lourencio', 'Cunjar', 'lourencio.casicadan@gmail.com', DATE '1916-09-22', 'Male', TRUE, FALSE, NULL::TEXT),
    ('122', 'Merlyn Calawigan Casicadan', 'Casicadan', 'Merlyn', 'Calawigan', 'merlyn.casicadan@gmail.com', DATE '1952-10-22', 'Female', TRUE, FALSE, 'Leon ILO'),
    ('123', 'Milbert Cocat Baliga', 'Baliga', 'Milbert', 'Cocat', 'milbert.baliga@gmail.com', DATE '1984-09-22', 'Male', FALSE, FALSE, 'Kimasoy'),
    ('123', 'Lysa Cascadan Baliga', 'Baliga', 'Lysa', 'Cascadan', 'lysa.baliga@gmail.com', DATE '1994-01-04', 'Female', FALSE, FALSE, 'U.M.A.C'),
    ('123', 'Ian Kent Cascadan Baliga', 'Baliga', 'Ian Kent', 'Cascadan', 'ian.kent.baliga@gmail.com', NULL::DATE, 'Male', FALSE, FALSE, NULL::TEXT),
    ('124', 'Federico Calicaran Catarus', 'Catarus', 'Federico', 'Calicaran', 'federico.catarus@gmail.com', DATE '1939-07-18', 'Male', TRUE, FALSE, 'Leon ILO'),
    ('124', 'Generosa Tuala Catarus', 'Catarus', 'Generosa', 'Tuala', 'generosa.catarus@gmail.com', DATE '1938-07-28', 'Female', TRUE, FALSE, 'Leon ILO'),
    ('125', 'Pepito Calamba Catarus', 'Catarus', 'Pepito', 'Calamba', 'pepito.catarus@gmail.com', DATE '1949-04-12', 'Male', TRUE, FALSE, NULL::TEXT),
    ('125', 'Luisa Crisost Catarus', 'Catarus', 'Luisa', 'Crisost', 'luisa.catarus@gmail.com', DATE '1957-04-21', 'Female', TRUE, FALSE, 'U.M.A.C'),
    ('125', 'Channel Oresco Catarus', 'Catarus', 'Channel', 'Oresco', 'channel.catarus@gmail.com', DATE '1992-11-20', 'Male', FALSE, FALSE, NULL::TEXT),
    ('125', 'Ricky Oresco Catarus', 'Catarus', 'Ricky', 'Oresco', 'ricky.catarus@gmail.com', DATE '1994-12-31', 'Male', FALSE, FALSE, NULL::TEXT),
    ('126', 'Rex Calawigan Catarus', 'Catarus', 'Rex', 'Calawigan', 'rex.catarus@gmail.com', DATE '1951-05-05', 'Male', TRUE, FALSE, 'Leon ILO'),
    ('126', 'Felecitas Talaman Catarus', 'Catarus', 'Felecitas', 'Talaman', 'felecitas.catarus@gmail.com', DATE '1954-09-23', 'Female', TRUE, FALSE, NULL::TEXT),
    ('127', 'Reynaldo Tuala Catarus', 'Catarus', 'Reynaldo', 'Tuala', 'reynaldo.catarus@gmail.com', DATE '1968-10-03', 'Male', TRUE, FALSE, NULL::TEXT),
    ('127', 'Janet Calambro Catarus', 'Catarus', 'Janet', 'Calambro', 'janet.catarus@gmail.com', DATE '1974-07-28', 'Female', FALSE, FALSE, NULL::TEXT),
    ('127', 'Janrey Calambro Catarus', 'Catarus', 'Janrey', 'Calambro', 'janrey.catarus@gmail.com', DATE '1998-03-21', 'Male', FALSE, FALSE, NULL::TEXT),
    ('127', 'Kimberly Calambro Catarus', 'Catarus', 'Kimberly', 'Calambro', 'kimberly.catarus@gmail.com', DATE '2003-04-28', 'Female', FALSE, FALSE, NULL::TEXT),
    ('128', 'Pedrogo Calicaran Catarus', 'Catarus', 'Pedrogo', 'Calicaran', 'pedrogo.catarus@gmail.com', DATE '1944-07-10', 'Male', TRUE, FALSE, 'Leon ILO'),
    ('128', 'Felecitas Tuala Catarus', 'Catarus', 'Felecitas', 'Tuala', 'felecitas.t.catarus@gmail.com', DATE '1951-11-26', 'Female', TRUE, FALSE, NULL::TEXT),
    ('128', 'Runahte Tuala Catarus', 'Catarus', 'Runahte', 'Tuala', 'runahte.catarus@gmail.com', DATE '1993-06-25', 'Male', FALSE, FALSE, NULL::TEXT),
    ('129', 'Polando Calicaran Catarus', 'Catarus', 'Polando', 'Calicaran', 'polando.catarus@gmail.com', DATE '1951-10-12', 'Male', TRUE, FALSE, 'Leon ILO'),
    ('129', 'Peynart Campollo Catarus', 'Catarus', 'Peynart', 'Campollo', 'peynart.catarus@gmail.com', DATE '1993-11-12', 'Male', FALSE, FALSE, 'U.M.A.C'),
    ('130', 'Jonathon Tuala Catarus', 'Catarus', 'Jonathon', 'Tuala', 'jonathon.catarus@gmail.com', DATE '1970-05-17', 'Male', FALSE, FALSE, NULL::TEXT),
    ('130', 'Jean Campollo Catarus', 'Catarus', 'Jean', 'Campollo', 'jean.catarus@gmail.com', DATE '1972-10-05', 'Female', FALSE, FALSE, NULL::TEXT),
    ('130', 'Blezy Mercy Thu Campollo Catarus', 'Catarus', 'Blezy Mercy Thu', 'Campollo', 'blezy.mercy.catarus@gmail.com', DATE '2010-10-31', 'Female', FALSE, FALSE, NULL::TEXT),
    ('131', 'Modesto Calicaran Catarus', 'Catarus', 'Modesto', 'Calicaran', 'modesto.catarus@gmail.com', DATE '1958-07-18', 'Male', TRUE, FALSE, NULL::TEXT),
    ('131', 'Agnes Cabaya Catarus', 'Catarus', 'Agnes', 'Cabaya', 'agnes.catarus@gmail.com', DATE '1958-10-29', 'Female', TRUE, FALSE, NULL::TEXT),
    ('131', 'Leizle Cabaya Catarus', 'Catarus', 'Leizle', 'Cabaya', 'leizle.catarus@gmail.com', DATE '1992-01-23', 'Female', FALSE, FALSE, NULL::TEXT),
    ('131', 'Kenneth Cabaya Catarus', 'Catarus', 'Kenneth', 'Cabaya', 'kenneth.catarus@gmail.com', NULL::DATE, 'Female', FALSE, FALSE, NULL::TEXT),
    ('132', 'Lucilol Cabanting Clarito', 'Clarito', 'Lucilol', 'Cabanting', 'lucilol.clarito@gmail.com', DATE '1978-10-22', 'Female', FALSE, FALSE, NULL::TEXT),
    ('132', 'Romeo III Cabanting Clarito', 'Clarito', 'Romeo III', 'Cabanting', 'romeo.iii.clarito@gmail.com', DATE '2008-01-25', 'Male', FALSE, FALSE, NULL::TEXT),
    ('132', 'Daren Chashlly Cabanting Clarito', 'Clarito', 'Daren Chashlly', 'Cabanting', 'daren.chashlly.clarito@gmail.com', DATE '2001-04-24', 'Female', FALSE, FALSE, NULL::TEXT),
    ('132', 'Lysa Cabanting Clarito', 'Clarito', 'Lysa', 'Cabanting', 'lysa.clarito@gmail.com', DATE '2014-01-05', 'Female', FALSE, FALSE, NULL::TEXT),
    ('133', 'Nestor Catanus Clarito', 'Clarito', 'Nestor', 'Catanus', 'nestor.clarito@gmail.com', DATE '1940-04-17', 'Male', TRUE, FALSE, NULL::TEXT),
    ('133', 'Rosemarie Capilitan Clarito', 'Clarito', 'Rosemarie', 'Capilitan', 'rosemarie.clarito@gmail.com', DATE '1958-04-20', 'Female', TRUE, FALSE, NULL::TEXT),
    ('133', 'Keith Jay Capilitan Clarito', 'Clarito', 'Keith Jay', 'Capilitan', 'keith.jay.clarito@gmail.com', DATE '1989-11-25', 'Male', FALSE, FALSE, NULL::TEXT),
    ('133', 'Roselyn Capilitan Clarito', 'Clarito', 'Roselyn', 'Capilitan', 'roselyn.clarito@gmail.com', DATE '1999-02-11', 'Female', FALSE, FALSE, NULL::TEXT),
    ('133', 'Gian Roy Capilitan Clarito', 'Clarito', 'Gian Roy', 'Capilitan', 'gian.roy.clarito@gmail.com', DATE '2002-01-07', 'Male', FALSE, FALSE, NULL::TEXT),
    ('134', 'Manaseh Catanus Clarito', 'Clarito', 'Manaseh', 'Catanus', 'manaseh.clarito@gmail.com', DATE '1957-11-01', 'Male', FALSE, FALSE, NULL::TEXT),
    ('134', 'Norma Cabaya Clarito', 'Clarito', 'Norma', 'Cabaya', 'norma.clarito@gmail.com', DATE '1955-11-28', 'Female', FALSE, FALSE, NULL::TEXT),
    ('135', 'John Telloro Clarito', 'Clarito', 'John', 'Telloro', 'john.clarito@gmail.com', DATE '1972-11-27', 'Male', FALSE, FALSE, NULL::TEXT),
    ('135', 'Marilin Calamba Clarito', 'Clarito', 'Marilin', 'Calamba', 'marilin.clarito@gmail.com', DATE '1979-01-22', 'Female', FALSE, FALSE, NULL::TEXT),
    ('135', 'Charlin Mae Calamba Clarito', 'Clarito', 'Charlin Mae', 'Calamba', 'charlin.mae.clarito@gmail.com', DATE '2001-06-30', 'Female', FALSE, FALSE, NULL::TEXT),
    ('136', 'Nelson Catanus Clarito', 'Clarito', 'Nelson', 'Catanus', 'nelson.clarito@gmail.com', DATE '1960-07-19', 'Male', TRUE, FALSE, NULL::TEXT),
    ('136', 'Dolora Pesquera Clarito', 'Clarito', 'Dolora', 'Pesquera', 'dolora.clarito@gmail.com', DATE '1964-09-29', 'Female', FALSE, FALSE, NULL::TEXT),
    ('136', 'Adrin Pesquera Clarito', 'Clarito', 'Adrin', 'Pesquera', 'adrin.clarito@gmail.com', DATE '2002-02-12', 'Male', FALSE, FALSE, NULL::TEXT),
    ('136', 'Dave Pesquera Clarito', 'Clarito', 'Dave', 'Pesquera', 'dave.clarito@gmail.com', DATE '2007-05-24', 'Male', FALSE, FALSE, NULL::TEXT),
    ('136', 'Abigail Pesquera Clarito', 'Clarito', 'Abigail', 'Pesquera', 'abigail.clarito@gmail.com', DATE '2010-10-21', 'Female', FALSE, FALSE, NULL::TEXT),
    ('136', 'Dandil Pesquera Clarito', 'Clarito', 'Dandil', 'Pesquera', 'dandil.clarito@gmail.com', DATE '2004-04-26', 'Male', FALSE, FALSE, NULL::TEXT),
    ('137', 'Jonie Capilitan Clarito', 'Clarito', 'Jonie', 'Capilitan', 'jonie.clarito@gmail.com', DATE '1981-04-04', 'Male', FALSE, FALSE, NULL::TEXT),
    ('137', 'John Louie Cabanting Clarito', 'Clarito', 'John Louie', 'Cabanting', 'john.louie.clarito@gmail.com', DATE '2005-11-30', 'Male', FALSE, FALSE, NULL::TEXT),
    ('137', 'Lynette Cabanting Clarito', 'Clarito', 'Lynette', 'Cabanting', 'lynette.clarito@gmail.com', DATE '2010-10-02', 'Female', FALSE, FALSE, NULL::TEXT),
    ('138', 'Judy Campollo Cabaya', 'Cabaya', 'Judy', 'Campollo', 'judy.cabaya@gmail.com', DATE '1974-07-24', 'Male', FALSE, FALSE, NULL::TEXT),
    ('138', 'Janeth Peniero Cabaya', 'Cabaya', 'Janeth', 'Peniero', 'janeth.cabaya@gmail.com', DATE '1980-01-12', 'Female', FALSE, FALSE, NULL::TEXT),
    ('138', 'Jude Andrew Peniero Cabaya', 'Cabaya', 'Jude Andrew', 'Peniero', 'jude.andrew.cabaya@gmail.com', DATE '2007-10-16', 'Male', FALSE, FALSE, NULL::TEXT),
    ('138', 'Jode Ashley Peniero Cabaya', 'Cabaya', 'Jode Ashley', 'Peniero', 'jode.ashley.cabaya@gmail.com', DATE '2011-10-29', 'Female', FALSE, FALSE, NULL::TEXT),
    ('139', 'Noemi Cabaya Cabalitin', 'Cabalitin', 'Noemi', 'Cabaya', 'noemi.cabalitin@gmail.com', DATE '1965-04-29', 'Female', TRUE, FALSE, NULL::TEXT),
    ('139', 'John Paul Cabaya Cabalitin', 'Cabalitin', 'John Paul', 'Cabaya', 'john.paul.cabalitin@gmail.com', DATE '2005-12-18', 'Male', FALSE, FALSE, NULL::TEXT),
    ('140', 'Ben Calambro Cabaya', 'Cabaya', 'Ben', 'Calambro', 'ben.cabaya@gmail.com', DATE '1967-06-18', 'Male', TRUE, FALSE, NULL::TEXT),
    ('141', 'Jimmy Campollo Caballero', 'Caballero', 'Jimmy', 'Campollo', 'jimmy.caballero@gmail.com', DATE '1972-05-17', 'Male', TRUE, TRUE, NULL::TEXT),
    ('141', 'Arlene Mallo Caballero', 'Caballero', 'Arlene', 'Mallo', 'arlene.caballero@gmail.com', DATE '1987-08-12', 'Female', FALSE, FALSE, NULL::TEXT),
    ('141', 'Ariane Mallo Caballero', 'Caballero', 'Ariane', 'Mallo', 'ariane.caballero@gmail.com', DATE '2006-06-13', 'Female', FALSE, FALSE, NULL::TEXT),
    ('141', 'Jieve Arian Mallo Caballero', 'Caballero', 'Jieve Arian', 'Mallo', 'jieve.arian.caballero@gmail.com', DATE '2008-01-09', 'Male', FALSE, FALSE, NULL::TEXT),
    ('141', 'Jelia Mae Hall Caballero', 'Caballero', 'Jelia Mae', 'Hall', 'jelia.mae.caballero@gmail.com', DATE '2015-04-29', 'Female', FALSE, FALSE, NULL::TEXT),
    ('142', 'Edgar Benito Cabasabon', 'Cabasabon', 'Edgar', 'Benito', 'edgar.cabasabon@gmail.com', DATE '1979-04-08', 'Male', FALSE, FALSE, NULL::TEXT),
    ('142', 'Arsie Benito Cabasabon', 'Cabasabon', 'Arsie', 'Benito', 'arsie.cabasabon@gmail.com', DATE '2014-04-08', 'Male', FALSE, FALSE, NULL::TEXT),
    ('143', 'Jerry Calicaran Capilitan', 'Capilitan', 'Jerry', 'Calicaran', 'jerry.capilitan@gmail.com', DATE '1962-04-04', 'Male', TRUE, FALSE, NULL::TEXT),
    ('143', 'Marites Tabaya Capilitan', 'Capilitan', 'Marites', 'Tabaya', 'marites.capilitan@gmail.com', DATE '1983-12-03', 'Female', FALSE, FALSE, NULL::TEXT),
    ('143', 'Riza Tabaya Capilitan', 'Capilitan', 'Riza', 'Tabaya', 'riza.capilitan@gmail.com', DATE '2011-04-19', 'Female', FALSE, FALSE, NULL::TEXT),
    ('143', 'Reziel Tabaya Capilitan', 'Capilitan', 'Reziel', 'Tabaya', 'reziel.capilitan@gmail.com', DATE '2013-08-04', 'Female', FALSE, FALSE, NULL::TEXT),
    ('143', 'Jemart Tabaya Capilitan', 'Capilitan', 'Jemart', 'Tabaya', 'jemart.capilitan@gmail.com', DATE '2015-10-28', 'Male', FALSE, FALSE, NULL::TEXT),
    ('144', 'Jennifer Cambel Calawigan', 'Calawigan', 'Jennifer', 'Cambel', 'jennifer.calawigan@gmail.com', DATE '1986-12-14', 'Male', TRUE, FALSE, NULL::TEXT),
    ('144', 'Jonalyn Galicia Calawigan', 'Calawigan', 'Jonalyn', 'Galicia', 'jonalyn.calawigan@gmail.com', DATE '1990-08-04', 'Female', FALSE, FALSE, NULL::TEXT),
    ('144', 'Jalyn Grace Galicia Calawigan', 'Calawigan', 'Jalyn Grace', 'Galicia', 'jalyn.grace.calawigan@gmail.com', DATE '2010-04-28', 'Female', FALSE, FALSE, NULL::TEXT),
    ('144', 'Kennith Jay Galicia Calawigan', 'Calawigan', 'Kennith Jay', 'Galicia', 'kennith.jay.calawigan@gmail.com', DATE '2017-08-12', 'Male', FALSE, FALSE, NULL::TEXT),
    ('145', 'Michael John Capilitan Cabana', 'Cabana', 'Michael John', 'Capilitan', 'michael.john.cabana@gmail.com', DATE '1993-03-30', 'Male', FALSE, FALSE, NULL::TEXT),
    ('145', 'Darralyn Belano Cabana', 'Cabana', 'Darralyn', 'Belano', 'darralyn.cabana@gmail.com', DATE '1994-07-27', 'Female', FALSE, FALSE, NULL::TEXT),
    ('145', 'Meiane Jhyl Belano Cabana', 'Cabana', 'Meiane Jhyl', 'Belano', 'meiane.jhyl.cabana@gmail.com', DATE '2014-09-30', 'Female', FALSE, FALSE, NULL::TEXT),
    ('145', 'Maurhyne Belano Cabana', 'Cabana', 'Maurhyne', 'Belano', 'maurhyne.cabana@gmail.com', DATE '2018-09-08', 'Female', FALSE, FALSE, NULL::TEXT),
    ('146', 'Dominador Jr. Andres Camancho', 'Camancho', 'Dominador Jr.', 'Andres', 'dominador.jr.camancho@gmail.com', DATE '1986-01-02', 'Male', FALSE, FALSE, NULL::TEXT),
    ('146', 'Rochelle Cajulas Camancho', 'Camancho', 'Rochelle', 'Cajulas', 'rochelle.camancho@gmail.com', DATE '1993-03-27', 'Female', FALSE, FALSE, NULL::TEXT),
    ('147', 'Elvin Talaman Catanus', 'Catanus', 'Elvin', 'Talaman', 'elvin.catanus@gmail.com', DATE '1978-03-19', 'Male', FALSE, FALSE, NULL::TEXT),
    ('147', 'Marivic Aldamar Catanus', 'Catanus', 'Marivic', 'Aldamar', 'marivic.catanus@gmail.com', DATE '1985-10-15', 'Female', FALSE, FALSE, NULL::TEXT),
    ('147', 'Vince Cyrus Aldamar Catanus', 'Catanus', 'Vince Cyrus', 'Aldamar', 'vince.cyrus.catanus@gmail.com', DATE '2017-07-15', 'Male', FALSE, FALSE, NULL::TEXT),
    ('148', 'Richard Maminting Cabaya', 'Cabaya', 'Richard', 'Maminting', 'richard.cabaya@gmail.com', NULL::DATE, 'Male', FALSE, FALSE, NULL::TEXT),
    ('148', 'Pau Gina Labungan Cabaya', 'Cabaya', 'Pau Gina', 'Labungan', 'pau.gina.cabaya@gmail.com', DATE '1994-03-15', 'Female', FALSE, FALSE, NULL::TEXT),
    ('148', 'Jamel Labungan Cabaya', 'Cabaya', 'Jamel', 'Labungan', 'jamel.cabaya@gmail.com', DATE '2013-02-21', 'Male', FALSE, FALSE, NULL::TEXT),
    ('148', 'Ahomesri Labungan Cabaya', 'Cabaya', 'Ahomesri', 'Labungan', 'ahomesri.cabaya@gmail.com', DATE '2016-05-05', 'Male', FALSE, FALSE, NULL::TEXT),
    ('148', 'Jumaira Labungan Cabaya', 'Cabaya', 'Jumaira', 'Labungan', 'jumaira.cabaya@gmail.com', DATE '2020-03-13', 'Female', FALSE, FALSE, NULL::TEXT),
    ('148', 'Joelui Labungan Cabaya', 'Cabaya', 'Joelui', 'Labungan', 'joelui.cabaya@gmail.com', DATE '2023-04-01', 'Male', FALSE, FALSE, NULL::TEXT),
    ('149', 'Joann Talaman Catanus', 'Catanus', 'Joann', 'Talaman', 'joann.catanus@gmail.com', DATE '1982-03-03', 'Male', TRUE, FALSE, NULL::TEXT),
    ('149', 'Dianne Angelie Cambel Catanus', 'Catanus', 'Dianne Angelie', 'Cambel', 'dianne.angelie.catanus@gmail.com', DATE '1988-09-04', 'Female', FALSE, FALSE, NULL::TEXT),
    ('149', 'Gian Nicole Cambel Catanus', 'Catanus', 'Gian Nicole', 'Cambel', 'gian.nicole.catanus@gmail.com', DATE '2008-12-05', 'Female', FALSE, FALSE, NULL::TEXT),
    ('150', 'Hermenio Loquias Cajeo', 'Cajeo', 'Hermenio', 'Loquias', 'hermenio.cajeo@gmail.com', DATE '1963-12-27', 'Male', TRUE, FALSE, NULL::TEXT),
    ('150', 'Ma. Nida Cabaya Cajeo', 'Cajeo', 'Ma. Nida', 'Cabaya', 'ma.nida.cajeo@gmail.com', DATE '1968-05-13', 'Female', FALSE, FALSE, NULL::TEXT),
    ('150', 'Arnie Jay Cabaya Cajeo', 'Cajeo', 'Arnie Jay', 'Cabaya', 'arnie.jay.cajeo@gmail.com', DATE '1996-09-23', 'Male', FALSE, FALSE, NULL::TEXT),
    ('150', 'Arian Cabaya Cajeo', 'Cajeo', 'Arian', 'Cabaya', 'arian.cajeo@gmail.com', DATE '1999-11-17', 'Male', FALSE, FALSE, NULL::TEXT),
    ('150', 'Arjay Cabaya Cajeo', 'Cajeo', 'Arjay', 'Cabaya', 'arjay.cajeo@gmail.com', DATE '2008-08-17', 'Male', FALSE, FALSE, NULL::TEXT),
    ('151', 'Jessie Rey Tuala Catanus', 'Catanus', 'Jessie Rey', 'Tuala', 'jessie.rey.catanus@gmail.com', DATE '1991-02-03', 'Male', FALSE, FALSE, NULL::TEXT),
    ('151', 'Edith Fornoles Catanus', 'Catanus', 'Edith', 'Fornoles', 'edith.catanus@gmail.com', DATE '1989-06-10', 'Female', FALSE, FALSE, NULL::TEXT),
    ('151', 'Klent Earl Fornoles Catanus', 'Catanus', 'Klent Earl', 'Fornoles', 'klent.earl.catanus@gmail.com', DATE '2018-08-17', 'Male', FALSE, FALSE, NULL::TEXT),
    ('151', 'Jan Rey Fornoles Catanus', 'Catanus', 'Jan Rey', 'Fornoles', 'jan.rey.catanus@gmail.com', DATE '2008-10-07', 'Male', FALSE, FALSE, NULL::TEXT),
    ('152', 'Nelson Talaron Caysonan', 'Caysonan', 'Nelson', 'Talaron', 'nelson.caysonan@gmail.com', DATE '1978-02-22', 'Male', TRUE, FALSE, NULL::TEXT),
    ('152', 'Elizabeth Capilitan Caysonan', 'Caysonan', 'Elizabeth', 'Capilitan', 'elizabeth.caysonan@gmail.com', DATE '1971-08-31', 'Female', FALSE, FALSE, NULL::TEXT),
    ('152', 'Jason Capilitan Caysonan', 'Caysonan', 'Jason', 'Capilitan', 'jason.caysonan@gmail.com', DATE '2004-01-08', 'Male', FALSE, FALSE, NULL::TEXT),
    ('152', 'Dexter Capilitan Caysonan', 'Caysonan', 'Dexter', 'Capilitan', 'dexter.caysonan@gmail.com', DATE '2005-10-10', 'Male', FALSE, FALSE, NULL::TEXT),
    ('152', 'Shehan Capilitan Caysonan', 'Caysonan', 'Shehan', 'Capilitan', 'shehan.caysonan@gmail.com', DATE '2007-09-08', 'Female', FALSE, FALSE, NULL::TEXT),
    ('153', 'Renan Catanus Capilitan', 'Capilitan', 'Renan', 'Catanus', 'renan.capilitan@gmail.com', DATE '1984-09-20', 'Male', TRUE, FALSE, NULL::TEXT),
    ('153', 'Juliet Paran Capilitan', 'Capilitan', 'Juliet', 'Paran', 'juliet.capilitan@gmail.com', DATE '1990-06-04', 'Female', FALSE, FALSE, NULL::TEXT),
    ('153', 'James Ryan Paran Capilitan', 'Capilitan', 'James Ryan', 'Paran', 'james.ryan.capilitan@gmail.com', DATE '2008-04-01', 'Male', FALSE, FALSE, NULL::TEXT),
    ('153', 'James Rey Paran Capilitan', 'Capilitan', 'James Rey', 'Paran', 'james.rey.capilitan@gmail.com', DATE '2013-05-17', 'Male', FALSE, FALSE, NULL::TEXT),
    ('154', 'Estrella Tahum Cantero', 'Cantero', 'Estrella', 'Tahum', 'estrella.cantero@gmail.com', DATE '1946-01-11', 'Female', FALSE, FALSE, NULL::TEXT),
    ('155', 'Joky Cabaya Catanus', 'Catanus', 'Joky', 'Cabaya', 'joky.catanus@gmail.com', DATE '1983-07-20', 'Male', TRUE, FALSE, NULL::TEXT),
    ('155', 'Jesel Tadiague Catanus', 'Catanus', 'Jesel', 'Tadiague', 'jesel.catanus@gmail.com', DATE '1991-04-02', 'Female', FALSE, FALSE, NULL::TEXT),
    ('155', 'John Kueth Tadiague Catanus', 'Catanus', 'John Kueth', 'Tadiague', 'john.kueth.catanus@gmail.com', DATE '2008-11-19', 'Male', FALSE, FALSE, NULL::TEXT),
    ('155', 'Jesemie Kaye Tadiague Catanus', 'Catanus', 'Jesemie Kaye', 'Tadiague', 'jesemie.kaye.catanus@gmail.com', DATE '2013-09-30', 'Female', FALSE, FALSE, NULL::TEXT),
    ('156', 'Remie Talamon Capilitan', 'Capilitan', 'Remie', 'Talamon', 'remie.capilitan@gmail.com', DATE '1965-12-03', 'Male', FALSE, FALSE, NULL::TEXT),
    ('156', 'Annabelle Talaran Capilitan', 'Capilitan', 'Annabelle', 'Talaran', 'annabelle.capilitan@gmail.com', DATE '1979-03-26', 'Female', FALSE, FALSE, NULL::TEXT),
    ('156', 'Michele Talaran Capilitan', 'Capilitan', 'Michele', 'Talaran', 'michele.capilitan@gmail.com', DATE '1997-04-15', 'Female', FALSE, FALSE, NULL::TEXT),
    ('156', 'Rachel Talaran Capilitan', 'Capilitan', 'Rachel', 'Talaran', 'rachel.capilitan@gmail.com', DATE '2000-03-11', 'Female', FALSE, FALSE, NULL::TEXT),
    ('156', 'Kitchelle Talaran Capilitan', 'Capilitan', 'Kitchelle', 'Talaran', 'kitchelle.capilitan@gmail.com', DATE '2003-02-19', 'Female', FALSE, FALSE, NULL::TEXT),
    ('157', 'Edgar Canalevan Blanchus', 'Blanchus', 'Edgar', 'Canalevan', 'edgar.blanchus@gmail.com', DATE '1969-09-15', 'Male', FALSE, FALSE, NULL::TEXT),
    ('157', 'Imelda Amorsolo Blanchus', 'Blanchus', 'Imelda', 'Amorsolo', 'imelda.blanchus@gmail.com', DATE '1973-04-15', 'Female', FALSE, FALSE, NULL::TEXT),
    ('157', 'Edrian Amorsolo Blanchus', 'Blanchus', 'Edrian', 'Amorsolo', 'edrian.blanchus@gmail.com', DATE '2002-01-18', 'Male', FALSE, FALSE, NULL::TEXT),
    ('157', 'Edzil Amorsolo Blanchus', 'Blanchus', 'Edzil', 'Amorsolo', 'edzil.blanchus@gmail.com', DATE '2004-09-10', 'Male', FALSE, FALSE, NULL::TEXT),
    ('157', 'Edgie Mark Amorsolo Blanchus', 'Blanchus', 'Edgie Mark', 'Amorsolo', 'edgie.mark.blanchus@gmail.com', DATE '2007-03-30', 'Male', FALSE, FALSE, NULL::TEXT),
    ('158', 'Ben Talha Eskope', 'Eskope', 'Ben', 'Talha', 'ben.eskope@gmail.com', DATE '1969-05-05', 'Male', TRUE, FALSE, NULL::TEXT),
    ('158', 'Gemma Catanus Eskope', 'Eskope', 'Gemma', 'Catanus', 'gemma.eskope@gmail.com', DATE '1976-07-22', 'Female', FALSE, FALSE, NULL::TEXT),
    ('158', 'Marvin Catanus Eskope', 'Eskope', 'Marvin', 'Catanus', 'marvin.eskope@gmail.com', DATE '1999-05-16', 'Male', FALSE, FALSE, NULL::TEXT),
    ('158', 'Keyren Catanus Eskope', 'Eskope', 'Keyren', 'Catanus', 'keyren.eskope@gmail.com', DATE '2007-01-25', 'Male', FALSE, FALSE, NULL::TEXT),
    ('158', 'Kia Marie Catanus Eskope', 'Eskope', 'Kia Marie', 'Catanus', 'kia.marie.eskope@gmail.com', DATE '2019-01-25', 'Female', FALSE, FALSE, NULL::TEXT),
    ('159', 'Monerto Calawigan Capilitan', 'Capilitan', 'Monerto', 'Calawigan', 'monerto.capilitan@gmail.com', DATE '1961-05-11', 'Male', TRUE, FALSE, NULL::TEXT),
    ('159', 'Invy Catanus Capilitan', 'Capilitan', 'Invy', 'Catanus', 'invy.capilitan@gmail.com', DATE '1961-06-02', 'Female', FALSE, FALSE, NULL::TEXT),
    ('159', 'Karen Mae Catanus Capilitan', 'Capilitan', 'Karen Mae', 'Catanus', 'karen.mae.capilitan@gmail.com', DATE '2005-09-29', 'Female', FALSE, FALSE, NULL::TEXT),
    ('159', 'Riza Catanus Capilitan', 'Capilitan', 'Riza', 'Catanus', 'riza.capilitan@gmail.com', DATE '1990-10-07', 'Female', FALSE, FALSE, NULL::TEXT),
    ('160', 'Johnny Camono Cabaya', 'Cabaya', 'Johnny', 'Camono', 'johnny.cabaya@gmail.com', DATE '1988-03-28', 'Male', FALSE, FALSE, NULL::TEXT),
    ('160', 'Kissie Clarito Cabaya', 'Cabaya', 'Kissie', 'Clarito', 'kissie.cabaya@gmail.com', DATE '1990-02-01', 'Female', FALSE, FALSE, NULL::TEXT),
    ('161', 'Ricardo Cabibigan Clarito', 'Clarito', 'Ricardo', 'Cabibigan', 'ricardo.clarito@gmail.com', DATE '1966-09-20', 'Male', FALSE, FALSE, NULL::TEXT),
    ('161', 'Elsie Talaman Clarito', 'Clarito', 'Elsie', 'Talaman', 'elsie.clarito@gmail.com', DATE '1967-06-18', 'Female', FALSE, FALSE, NULL::TEXT),
    ('161', 'Lenie Rose Talaman Clarito', 'Clarito', 'Lenie Rose', 'Talaman', 'lenie.rose.clarito@gmail.com', DATE '1996-10-07', 'Female', FALSE, FALSE, NULL::TEXT),
    ('162', 'Pembe Talaman Capilitan', 'Capilitan', 'Pembe', 'Talaman', 'pembe.capilitan@gmail.com', DATE '1963-04-30', 'Male', TRUE, FALSE, NULL::TEXT),
    ('162', 'Jonalyn Gonzales Capilitan', 'Capilitan', 'Jonalyn', 'Gonzales', 'jonalyn.capilitan@gmail.com', DATE '1988-07-09', 'Female', FALSE, FALSE, NULL::TEXT),
    ('162', 'Jay-ar Gonzales Capilitan', 'Capilitan', 'Jay-ar', 'Gonzales', 'jay.ar.capilitan@gmail.com', DATE '2008-03-29', 'Male', FALSE, FALSE, NULL::TEXT),
    ('162', 'Rubilyn Gonzales Capilitan', 'Capilitan', 'Rubilyn', 'Gonzales', 'rubilyn.capilitan@gmail.com', DATE '2010-03-09', 'Female', FALSE, FALSE, NULL::TEXT),
    ('162', 'Arlyn Gonzales Capilitan', 'Capilitan', 'Arlyn', 'Gonzales', 'arlyn.capilitan@gmail.com', DATE '2013-03-22', 'Female', FALSE, FALSE, NULL::TEXT),
    ('162', 'April Joy Gomaies Capilitan', 'Capilitan', 'April Joy', 'Gomaies', 'april.joy.capilitan@gmail.com', DATE '2018-04-04', 'Female', FALSE, FALSE, NULL::TEXT),
    ('163', 'Renato Capilitan Cabana', 'Cabana', 'Renato', 'Capilitan', 'renato.cabana@gmail.com', DATE '1958-05-27', 'Male', TRUE, FALSE, NULL::TEXT),
    ('163', 'Jarmilyn Capio Cabana', 'Cabana', 'Jarmilyn', 'Capio', 'jarmilyn.cabana@gmail.com', DATE '1989-01-04', 'Female', FALSE, FALSE, NULL::TEXT),
    ('163', 'Penalyn Capio Cabana', 'Cabana', 'Penalyn', 'Capio', 'penalyn.cabana@gmail.com', DATE '2011-10-13', 'Female', FALSE, FALSE, NULL::TEXT),
    ('163', 'Jade Capio Cabana', 'Cabana', 'Jade', 'Capio', 'jade.cabana@gmail.com', DATE '2013-10-09', 'Male', FALSE, FALSE, NULL::TEXT),
    ('163', 'Kyle Capio Cabana', 'Cabana', 'Kyle', 'Capio', 'kyle.cabana@gmail.com', DATE '2013-10-09', 'Female', FALSE, FALSE, NULL::TEXT),
    ('164', 'Ryan Campollo Catanus', 'Catanus', 'Ryan', 'Campollo', 'ryan.catanus@gmail.com', DATE '1986-09-17', 'Male', TRUE, FALSE, NULL::TEXT),
    ('164', 'Jocel Joy Capio Catanus', 'Catanus', 'Jocel Joy', 'Capio', 'jocel.joy.catanus@gmail.com', DATE '1993-07-14', 'Female', FALSE, FALSE, NULL::TEXT),
    ('164', 'Hazelle Kate Capio Catanus', 'Catanus', 'Hazelle Kate', 'Capio', 'hazelle.kate.catanus@gmail.com', DATE '2012-03-05', 'Female', FALSE, FALSE, NULL::TEXT),
    ('164', 'James Earl Capio Catanus', 'Catanus', 'James Earl', 'Capio', 'james.earl.catanus@gmail.com', DATE '2018-07-06', 'Male', FALSE, FALSE, NULL::TEXT),
    ('164', 'Ryza Mae Capio Catanus', 'Catanus', 'Ryza Mae', 'Capio', 'ryza.mae.catanus@gmail.com', DATE '2020-10-23', 'Female', FALSE, FALSE, NULL::TEXT),
    ('165', 'Richard Cabaya Clarito', 'Clarito', 'Richard', 'Cabaya', 'richard.clarito@gmail.com', DATE '1964-03-23', 'Male', FALSE, FALSE, NULL::TEXT),
    ('165', 'Jovelyn Estember Clarito', 'Clarito', 'Jovelyn', 'Estember', 'jovelyn.clarito@gmail.com', DATE '1984-10-12', 'Female', FALSE, FALSE, NULL::TEXT),
    ('165', 'Jasper Dave Clarito', 'Clarito', 'Jasper', 'Dave', 'jasper.dave.clarito@gmail.com', DATE '2009-09-16', 'Male', FALSE, FALSE, NULL::TEXT),
    ('166', 'Juniper Cainjuingoy Catanus', 'Catanus', 'Juniper', 'Cainjuingoy', 'juniper.catanus@gmail.com', DATE '1991-06-22', 'Male', FALSE, FALSE, NULL::TEXT),
    ('166', 'Ma. Cecil Milliones Catanus', 'Catanus', 'Ma. Cecil', 'Milliones', 'ma.cecil.catanus@gmail.com', DATE '1992-11-07', 'Female', FALSE, FALSE, NULL::TEXT),
    ('166', 'Juncel Milliones Catanus', 'Catanus', 'Juncel', 'Milliones', 'juncel.catanus@gmail.com', DATE '2018-10-10', 'Male', FALSE, FALSE, NULL::TEXT),
    ('167', 'Welbert Clarito Dalmacio', 'Dalmacio', 'Welbert', 'Clarito', 'welbert.dalmacio@gmail.com', DATE '1970-08-26', 'Male', TRUE, FALSE, NULL::TEXT),
    ('167', 'Rutchelle Catanus Dalmacio', 'Dalmacio', 'Rutchelle', 'Catanus', 'rutchelle.dalmacio@gmail.com', DATE '1978-08-04', 'Female', FALSE, FALSE, NULL::TEXT),
    ('167', 'Buwelyn Catanus Dalmacio', 'Dalmacio', 'Buwelyn', 'Catanus', 'buwelyn.dalmacio@gmail.com', DATE '2001-09-01', 'Female', FALSE, FALSE, NULL::TEXT),
    ('167', 'Jan Juli Catanus Dalmacio', 'Dalmacio', 'Jan Juli', 'Catanus', 'jan.juli.dalmacio@gmail.com', DATE '2006-01-15', 'Male', FALSE, FALSE, NULL::TEXT),
    ('167', 'Arjay Catanus Dalmacio', 'Dalmacio', 'Arjay', 'Catanus', 'arjay.dalmacio@gmail.com', DATE '2007-11-23', 'Male', FALSE, FALSE, NULL::TEXT),
    ('167', 'Jessa Mae Catanus Dalmacio', 'Dalmacio', 'Jessa Mae', 'Catanus', 'jessa.mae.dalmacio@gmail.com', DATE '2011-08-28', 'Female', FALSE, FALSE, NULL::TEXT),
    ('167', 'Ruel Catanus Dalmacio', 'Dalmacio', 'Ruel', 'Catanus', 'ruel.dalmacio@gmail.com', DATE '1999-10-28', 'Female', FALSE, FALSE, NULL::TEXT),
    ('168', 'Mando Guiabor Kalim', 'Kalim', 'Mando', 'Guiabor', 'mando.kalim@gmail.com', DATE '1962-08-24', 'Male', TRUE, FALSE, NULL::TEXT),
    ('168', 'Jocelyn Catanus Kalim', 'Kalim', 'Jocelyn', 'Catanus', 'jocelyn.kalim@gmail.com', DATE '1966-08-04', 'Female', FALSE, FALSE, NULL::TEXT),
    ('169', 'Arnold Tiros Lienhuo', 'Lienhuo', 'Arnold', 'Tiros', 'arnold.lienhuo@gmail.com', NULL::DATE, 'Male', TRUE, FALSE, NULL::TEXT),
    ('170', 'Ofelia Cabasaban Cabasaban', 'Cabasaban', 'Ofelia', 'Cabasaban', 'ofelia.cabasaban@gmail.com', DATE '1980-11-11', 'Female', FALSE, FALSE, NULL::TEXT),
    ('170', 'Anthony Cabasaban Cabasaban', 'Cabasaban', 'Anthony', 'Cabasaban', 'anthony.cabasaban@gmail.com', DATE '2003-06-21', 'Male', FALSE, FALSE, NULL::TEXT),
    ('170', 'John Paul Cabasaban Cabasaban', 'Cabasaban', 'John Paul', 'Cabasaban', 'john.paul.cabasaban@gmail.com', DATE '2009-06-12', 'Male', FALSE, FALSE, NULL::TEXT),
    ('170', 'John Mark Cabasaban Cabasaban', 'Cabasaban', 'John Mark', 'Cabasaban', 'john.mark.cabasaban@gmail.com', DATE '2012-06-17', 'Male', FALSE, FALSE, NULL::TEXT),
    ('170', 'Arlyn Cabasaban Cabasaban', 'Cabasaban', 'Arlyn', 'Cabasaban', 'arlyn.cabasaban@gmail.com', DATE '2002-02-08', 'Female', FALSE, FALSE, NULL::TEXT),
    ('171', 'Kiesha Arish Cabasaban Labiang', 'Labiang', 'Kiesha Arish', 'Cabasaban', 'kiesha.arish.labiang@gmail.com', DATE '2022-04-22', 'Female', FALSE, FALSE, NULL::TEXT),
    ('172', 'Wilfredo Sr. Tamogos Tabolina', 'Tabolina', 'Wilfredo Sr.', 'Tamogos', 'wilfredo.sr.tabolina@gmail.com', DATE '1949-12-11', 'Male', TRUE, FALSE, NULL::TEXT),
    ('172', 'Egleceria Campollo Tabolina', 'Tabolina', 'Egleceria', 'Campollo', 'egleceria.tabolina@gmail.com', DATE '1957-06-06', 'Female', FALSE, FALSE, NULL::TEXT),
    ('172', 'Wenzel Campollo Tabolina', 'Tabolina', 'Wenzel', 'Campollo', 'wenzel.tabolina@gmail.com', DATE '1996-08-18', 'Male', FALSE, FALSE, NULL::TEXT),
    ('173', 'Crisostomo Cabarillos Tahum', 'Tahum', 'Crisostomo', 'Cabarillos', 'crisostomo.tahum@gmail.com', DATE '1951-05-05', 'Male', TRUE, FALSE, NULL::TEXT),
    ('173', 'Nelda Cabaya Tahum', 'Tahum', 'Nelda', 'Cabaya', 'nelda.tahum@gmail.com', DATE '1972-06-11', 'Female', FALSE, FALSE, NULL::TEXT),
    ('173', 'Cristonel Cabaya Tahum', 'Tahum', 'Cristonel', 'Cabaya', 'cristonel.tahum@gmail.com', DATE '1994-03-22', 'Male', FALSE, FALSE, 'BPAT'),
    ('173', 'Cristopher Cabaya Tahum', 'Tahum', 'Cristopher', 'Cabaya', 'cristopher.tahum@gmail.com', DATE '1998-07-15', 'Male', FALSE, FALSE, NULL::TEXT),
    ('173', 'Erwin Cabaya Tahum', 'Tahum', 'Erwin', 'Cabaya', 'erwin.tahum@gmail.com', DATE '2001-08-12', 'Male', FALSE, FALSE, NULL::TEXT),
    ('174', 'Elizado Cantomayor Cabang', 'Cabang', 'Elizado', 'Cantomayor', 'elizado.cabang@gmail.com', DATE '1958-09-01', 'Male', TRUE, FALSE, NULL::TEXT),
    ('174', 'Tony Catanus Cabang', 'Cabang', 'Tony', 'Catanus', 'tony.cabang@gmail.com', DATE '1962-01-26', 'Female', FALSE, FALSE, NULL::TEXT),
    ('174', 'Elvie Jane Catanus Cabang', 'Cabang', 'Elvie Jane', 'Catanus', 'elvie.jane.cabang@gmail.com', DATE '2001-09-01', 'Female', FALSE, FALSE, NULL::TEXT),
    ('175', 'Marlon Casan Camancho', 'Camancho', 'Marlon', 'Casan', 'marlon.camancho@gmail.com', DATE '1993-05-29', 'Male', FALSE, FALSE, NULL::TEXT),
    ('175', 'Dina Marie Bisto Camancho', 'Camancho', 'Dina Marie', 'Bisto', 'dina.marie.camancho@gmail.com', DATE '2000-08-07', 'Female', FALSE, FALSE, NULL::TEXT),
    ('175', 'Princess Diana Bisto Camancho', 'Camancho', 'Princess Diana', 'Bisto', 'princess.diana.camancho@gmail.com', DATE '2019-01-21', 'Female', FALSE, FALSE, NULL::TEXT),
    ('175', 'Marlon Jr. Bisto Camancho', 'Camancho', 'Marlon Jr.', 'Bisto', 'marlon.jr.camancho@gmail.com', DATE '2021-06-26', 'Male', FALSE, FALSE, NULL::TEXT),
    ('175', 'Yummie Bisto Camancho', 'Camancho', 'Yummie', 'Bisto', 'yummie.camancho@gmail.com', DATE '2023-09-06', 'Female', FALSE, FALSE, NULL::TEXT),
    ('176', 'Joebert Catanus Cabang', 'Cabang', 'Joebert', 'Catanus', 'joebert.cabang@gmail.com', DATE '1982-07-26', 'Male', FALSE, FALSE, NULL::TEXT),
    ('176', 'May Jane Camagos Cabang', 'Cabang', 'May Jane', 'Camagos', 'may.jane.cabang@gmail.com', DATE '2008-01-10', 'Female', FALSE, FALSE, NULL::TEXT),
    ('176', 'Jimmy Boy Camagos Cabang', 'Cabang', 'Jimmy Boy', 'Camagos', 'jimmy.boy.cabang@gmail.com', DATE '2009-03-30', 'Male', FALSE, FALSE, NULL::TEXT),
    ('176', 'April Kaye Camagos Cabang', 'Cabang', 'April Kaye', 'Camagos', 'april.kaye.cabang@gmail.com', DATE '2011-04-17', 'Female', FALSE, FALSE, NULL::TEXT),
    ('176', 'Mitz Camagos Cabang', 'Cabang', 'Mitz', 'Camagos', 'mitz.cabang@gmail.com', DATE '2012-11-01', 'Female', FALSE, FALSE, NULL::TEXT),
    ('177', 'Arnel Capilitan Talaron', 'Talaron', 'Arnel', 'Capilitan', 'arnel.talaron@gmail.com', DATE '1991-12-30', 'Male', TRUE, FALSE, NULL::TEXT),
    ('177', 'Ailyn Camino Talaron', 'Talaron', 'Ailyn', 'Camino', 'ailyn.talaron@gmail.com', DATE '1986-04-24', 'Female', FALSE, FALSE, NULL::TEXT),
    ('177', 'John Arvin Camino Talaron', 'Talaron', 'John Arvin', 'Camino', 'john.arvin.talaron@gmail.com', DATE '2011-07-20', 'Male', FALSE, FALSE, NULL::TEXT),
    ('177', 'Ken Camino Talaron', 'Talaron', 'Ken', 'Camino', 'ken.talaron@gmail.com', DATE '2014-01-15', 'Male', FALSE, FALSE, NULL::TEXT),
    ('177', 'Aliah Nicole Camino Talaron', 'Talaron', 'Aliah Nicole', 'Camino', 'aliah.nicole.talaron@gmail.com', DATE '2016-10-17', 'Female', FALSE, FALSE, NULL::TEXT),
    ('177', 'Chloe Camino Talaron', 'Talaron', 'Chloe', 'Camino', 'chloe.talaron@gmail.com', DATE '2018-09-13', 'Female', FALSE, FALSE, NULL::TEXT),
    ('177', 'Alecia Capilitan Talaron', 'Talaron', 'Alecia', 'Capilitan', 'alecia.talaron@gmail.com', DATE '1919-07-09', 'Female', TRUE, FALSE, NULL::TEXT)
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
    birthplace,
    NULL::TEXT AS educational_attainment,
    NULL::TEXT AS occupation,
    is_4ps_member,
    FALSE AS is_solo_parent,
    NULL::TEXT AS civil_status,
    is_pwd,
    NULL::TEXT AS pwd_type,
    'Malipayon'::TEXT AS purok,
    'Upper Mingading, Aleosan, Cotabato'::TEXT AS address,
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
