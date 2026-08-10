-- Import Payhod resident records 166-237 into public.residents.
-- Run this in the Supabase SQL Editor after the Malipayon imports.
-- Household number is kept from the list: same number means one household/family.
-- All rows use address Upper Mingading, Aleosan, Cotabato and purok Payhod.
-- Relation values are kept from the list, with "Head of Family" normalized to "Head".
-- Missing/incomplete/invalid birthday values are imported as NULL:
-- - Trisia T Clarito
-- - Erlito Catamora Cajeben
-- - Prince Jeo Tamagos Casuita
-- - Kevin Cantimator Casinto
-- - Chrlst Joy Cantimator Casinto
-- - Analiekep Camino Caucaran
-- - Dodong Sigua Campan (DEC 2)
-- - Rowena Campan
-- - Maripaz Caucaran Camano
-- - Elgine Jr Caucaran Capitan (SEPT 31, 2013)
-- - Althea Niche Caucaran Capitan
-- - Carmen Tadiagne Capio (JULY 1962)
-- - Jobel Tadiagne Capio
-- - Jer-Intel Tamangus Capio (OCT 1969)
-- - Jhanelan Talaman Capio
-- - Ketill Liam Valenzuela Catatim
-- - Rodnick Canat Lagdamen
-- - Jeker Tadiaque
-- - Jeger Tadiaque
-- - Nathaniel Tadiaque
-- - Judy Lyn Caucaran Talaman

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
  last_name,
  first_name,
  middle_name,
  email,
  birthday,
  sex,
  relationship_to_household_head
) AS (
  VALUES
    ('166', 'Aldamar', 'Lucy', 'Capilitan', 'lucy.aldamar@gmail.com', DATE '1945-04-07', 'Female', 'Head'),
    ('166', 'Aldamar', 'John Bert', 'Capilitan', 'john.bert.aldamar@gmail.com', DATE '2004-03-16', 'Male', 'Child'),
    ('166', 'Aldamar', 'Jann Rey', 'Capilitan', 'jann.rey.aldamar@gmail.com', DATE '2006-02-10', 'Male', 'Child'),
    ('167', 'Clarito', 'Rene John', 'Capio', 'rene.john.clarito@gmail.com', DATE '1984-10-24', 'Male', 'Head'),
    ('167', 'Clarito', 'Trisia', 'T', 'trisia.clarito@gmail.com', NULL::DATE, 'Female', 'Spouse'),
    ('168', 'Almorade', 'Benifredo Jr', 'Capio', 'benifredo.jr.almorade@gmail.com', DATE '1978-12-21', 'Male', 'Head'),
    ('168', 'Almorade', 'Lovely', 'C', 'lovely.almorade@gmail.com', DATE '1978-08-18', 'Female', 'Spouse'),
    ('169', 'Almorade', 'Benifredo Sr', 'Taclan', 'benifredo.sr.almorade@gmail.com', DATE '1975-06-18', 'Male', 'Head'),
    ('169', 'Almorade', 'Helen', 'Capio', 'helen.almorade@gmail.com', DATE '1975-08-04', 'Female', 'Spouse'),
    ('169', 'Almorade', 'Renaldo', 'Capio', 'renaldo.almorade@gmail.com', DATE '2004-04-23', 'Male', 'Child'),
    ('169', 'Almorade', 'Ritchelle', 'Capio', 'ritchelle.almorade@gmail.com', DATE '2007-01-13', 'Female', 'Child'),
    ('169', 'Almorade', 'Angel Gia', 'Capio', 'angel.gia.almorade@gmail.com', DATE '2012-01-12', 'Female', 'Child'),
    ('170', 'Aquita', 'Junibert Jr', 'Caucan', 'junibert.jr.aquita@gmail.com', DATE '1976-04-10', 'Male', 'Head'),
    ('170', 'Aquita', 'Linda', 'Caucan', 'linda.aquita@gmail.com', DATE '1965-03-17', 'Female', 'Spouse'),
    ('170', 'Aquita', 'Junie Mark', 'Caucan', 'junie.mark.aquita@gmail.com', DATE '2003-02-25', 'Male', 'Child'),
    ('170', 'Aquita', 'Jenie Rose', 'Caucan', 'jenie.rose.aquita@gmail.com', DATE '2006-06-23', 'Female', 'Child'),
    ('170', 'Aquita', 'Gwenie Jane', 'Caucan', 'gwenie.jane.aquita@gmail.com', DATE '2007-05-13', 'Female', 'Child'),
    ('170', 'Aquita', 'Junibert Jr II', 'Caucan', 'junibert.jr2.aquita@gmail.com', DATE '2015-04-05', 'Male', 'Child'),
    ('171', 'Bangon', 'Ekap Ryan', 'Oslota', 'ekap.ryan.bangon@gmail.com', DATE '1978-06-30', 'Male', 'Head'),
    ('171', 'Bangon', 'Ryline', 'Tanuta', 'ryline.bangon@gmail.com', DATE '2007-07-02', 'Female', 'Child'),
    ('172', 'Cabana', 'Marcelino', 'Campollo', 'marcelino.cabana@gmail.com', DATE '1970-08-25', 'Male', 'Head'),
    ('172', 'Cabana', 'Lil', 'Cantimator', 'lil.cabana@gmail.com', DATE '1948-09-16', 'Female', 'Spouse'),
    ('172', 'Cabana', 'Arvin', 'Cantimator', 'arvin.cabana@gmail.com', DATE '1989-03-07', 'Male', 'Child'),
    ('173', 'Cabalid', 'Richard', 'Cabatinator', 'richard.cabalid@gmail.com', DATE '1987-09-17', 'Male', 'Head'),
    ('173', 'Cabalid', 'Deverly Joy', 'Talaman', 'deverly.joy.cabalid@gmail.com', DATE '1993-03-16', 'Female', 'Spouse'),
    ('173', 'Cabalid', 'John River', 'Talaman', 'john.river.cabalid@gmail.com', DATE '2014-02-24', 'Male', 'Child'),
    ('174', 'Chanales', 'Arnivard', 'Cantomator', 'arnivard.chanales@gmail.com', DATE '1963-06-21', 'Male', 'Head'),
    ('174', 'Chanales', 'Jadotha', 'Capio', 'jadotha.chanales@gmail.com', DATE '1960-09-22', 'Female', 'Spouse'),
    ('174', 'Chanales', 'Edgar', 'Capio', 'edgar.chanales@gmail.com', DATE '1989-09-03', 'Male', 'Child'),
    ('174', 'Chanales', 'Jonathan', 'Capio', 'jonathan.chanales@gmail.com', DATE '1991-05-07', 'Male', 'Child'),
    ('174', 'Chanales', 'Jerald', 'Capio', 'jerald.chanales@gmail.com', DATE '1983-02-15', 'Male', 'Child'),
    ('175', 'Cabata', 'Rafael', 'Amorsolo', 'rafael.cabata@gmail.com', DATE '1974-04-20', 'Male', 'Head'),
    ('175', 'Cabata', 'Rinalin', 'Catanun', 'rinalin.cabata@gmail.com', DATE '2001-01-18', 'Female', 'Spouse'),
    ('175', 'Cabata', 'Kenneth', 'Catanun', 'kenneth.cabata@gmail.com', DATE '2007-05-05', 'Male', 'Child'),
    ('175', 'Cabata', 'Rondel', 'Catanun', 'rondel.cabata@gmail.com', DATE '2012-01-20', 'Male', 'Child'),
    ('176', 'Cabata', 'Randy', 'Capilitan', 'randy.cabata@gmail.com', DATE '1971-04-21', 'Male', 'Head'),
    ('176', 'Cabata', 'Jerlin', 'Capio', 'jerlin.cabata@gmail.com', DATE '1973-04-16', 'Female', 'Spouse'),
    ('176', 'Cabata', 'Andy Jay', 'Capio', 'andy.jay.cabata@gmail.com', DATE '2014-12-27', 'Male', 'Child'),
    ('176', 'Cabata', 'Rihan Jacob', 'Capio', 'rihan.jacob.cabata@gmail.com', DATE '2009-01-25', 'Male', 'Child'),
    ('177', 'Cajeben', 'Bernie', 'Calamba', 'bernie.cajeben@gmail.com', DATE '1973-03-26', 'Male', 'Head'),
    ('177', 'Cajeben', 'Jacqueline', 'Givenie', 'jacqueline.cajeben@gmail.com', DATE '1972-06-26', 'Female', 'Spouse'),
    ('177', 'Cajeben', 'Aldrian', 'Givenie', 'aldrian.cajeben@gmail.com', DATE '2000-02-12', 'Male', 'Child'),
    ('177', 'Cajeben', 'Kita Nike', 'Gue', 'kita.nike.cajeben@gmail.com', DATE '2003-02-12', 'Female', 'Child'),
    ('177', 'Cajeben', 'Aires', NULL::TEXT, 'aires.cajeben@gmail.com', DATE '2005-01-15', 'Female', 'Child'),
    ('177', 'Cajeben', 'Kian Rey', NULL::TEXT, 'kian.rey.cajeben@gmail.com', DATE '2012-04-08', 'Male', 'Child'),
    ('178', 'Cajeben', 'Erlito', 'Catamora', 'erlito.cajeben@gmail.com', NULL::DATE, 'Male', 'Head'),
    ('179', 'Casuita', 'Jimboy', 'Capio', 'jimboy.casuita@gmail.com', DATE '1969-09-27', 'Male', 'Head'),
    ('179', 'Casuita', 'Atimador', 'Tamagos', 'atimador.casuita@gmail.com', DATE '1973-01-09', 'Female', 'Spouse'),
    ('179', 'Casuita', 'Jaylord', 'Tamagos', 'jaylord.casuita@gmail.com', DATE '2013-11-21', 'Male', 'Child'),
    ('179', 'Casuita', 'Prince Jeo', 'Tamagos', 'prince.jeo.casuita@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('180', 'Casinto', 'Julito', 'Capio', 'julito.casinto@gmail.com', DATE '2001-04-16', 'Male', 'Head'),
    ('180', 'Casinto', 'Ken Marvie', 'Cantimator', 'ken.marvie.casinto@gmail.com', DATE '2004-03-18', 'Male', 'Child'),
    ('180', 'Casinto', 'Allen Jay', 'Cantimator', 'allen.jay.casinto@gmail.com', DATE '2006-04-29', 'Male', 'Child'),
    ('180', 'Casinto', 'Kevin', 'Cantimator', 'kevin.casinto@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('180', 'Casinto', 'Chrlst Joy', 'Cantimator', 'chrlst.joy.casinto@gmail.com', NULL::DATE, 'Female', 'Child'),
    ('181', 'Cauton', 'Romeo', 'Cauddan', 'romeo.cauton@gmail.com', DATE '1949-01-14', 'Male', 'Head'),
    ('181', 'Cauton', 'Merly', 'Capio', 'merly.cauton@gmail.com', DATE '1950-10-16', 'Female', 'Spouse'),
    ('181', 'Cauton', 'Jelly', 'Capio', 'jelly.cauton@gmail.com', DATE '1980-05-10', 'Female', 'Child'),
    ('182', 'Caucaran', 'Analiekep', 'Camino', 'analiekep.caucaran@gmail.com', NULL::DATE, 'Male', 'Head'),
    ('183', 'Caucaran', 'Jacklyn', 'Canat', 'jacklyn.caucaran@gmail.com', DATE '2013-07-14', 'Female', 'Head'),
    ('184', 'Caucaran', 'Maricel', 'Cantimator', 'maricel.caucaran@gmail.com', DATE '1980-09-19', 'Female', 'Head'),
    ('184', 'Caucaran', 'Chacel Mae', NULL::TEXT, 'chacel.mae.caucaran@gmail.com', DATE '2004-03-30', 'Female', 'Child'),
    ('184', 'Caucaran', 'Salah Mae', NULL::TEXT, 'salah.mae.caucaran@gmail.com', DATE '2005-04-04', 'Female', 'Child'),
    ('185', 'Caucaran', 'Mansulito', 'Caucan', 'mansulito.caucaran@gmail.com', DATE '1943-11-05', 'Male', 'Head'),
    ('185', 'Caucaran', 'Consuelo', 'Castro', 'consuelo.caucaran@gmail.com', DATE '1947-04-17', 'Female', 'Spouse'),
    ('185', 'Caucaran', 'Ronaldo', 'Castro', 'ronaldo.caucaran@gmail.com', DATE '1980-01-26', 'Male', 'Child'),
    ('185', 'Caucaran', 'Ricardo', 'Castro', 'ricardo.caucaran@gmail.com', DATE '1983-08-25', 'Male', 'Child'),
    ('186', 'Caucaran', 'Nobe', 'Orcupal', 'nobe.caucaran@gmail.com', DATE '1977-11-25', 'Male', 'Head'),
    ('186', 'Caucaran', 'Mary Joy', 'Catino', 'mary.joy.caucaran@gmail.com', DATE '1970-05-16', 'Female', 'Spouse'),
    ('186', 'Caucaran', 'Arla Jean', 'Catino', 'arla.jean.caucaran@gmail.com', DATE '2004-02-12', 'Female', 'Child'),
    ('186', 'Caucaran', 'Francis Paolo', 'Catino', 'francis.paolo.caucaran@gmail.com', DATE '2006-07-24', 'Male', 'Child'),
    ('186', 'Caucaran', 'Kia Faith', 'Catind', 'kia.faith.caucaran@gmail.com', DATE '2017-08-20', 'Female', 'Child'),
    ('187', 'Caucaran', 'Coraza', 'Tadiague', 'coraza.caucaran@gmail.com', DATE '1945-10-14', 'Female', 'Head'),
    ('187', 'Caucaran', 'Bernaber', 'Tadiague', 'bernaber.caucaran@gmail.com', DATE '1979-04-13', 'Male', 'Child'),
    ('188', 'Caucaran', 'Vergilid', 'Tadiague', 'vergilid.caucaran@gmail.com', DATE '1966-08-14', 'Male', 'Head'),
    ('188', 'Caucaran', 'Jocefyn', 'Canat', 'jocefyn.caucaran@gmail.com', DATE '1967-02-19', 'Female', 'Spouse'),
    ('188', 'Caucaran', 'Kristina', 'Canat', 'kristina.caucaran@gmail.com', DATE '1986-05-12', 'Female', 'Child'),
    ('188', 'Caucaran', 'Virgilio', 'Canat Jr', 'virgilio.caucaran@gmail.com', DATE '1987-09-18', 'Male', 'Child'),
    ('189', 'Caucaran', 'David', 'Tadiague', 'david.caucaran@gmail.com', DATE '1950-01-14', 'Male', 'Head'),
    ('189', 'Caucaran', 'Jonnie Marie', 'Casinto', 'jonnie.marie.caucaran@gmail.com', DATE '1945-05-01', 'Female', 'Spouse'),
    ('189', 'Caucaran', 'Elaine', 'Casinto', 'elaine.caucaran@gmail.com', NULL::DATE, 'Female', 'Child'),
    ('189', 'Caucaran', 'John Lord', 'Casinto', 'john.lord.caucaran@gmail.com', DATE '2003-06-03', 'Male', 'Child'),
    ('190', 'Caucaran', 'Veronica', 'Orcupal', 'veronica.caucaran@gmail.com', DATE '1954-08-24', 'Female', 'Head'),
    ('191', 'Canat', 'Dennis', 'Calamba', 'dennis.canat@gmail.com', DATE '1963-02-24', 'Male', 'Head'),
    ('191', 'Canat', 'Rusa', 'Tanula', 'rusa.canat@gmail.com', DATE '1967-01-23', 'Female', 'Spouse'),
    ('192', 'Canat', 'Elena', 'Ortino', 'elena.canat@gmail.com', DATE '1975-05-09', 'Female', 'Head'),
    ('192', 'Canat', 'Stephanie', 'Ortino', 'stephanie.canat@gmail.com', DATE '2001-04-17', 'Female', 'Child'),
    ('192', 'Canat', 'Steven Jay', 'Ortino', 'steven.jay.canat@gmail.com', DATE '2004-07-14', 'Male', 'Child'),
    ('192', 'Canat', 'Ellen Rose', 'Ortino', 'ellen.rose.canat@gmail.com', DATE '2009-04-02', 'Female', 'Child'),
    ('193', 'Campan', 'Dodong', 'Sigua', 'dodong.campan@gmail.com', NULL::DATE, 'Male', 'Head'),
    ('193', 'Campan', 'Rowena', NULL::TEXT, 'rowena.campan@gmail.com', NULL::DATE, 'Female', 'Spouse'),
    ('193', 'Campan', 'Dena Dable', 'Cantimator', 'dena.dable.campan@gmail.com', DATE '2015-10-06', 'Female', 'Child'),
    ('194', 'Catind', 'Arsenia', 'Orcupal', 'arsenia.catind@gmail.com', DATE '1955-03-16', 'Female', 'Head'),
    ('195', 'Camano', 'Rigelito', 'Gondolli', 'rigelito.camano@gmail.com', DATE '1967-01-31', 'Male', 'Head'),
    ('195', 'Camano', 'Maripaz', 'Caucaran', 'maripaz.camano@gmail.com', NULL::DATE, 'Female', 'Spouse'),
    ('195', 'Camano', 'Nivelyn', 'Caucaran', 'nivelyn.camano@gmail.com', DATE '2003-01-20', 'Female', 'Child'),
    ('196', 'Campanelo', 'John', 'Gallano', 'john.campanelo@gmail.com', DATE '1980-01-31', 'Male', 'Head'),
    ('196', 'Campanelo', 'Jhot', 'Chanales', 'jhot.campanelo@gmail.com', DATE '1982-04-28', 'Female', 'Spouse'),
    ('196', 'Campanelo', 'Dica', 'Chanales', 'dica.campanelo@gmail.com', DATE '2002-04-30', 'Female', 'Child'),
    ('196', 'Campanelo', 'Eron', 'Chanales', 'eron.campanelo@gmail.com', DATE '2004-09-25', 'Male', 'Child'),
    ('197', 'Cantimator', 'Nelvin', 'Caluya', 'nelvin.cantimator@gmail.com', DATE '1976-01-20', 'Male', 'Head'),
    ('197', 'Cantimator', 'Rocalie', 'Caucaran', 'rocalie.cantimator@gmail.com', DATE '1972-09-29', 'Female', 'Spouse'),
    ('197', 'Cantimator', 'Ronwin', 'Caucaran', 'ronwin.cantimator@gmail.com', DATE '1998-11-14', 'Male', 'Child'),
    ('197', 'Cantimator', 'Ron Brian', 'Caucaran', 'ron.brian.cantimator@gmail.com', DATE '2000-05-23', 'Male', 'Child'),
    ('197', 'Cantimator', 'Ronelyn', 'Caucaran', 'ronelyn.cantimator@gmail.com', DATE '2004-09-29', 'Female', 'Child'),
    ('198', 'Capilitan', 'Anacleta', 'Talaman', 'anacleta.capilitan@gmail.com', DATE '1945-01-13', 'Female', 'Head'),
    ('199', 'Capitan', 'Eugenie Sr', 'Calamba', 'eugenie.sr.capitan@gmail.com', DATE '1954-08-30', 'Male', 'Head'),
    ('199', 'Capitan', 'Maricel', 'Caucaran', 'maricel.capitan@gmail.com', DATE '1960-02-17', 'Female', 'Spouse'),
    ('199', 'Capitan', 'Je Lan', 'Caucaran', 'je.lan.capitan@gmail.com', DATE '2000-09-09', 'Male', 'Child'),
    ('199', 'Capitan', 'Lory Jane', 'Caucaran', 'lory.jane.capitan@gmail.com', DATE '2010-09-01', 'Female', 'Child'),
    ('199', 'Capitan', 'Elgine Jr', 'Caucaran', 'elgine.jr.capitan@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('199', 'Capitan', 'Etra Mae', 'Caucaran', 'etra.mae.capitan@gmail.com', DATE '2017-09-17', 'Female', 'Child'),
    ('199', 'Capitan', 'Etrza Jane', 'Caucaran', 'etrza.jane.capitan@gmail.com', DATE '2017-09-17', 'Female', 'Child'),
    ('199', 'Capitan', 'Catlen Jane', 'Caucaran', 'catlen.jane.capitan@gmail.com', DATE '2016-10-15', 'Female', 'Child'),
    ('199', 'Capitan', 'Althea Niche', 'Caucaran', 'althea.niche.capitan@gmail.com', NULL::DATE, 'Female', 'Child'),
    ('200', 'Capio', 'Carmen', 'Tadiagne', 'carmen.capio@gmail.com', NULL::DATE, 'Female', 'Head'),
    ('200', 'Capio', 'Jobel', 'Tadiagne', 'jobel.capio@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('201', 'Capio', 'Custodio', 'Talaman', 'custodio.capio@gmail.com', DATE '1950-09-25', 'Male', 'Head'),
    ('201', 'Capio', 'Elsa', 'Talaman', 'elsa.capio@gmail.com', DATE '1952-04-28', 'Female', 'Spouse'),
    ('201', 'Capio', 'Arnulfo', 'Talaman', 'arnulfo.capio@gmail.com', DATE '1989-10-02', 'Male', 'Child'),
    ('202', 'Capio', 'Danilf', 'Talaman', 'danilf.capio@gmail.com', DATE '1960-03-15', 'Male', 'Head'),
    ('202', 'Capio', 'Niñet', 'De Los Angeles', 'niniet.capio@gmail.com', DATE '1968-09-24', 'Female', 'Spouse'),
    ('202', 'Capio', 'Justin Mark', 'De Los Angeles', 'justin.mark.capio@gmail.com', DATE '2000-01-20', 'Male', 'Child'),
    ('202', 'Capio', 'Ronen Carl', 'De Los Angeles', 'ronen.carl.capio@gmail.com', DATE '2002-06-15', 'Male', 'Child'),
    ('202', 'Capio', 'Abegail Mae', 'De Los Angeles', 'abegail.mae.capio@gmail.com', DATE '2008-03-25', 'Female', 'Child'),
    ('203', 'Capio', 'Jedradel', 'Tadiagne', 'jedradel.capio@gmail.com', DATE '1952-12-12', 'Male', 'Head'),
    ('203', 'Capio', 'Ben, Mary', 'Lapenan', 'ben.mary.capio@gmail.com', DATE '1955-05-21', 'Female', 'Spouse'),
    ('203', 'Capio', 'Rhea Jane', 'Lapenan', 'rhea.jane.capio@gmail.com', DATE '2001-06-28', 'Female', 'Child'),
    ('204', 'Capio', 'Jerry', 'Loguas', 'jerry.capio@gmail.com', DATE '1993-12-13', 'Male', 'Head'),
    ('204', 'Capio', 'Joilyn', 'Talaman', 'joilyn.capio@gmail.com', DATE '1986-09-28', 'Female', 'Spouse'),
    ('204', 'Capio', 'Cherelfie', 'Talaman', 'cherelfie.capio@gmail.com', DATE '2011-11-30', 'Female', 'Child'),
    ('204', 'Capio', 'Erin Carl', 'Talaman', 'erin.carl.capio@gmail.com', DATE '2015-01-16', 'Male', 'Child'),
    ('204', 'Capio', 'Cheretal', 'Talaman', 'cheretal.capio@gmail.com', DATE '2016-11-16', 'Female', 'Child'),
    ('205', 'Capio', 'Jovani', 'Talaman', 'jovani.capio@gmail.com', DATE '1992-12-16', 'Male', 'Head'),
    ('205', 'Capio', 'Gretchenine', 'Cabaya', 'gretchenine.capio@gmail.com', DATE '1994-04-05', 'Female', 'Spouse'),
    ('205', 'Capio', 'Fan Pauls', 'Cabaya', 'fan.pauls.capio@gmail.com', DATE '2016-03-22', 'Male', 'Child'),
    ('205', 'Capio', 'Ariel Dave', 'Cabaya', 'ariel.dave.capio@gmail.com', DATE '2017-05-23', 'Male', 'Child'),
    ('206', 'Capio', 'Jer-Intel', 'Tamangus', 'jer.intel.capio@gmail.com', NULL::DATE, 'Male', 'Head'),
    ('206', 'Capio', 'Nonie', 'Tamangus', 'nonie.capio@gmail.com', DATE '1971-11-18', 'Male', 'Sibling'),
    ('206', 'Capio', 'Vinis', 'Tamangus', 'vinis.capio@gmail.com', DATE '1982-01-12', 'Male', 'Sibling'),
    ('207', 'Capio', 'Randy', 'Loguas', 'randy.capio@gmail.com', DATE '1961-12-15', 'Male', 'Head'),
    ('208', 'Capio', 'Richel', 'Talha', 'richel.capio@gmail.com', DATE '1969-09-13', 'Male', 'Head'),
    ('208', 'Capio', 'Jovelyn', 'Oramos', 'jovelyn.capio@gmail.com', DATE '1988-12-24', 'Female', 'Spouse'),
    ('208', 'Capio', 'Jonal Ritch', 'Oramos', 'jonal.ritch.capio@gmail.com', DATE '2010-01-08', 'Male', 'Child'),
    ('208', 'Capio', 'John Kerstoff', 'Oramos', 'john.kerstoff.capio@gmail.com', DATE '2014-04-20', 'Male', 'Child'),
    ('209', 'Capio', 'Rocenio', 'Doguias', 'rocenio.capio@gmail.com', DATE '1965-02-12', 'Male', 'Head'),
    ('210', 'Capio', 'Renato Sr', 'Talaman', 'renato.sr.capio@gmail.com', DATE '1952-01-28', 'Male', 'Head'),
    ('210', 'Capio', 'Lola', 'Talaman', 'lola.capio@gmail.com', DATE '1952-04-20', 'Female', 'Spouse'),
    ('210', 'Capio', 'Arael', 'Talaman', 'arael.capio@gmail.com', DATE '1986-04-17', 'Female', 'Child'),
    ('210', 'Capio', 'Romelo Jr', 'Talaman', 'romelo.jr.capio@gmail.com', DATE '1994-11-23', 'Male', 'Child'),
    ('211', 'Capio', 'Rolando', 'Talua', 'rolando.capio@gmail.com', DATE '1955-05-30', 'Male', 'Head'),
    ('211', 'Capio', 'Jhanelan', 'Talaman', 'jhanelan.capio@gmail.com', NULL::DATE, 'Female', 'Spouse'),
    ('211', 'Capio', 'Clenta John', 'Talaman', 'clenta.john.capio@gmail.com', DATE '2006-12-05', 'Male', 'Child'),
    ('212', 'Catatim', 'Rommel Lord', 'Damianco', 'rommel.lord.catatim@gmail.com', DATE '1993-04-20', 'Male', 'Head'),
    ('212', 'Catatim', 'Ronita', 'Valenzuela', 'ronita.catatim@gmail.com', DATE '1994-04-30', 'Female', 'Spouse'),
    ('212', 'Catatim', 'Ketill Liam', 'Valenzuela', 'ketill.liam.catatim@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('213', 'Catahan', 'Edgar', 'Chenna', 'edgar.catahan@gmail.com', DATE '1970-12-01', 'Male', 'Head'),
    ('213', 'Catahan', 'Mariajofe', 'Capio', 'mariajofe.catahan@gmail.com', DATE '1973-07-22', 'Female', 'Spouse'),
    ('213', 'Catahan', 'Cherry Ann', 'Capio', 'cherry.ann.catahan@gmail.com', DATE '1995-01-04', 'Female', 'Child'),
    ('213', 'Catahan', 'Ravil', 'Capio', 'ravil.catahan@gmail.com', DATE '1997-08-24', 'Male', 'Child'),
    ('213', 'Catahan', 'Excel Nat', 'Capio', 'excel.nat.catahan@gmail.com', DATE '1998-08-24', 'Male', 'Child'),
    ('213', 'Catahan', 'Mike George', 'Capio', 'mike.george.catahan@gmail.com', DATE '2001-12-17', 'Female', 'Child'),
    ('213', 'Catahan', 'Karlst Imar', 'Capio', 'karlst.imar.catahan@gmail.com', DATE '2007-12-16', 'Female', 'Child'),
    ('214', 'Catahan', 'Eliseo', 'Chenna', 'eliseo.catahan@gmail.com', DATE '1977-01-30', 'Male', 'Head'),
    ('214', 'Catahan', 'Dangerline', 'Canat', 'dangerline.catahan@gmail.com', DATE '1982-11-18', 'Female', 'Spouse'),
    ('214', 'Catahan', 'Mylene', 'Canat', 'mylene.catahan@gmail.com', DATE '1989-10-02', 'Female', 'Child'),
    ('214', 'Catahan', 'Joet', 'Canat', 'joet.catahan@gmail.com', DATE '1996-07-24', 'Female', 'Child'),
    ('214', 'Catahan', 'Jona', 'Canat', 'jona.catahan@gmail.com', DATE '1999-11-30', 'Female', 'Child'),
    ('215', 'Catahan', 'Noe Berto', 'Chenna', 'noe.berto.catahan@gmail.com', DATE '1974-07-12', 'Male', 'Head'),
    ('215', 'Catahan', 'Lorej', 'Damiano', 'lorej.catahan@gmail.com', DATE '1974-05-14', 'Female', 'Spouse'),
    ('215', 'Catahan', 'Princes', 'Damiano', 'princes.catahan@gmail.com', DATE '1992-03-09', 'Female', 'Child'),
    ('215', 'Catahan', 'Prinjay', 'Damiano', 'prinjay.catahan@gmail.com', DATE '2001-01-14', 'Male', 'Child'),
    ('215', 'Catahan', 'Prince Renore', 'Damiano', 'prince.renore.catahan@gmail.com', DATE '2003-05-01', 'Male', 'Child'),
    ('216', 'Cataus', 'Rocel', 'Tadiagne', 'rocel.cataus@gmail.com', DATE '1983-09-05', 'Female', 'Head'),
    ('216', 'Cataus', 'Mita Erzelle Grace', 'Tadiagne', 'mita.erzelle.grace.cataus@gmail.com', DATE '2009-01-16', 'Female', 'Child'),
    ('216', 'Cataus', 'Sandy Claire', 'Tadiagne', 'sandy.claire.cataus@gmail.com', DATE '2010-09-30', 'Female', 'Child'),
    ('216', 'Cataus', 'Russele Dave', 'Tadiagne', 'russele.dave.cataus@gmail.com', DATE '2012-01-15', 'Female', 'Child'),
    ('216', 'Cataus', 'Denn Naia Rex', 'Tadiagne', 'denn.naia.rex.cataus@gmail.com', DATE '2014-01-09', 'Female', 'Child'),
    ('217', 'Lacamten', 'Kim Mark', 'Canat', 'kim.mark.lacamten@gmail.com', DATE '1986-04-30', 'Male', 'Head'),
    ('217', 'Lacamten', 'Guiniven', 'Brito', 'guiniven.lacamten@gmail.com', DATE '1991-07-09', 'Female', 'Spouse'),
    ('217', 'Lacamten', 'Rica Santanina', 'Brito', 'rica.santanina.lacamten@gmail.com', DATE '2018-04-28', 'Female', 'Child'),
    ('218', 'Lagdamen', 'Roger Sr.', 'Amparo', 'roger.sr.lagdamen@gmail.com', DATE '1927-08-19', 'Male', 'Head'),
    ('218', 'Lagdamen', 'Angelina', 'Cantimator', 'angelina.lagdamen@gmail.com', DATE '1942-09-30', 'Female', 'Spouse'),
    ('218', 'Lagdamen', 'Roger Jr.', 'Cantimator', 'roger.jr.lagdamen@gmail.com', DATE '2003-03-10', 'Male', 'Child'),
    ('218', 'Lagdamen', 'Rodnick', 'Canat', 'rodnick.lagdamen@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('219', 'Lopez', 'Arthur', 'Francisco', 'arthur.lopez@gmail.com', DATE '1948-09-07', 'Male', 'Head'),
    ('219', 'Lopez', 'Jiesa', 'Capio', 'jiesa.lopez@gmail.com', DATE '1952-01-01', 'Female', 'Spouse'),
    ('219', 'Lopez', 'Margie Noemi', 'Capio', 'margie.noemi.lopez@gmail.com', DATE '2016-11-16', 'Female', 'Child'),
    ('220', 'Ortega', 'Rogelian', 'Talaman', 'rogelian.ortega@gmail.com', DATE '1979-01-17', 'Female', 'Head'),
    ('220', 'Ortega', 'St. Clara', 'Talaman', 'st.clara.ortega@gmail.com', DATE '2010-03-11', 'Female', 'Child'),
    ('220', 'Ortega', 'Bryan Den', 'Talaman', 'bryan.den.ortega@gmail.com', DATE '2002-12-21', 'Male', 'Child'),
    ('220', 'Ortega', 'Rechelle De', 'Talaman', 'rechelle.de.ortega@gmail.com', DATE '2005-01-11', 'Female', 'Child'),
    ('221', 'Raguro', 'Ernesto Jr.', 'Ureta', 'ernesto.jr.raguro@gmail.com', DATE '1988-02-21', 'Male', 'Head'),
    ('222', 'Salonoy', 'Napareno', 'Encardo', 'napareno.salonoy@gmail.com', DATE '1971-04-02', 'Male', 'Head'),
    ('222', 'Salonoy', 'Jevie Joy', 'Pinada', 'jevie.joy.salonoy@gmail.com', DATE '1995-09-25', 'Female', 'Spouse'),
    ('222', 'Salonoy', 'Lee Ann', 'Pinada', 'lee.ann.salonoy@gmail.com', DATE '2004-07-14', 'Female', 'Child'),
    ('222', 'Salonoy', 'Cabrina Angel', 'Pinada', 'cabrina.angel.salonoy@gmail.com', DATE '2014-04-20', 'Female', 'Child'),
    ('222', 'Salonoy', 'Jodethon', 'Graganta', 'jodethon.salonoy@gmail.com', DATE '2023-01-09', 'Male', 'Child'),
    ('223', 'Tacaisan', 'Jim', 'Eulama', 'jim.tacaisan@gmail.com', DATE '1977-11-17', 'Male', 'Head'),
    ('223', 'Tacaisan', 'Rose Marie', 'Caucaran', 'rose.marie.tacaisan@gmail.com', DATE '1981-10-10', 'Female', 'Spouse'),
    ('223', 'Tacaisan', 'Cabuif', 'Caucaran', 'cabuif.tacaisan@gmail.com', DATE '2002-03-24', 'Male', 'Child'),
    ('223', 'Tacaisan', 'Camilene', 'Caucaran', 'camilene.tacaisan@gmail.com', DATE '2005-10-12', 'Female', 'Child'),
    ('223', 'Tacaisan', 'Jimrose', 'Caucaran', 'jimrose.tacaisan@gmail.com', DATE '2007-04-14', 'Female', 'Child'),
    ('223', 'Tacaisan', 'Cabris', 'Caucaran', 'cabris.tacaisan@gmail.com', DATE '2011-03-11', 'Female', 'Child'),
    ('223', 'Tacaisan', 'Channie', 'Caucaran', 'channie.tacaisan@gmail.com', DATE '2013-12-02', 'Female', 'Child'),
    ('224', 'Tadiaque', 'Emelita', 'Canat', 'emelita.tadiaque@gmail.com', DATE '1961-07-05', 'Female', 'Head'),
    ('224', 'Tadiaque', 'Jan', 'Canat', 'jan.tadiaque@gmail.com', DATE '1993-03-08', 'Male', 'Child'),
    ('225', 'Tadiaque', 'Arlie', 'Pasgne', 'arlie.tadiaque@gmail.com', DATE '1964-11-20', 'Male', 'Head'),
    ('225', 'Tadiaque', 'Alan Pur', 'Pasgne', 'alan.pur.tadiaque@gmail.com', DATE '1988-11-27', 'Male', 'Child'),
    ('225', 'Tadiaque', 'Jancel', NULL::TEXT, 'jancel.tadiaque@gmail.com', DATE '2002-08-26', 'Male', 'Child'),
    ('225', 'Tadiaque', 'Jack', NULL::TEXT, 'jack.tadiaque@gmail.com', DATE '2004-10-31', 'Male', 'Child'),
    ('225', 'Tadiaque', 'Jeker', NULL::TEXT, 'jeker.tadiaque@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('225', 'Tadiaque', 'Jeger', NULL::TEXT, 'jeger.tadiaque@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('226', 'Tadiaque', 'Jimmy', 'Talha', 'jimmy.tadiaque@gmail.com', DATE '1959-07-18', 'Male', 'Head'),
    ('226', 'Tadiaque', 'Rosina', 'Pelescoso', 'rosina.tadiaque@gmail.com', DATE '1955-04-29', 'Female', 'Spouse'),
    ('226', 'Tadiaque', 'Rihan Jay', 'Pelescoso', 'rihan.jay.tadiaque@gmail.com', DATE '2001-12-10', 'Male', 'Child'),
    ('226', 'Tadiaque', 'Rogine', 'Pelescoso', 'rogine.tadiaque@gmail.com', DATE '2007-05-25', 'Female', 'Child'),
    ('226', 'Tadiaque', 'Nathaniel', NULL::TEXT, 'nathaniel.tadiaque@gmail.com', NULL::DATE, 'Male', 'Child'),
    ('227', 'Tadiaque', 'Jonathan', 'Canat', 'jonathan.tadiaque@gmail.com', DATE '1961-01-24', 'Male', 'Head'),
    ('227', 'Tadiaque', 'Geraldin', 'Caucaran', 'geraldin.tadiaque@gmail.com', DATE '1965-10-23', 'Female', 'Spouse'),
    ('227', 'Tadiaque', 'April Joy', 'Caucaran', 'april.joy.tadiaque@gmail.com', DATE '2001-04-24', 'Female', 'Child'),
    ('227', 'Tadiaque', 'Lady Ann', 'Caucaran', 'lady.ann.tadiaque@gmail.com', DATE '2004-10-27', 'Female', 'Child'),
    ('227', 'Tadiaque', 'Jonathan Jr.', 'Caucaran', 'jonathan.jr.tadiaque@gmail.com', DATE '2011-03-09', 'Male', 'Child'),
    ('228', 'Tadiaque', 'Nita Liz', NULL::TEXT, 'nita.liz.tadiaque@gmail.com', DATE '1962-06-20', 'Female', 'Head'),
    ('229', 'Tadiaque', 'Rommy', 'Talha', 'rommy.tadiaque@gmail.com', DATE '1970-09-02', 'Male', 'Head'),
    ('229', 'Tadiaque', 'Rosabel', 'Capio', 'rosabel.tadiaque@gmail.com', DATE '1968-06-14', 'Female', 'Spouse'),
    ('229', 'Tadiaque', 'Russel Jay', 'Capio', 'russel.jay.tadiaque@gmail.com', DATE '2003-10-16', 'Male', 'Child'),
    ('229', 'Tadiaque', 'Paice Jane', 'Capio', 'paice.jane.tadiaque@gmail.com', DATE '2010-06-02', 'Female', 'Child'),
    ('229', 'Tadiaque', 'Rico Mark', 'Capio', 'rico.mark.tadiaque@gmail.com', DATE '2011-03-14', 'Male', 'Child'),
    ('229', 'Tadiaque', 'Rona Mae', 'Capio', 'rona.mae.tadiaque@gmail.com', DATE '2015-12-20', 'Female', 'Child'),
    ('229', 'Tadiaque', 'Shyra Natalie', 'Capio', 'shyra.natalie.tadiaque@gmail.com', DATE '2022-09-08', 'Female', 'Child'),
    ('230', 'Tadiaque', 'Reneo', 'Talha', 'reneo.tadiaque@gmail.com', DATE '1945-08-26', 'Male', 'Head'),
    ('230', 'Tadiaque', 'Emily', 'Canindino', 'emily.tadiaque@gmail.com', DATE '1950-09-18', 'Female', 'Spouse'),
    ('230', 'Tadiaque', 'Remifel', 'Canindino', 'remifel.tadiaque@gmail.com', DATE '1986-12-09', 'Female', 'Child'),
    ('230', 'Tadiaque', 'Jira Joy', 'Canindino', 'jira.joy.tadiaque@gmail.com', DATE '2006-01-04', 'Female', 'Child'),
    ('230', 'Tadiaque', 'Renzalyn Anne', 'Canindino', 'renzalyn.anne.tadiaque@gmail.com', DATE '2010-02-20', 'Female', 'Child'),
    ('230', 'Tadiaque', 'Lizanie', 'Canindino', 'lizanie.tadiaque@gmail.com', DATE '2012-02-25', 'Female', 'Child'),
    ('230', 'Tadiaque', 'Florence Luel', 'Canindino', 'florence.luel.tadiaque@gmail.com', DATE '2014-03-09', 'Male', 'Child'),
    ('230', 'Tadiaque', 'Jozvela Rose', 'Canindino', 'jozvela.rose.tadiaque@gmail.com', DATE '2018-06-21', 'Female', 'Child'),
    ('231', 'Tadiaque', 'Teresita', 'Talha', 'teresita.tadiaque@gmail.com', DATE '1944-01-28', 'Female', 'Head'),
    ('231', 'Tadiaque', 'Efren', 'Talha', 'efren.tadiaque@gmail.com', DATE '1971-01-17', 'Male', 'Child'),
    ('231', 'Tadiaque', 'Prenivedo', 'Talha', 'prenivedo.tadiaque@gmail.com', DATE '1961-03-04', 'Male', 'Child'),
    ('232', 'Talaman', 'Rodolfo', 'Tacayen', 'rodolfo.talaman@gmail.com', DATE '1948-10-28', 'Male', 'Head'),
    ('232', 'Talaman', 'Florita', 'Tadiague', 'florita.talaman@gmail.com', DATE '1948-10-19', 'Female', 'Spouse'),
    ('233', 'Talaman', 'Dan', 'Cantomator', 'dan.talaman@gmail.com', DATE '1964-10-02', 'Male', 'Head'),
    ('233', 'Talaman', 'Myla', 'Capio', 'myla.talaman@gmail.com', DATE '1964-02-02', 'Female', 'Spouse'),
    ('233', 'Talaman', 'Chene Mark', 'Capio', 'chene.mark.talaman@gmail.com', DATE '2002-11-14', 'Male', 'Child'),
    ('233', 'Talaman', 'Ian Mack', 'Capio', 'ian.mack.talaman@gmail.com', DATE '2005-06-18', 'Male', 'Child'),
    ('233', 'Talaman', 'Honey Grace', 'Capio', 'honey.grace.talaman@gmail.com', DATE '2010-12-15', 'Female', 'Child'),
    ('233', 'Talaman', 'Prince Rejan', 'Capio', 'prince.rejan.talaman@gmail.com', DATE '2014-05-07', 'Male', 'Child'),
    ('234', 'Talaman', 'Jubert', 'Calapiter', 'jubert.talaman@gmail.com', DATE '1982-01-30', 'Male', 'Head'),
    ('234', 'Talaman', 'Gerlyn', 'Tadiague', 'gerlyn.talaman@gmail.com', DATE '1987-09-11', 'Female', 'Spouse'),
    ('234', 'Talaman', 'John Rey Bert', 'Tadiague', 'john.rey.bert.talaman@gmail.com', DATE '2002-03-10', 'Male', 'Child'),
    ('234', 'Talaman', 'Cindy Beth', 'Tadiague', 'cindy.beth.talaman@gmail.com', DATE '2004-08-25', 'Female', 'Child'),
    ('234', 'Talaman', 'Herculf Keith', 'Tadiague', 'herculf.keith.talaman@gmail.com', DATE '2010-12-06', 'Male', 'Child'),
    ('234', 'Talaman', 'Khan Lloyd', 'Tadiague', 'khan.lloyd.talaman@gmail.com', DATE '2012-10-31', 'Male', 'Child'),
    ('234', 'Talaman', 'Jackie Race', 'Tadiague', 'jackie.race.talaman@gmail.com', DATE '2016-05-31', 'Female', 'Child'),
    ('234', 'Talaman', 'Jobert Jr.', 'Tadiague', 'jobert.jr.talaman@gmail.com', DATE '2019-07-07', 'Male', 'Child'),
    ('234', 'Talaman', 'Jierwin', 'Tadiague', 'jierwin.talaman@gmail.com', DATE '2024-04-27', 'Male', 'Child'),
    ('235', 'Talaman', 'Judy', 'Chempo', 'judy.talaman@gmail.com', DATE '1963-03-10', 'Male', 'Head'),
    ('235', 'Talaman', 'Loreda', 'Caucaran', 'loreda.talaman@gmail.com', DATE '1965-01-25', 'Female', 'Spouse'),
    ('235', 'Talaman', 'John Lard', 'Caucaran', 'john.lard.talaman@gmail.com', DATE '2003-01-07', 'Male', 'Child'),
    ('235', 'Talaman', 'Vini Mark', 'Caucaran', 'vini.mark.talaman@gmail.com', DATE '2006-04-22', 'Male', 'Child'),
    ('235', 'Talaman', 'Judy Jr.', 'Caucaran', 'judy.jr.talaman@gmail.com', DATE '2011-04-21', 'Male', 'Child'),
    ('235', 'Talaman', 'Judy Lyn', 'Caucaran', 'judy.lyn.talaman@gmail.com', NULL::DATE, 'Female', 'Child'),
    ('236', 'Talaman', 'Richard', 'Tadiague', 'richard.talaman@gmail.com', DATE '1959-12-12', 'Male', 'Head'),
    ('236', 'Talaman', 'Novena', 'Catama', 'novena.talaman@gmail.com', DATE '1979-11-25', 'Female', 'Spouse'),
    ('236', 'Talaman', 'Bea Trisba', 'Catama', 'bea.trisba.talaman@gmail.com', DATE '2001-06-23', 'Female', 'Child'),
    ('236', 'Talaman', 'Kacy Steve', 'Catama', 'kacy.steve.talaman@gmail.com', DATE '2012-03-31', 'Male', 'Child'),
    ('237', 'Matanon', 'Larry', 'Amparo', 'larry.matanon@gmail.com', DATE '1973-08-20', 'Male', 'Head'),
    ('237', 'Matanon', 'Aida', 'Cabana', 'aida.matanon@gmail.com', DATE '1978-02-27', 'Female', 'Spouse'),
    ('237', 'Matanon', 'Deyfer Jay', 'Cabana', 'deyfer.jay.matanon@gmail.com', DATE '1997-03-27', 'Male', 'Child'),
    ('237', 'Matanon', 'Princess Aila', 'Cabana', 'princess.aila.matanon@gmail.com', DATE '2001-05-01', 'Female', 'Child'),
    ('237', 'Matanon', 'Allen Jay', 'Cabana', 'allen.jay.matanon@gmail.com', DATE '2005-10-23', 'Male', 'Child'),
    ('237', 'Matanon', 'Ipan Fretz', 'Cabana', 'ipan.fretz.matanon@gmail.com', DATE '2013-01-12', 'Male', 'Child')
),
seed AS (
  SELECT
    number_value AS house_no,
    number_value AS household_no,
    CONCAT_WS(' ', first_name, middle_name, last_name) AS full_name,
    last_name,
    first_name,
    middle_name,
    email,
    birthday,
    sex,
    sex AS gender,
    NULL::INTEGER AS age,
    NULL::TEXT AS phone,
    relationship_to_household_head,
    NULL::TEXT AS birthplace,
    NULL::TEXT AS educational_attainment,
    NULL::TEXT AS occupation,
    FALSE AS is_4ps_member,
    FALSE AS is_solo_parent,
    NULL::TEXT AS civil_status,
    FALSE AS is_pwd,
    NULL::TEXT AS pwd_type,
    'Payhod'::TEXT AS purok,
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
      birthday = COALESCE(seed.birthday, resident.birthday),
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
