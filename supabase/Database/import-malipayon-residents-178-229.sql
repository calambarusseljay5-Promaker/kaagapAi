-- Import continued Malipayon resident records 178-229 into public.residents.
-- Run this in the Supabase SQL Editor after import-malipayon-residents-122-177.sql.
-- Household number is kept from the list: same number means one household/family.
-- All rows use address Upper Mingading, Aleosan, Cotabato and purok Malipayon.
-- Relationship is assigned per household order: 1st Head, 2nd Spouse, rest Sibling.
-- 4PS and PWD checkmarks are saved to boolean fields.
-- Senior is derived by the app from birthday/age; there is no separate senior column.
-- Missing birthday values are imported as NULL:
-- - Walter Jr. Cabaya Cagape
-- - Evelyn Calambro Calambro
-- - Geian Rey Benedicto Capilitan
-- - Ichrian Jeri Benedicto Capilitan
-- - Dyren Cambel
-- - Ian Aldamar Andea
-- - Richey Angulo
-- - Leny Calambro Angulo

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

WITH raw_lines AS (
  SELECT source_order,
         line
  FROM regexp_split_to_table($resident_rows$
178	CATANUS	Jonathan	Tuala	05-17-70	M		jonathan.catanus@gmail.com
178	CATANUS	Jean	Campollo	10-05-72	F		jean.catanus@gmail.com
178	CATANUS	Blezy Mercy Thu	Campollo	10-31-10	F		blezy.mercy.catanus@gmail.com
179	CALAPATE	Johar	Carey	07-27-05	M		johar.calapate@gmail.com
180	TALAMAN	Mikylla	Cajeben	02-27-06	F		mikylla.talaman@gmail.com
180	TALAMAN	Joannah Mikee	Talaman	11-14-21	F		joannah.mikee.talaman@gmail.com
181	CATANUS	Rodrigo	Calicaran	07-10-47	M	4PS	rodrigo.catanus@gmail.com
181	CATANUS	Felicidad	Tuala	11-26-51	F	4PS	felicidad.catanus@gmail.com
181	CATANUS	Renante	Tuala	06-06-74	M		renante.catanus@gmail.com
181	CATANUS	Prince Jhon		09-14-09	M		prince.jhon.catanus@gmail.com
182	OYAO	Dorothy	Clarito	01-19-71	F		dorothy.oyao@gmail.com
182	OYAO	Quary Ann	Clarito	06-25-99	F		quary.ann.oyao@gmail.com
182	OYAO	Shany Kay	Clarito	06-04-01	F	Senior	shany.kay.oyao@gmail.com
182	OYAO	Sheala Mae	Clarito	05-22-03	F		sheala.mae.oyao@gmail.com
182	OYAO	Shannah Faye	Clarito	07-18-11	F		shannah.faye.oyao@gmail.com
183	HIPONIA	Arnold	Eusala	10-26-77	M	4PS	arnold.hiponia@gmail.com
183	HIPONIA	Mary Ann	Catanus	03-08-79	F		mary.ann.hiponia@gmail.com
183	HIPONIA	Allen James	Catanus	01-09-04	M		allen.james.hiponia@gmail.com
183	HIPONIA	Aldred John	Catanus	04-27-06	M		aldred.john.hiponia@gmail.com
183	HIPONIA	Ana Marie	Catanus	07-01-09	F		ana.marie.hiponia@gmail.com
183	HIPONIA	Arian Jane	Catanus	06-09-11	F		arian.jane.hiponia@gmail.com
183	HIPONIA	Alyza	Catanus	11-16-13	F		alyza.hiponia@gmail.com
184	TALAMAN	Robert	Clarito	03-10-87	M		robert.talaman@gmail.com
184	TALAMAN	Joylyn	Mazo	08-02-99	F		joylyn.talaman@gmail.com
184	TALAMAN	Kent Yst	Mazo	12-16-17	M		kent.yst.talaman@gmail.com
185	TALAMAN	Licardo	Cabaya	04-20-72	M	4PS	licardo.talaman@gmail.com
185	TALAMAN	Merly	Calamba	07-26-73	F		merly.talaman@gmail.com
185	TALAMAN	Ryan	Calamba	02-12-02	M		ryan.talaman@gmail.com
186	TALAMAN	Dagwido	Cabaya	12-09-69	M	4PS / Senior	dagwido.talaman@gmail.com
187	TRIBOLINA	Wilfredo Jr.	Campollo	04-01-76	M		wilfredo.jr.tribolina@gmail.com
187	TRIBOLINA	Felisa	Tanap	02-21-80	F		felisa.tribolina@gmail.com
187	TRIBOLINA	Wilfredo III	Tanap	12-17-08	M		wilfredo.iii.tribolina@gmail.com
187	TRIBOLINA	Philean Marie	Tanap	07-02-15	F		philean.marie.tribolina@gmail.com
188	TALAMAN	Rizalde	Cagape	04-25-84	M	4PS	rizalde.talaman@gmail.com
188	TALAMAN	Jacel	Campos	02-18-91	F		jacel.talaman@gmail.com
188	TALAMAN	Rizcel	Campos	03-28-10	F		rizcel.talaman@gmail.com
188	TALAMAN	Jerick	Campos	08-26-11	M		jerick.talaman@gmail.com
189	TANAP	Julie	Cajeben	09-30-55	F	4PS	julie.tanap@gmail.com
189	TANAP	Eufrasina	Cajeben	01-01-55	F		eufrasina.tanap@gmail.com
189	TANAP	Cesar	Cajeben	11-03-76	M		cesar.tanap@gmail.com
189	TANAP	Zaldy	Cajeben	09-17-88	M		zaldy.tanap@gmail.com
189	TANAP	Richard	Cajeben	11-08-89	M		richard.tanap@gmail.com
190	TALAMAN	Juanito	Cagape	09-28-80	M	4PS	juanito.talaman@gmail.com
190	TALAMAN	Cherry Mae	Cajeben	04-13-82	F		cherry.mae.talaman@gmail.com
190	TALAMAN	Jhon Rhey	Cajeben	11-05-07	M		jhon.rhey.talaman@gmail.com
190	TALAMAN	Jhon Louie	Cajeben	11-19-12	M		jhon.louie.talaman@gmail.com
191	TALAMAN	Alberto	Cabaya	04-26-57	M	4PS / Senior	alberto.talaman@gmail.com
192	TALAMAN	Jhon Michel	Cajeben	10-04-04	M		jhon.michel.talaman@gmail.com
192	CONTENAYO	Charity	Caballero	01-19-05	F		charity.contenayo@gmail.com
192	CONTENAYO	Jhon Marleigh	Cantomayor	12-21-23	M		jhon.marleigh.contenayo@gmail.com
193	TALAMAN	Warlito	Cabaya	02-04-61	M	4PS / Senior	warlito.talaman@gmail.com
193	TALAMAN	Gina	Clarito	01-03-63	F		gina.talaman@gmail.com
193	TALAMAN	Marisa	Clarito	12-14-99	F		marisa.talaman@gmail.com
194	CAPILITAN	Danny	Calawigan	04-11-67	M		danny.capilitan@gmail.com
195	TONGYAEN	Valiant		06-20-87	M		valiant.tongyaen@gmail.com	Province
196	TRANCO	Christopher	Corre	09-28-74	M		christopher.tranco@gmail.com	Bohol
196	TRANCO	Rubilyn	Balsamo	07-26-76	F		rubilyn.tranco@gmail.com	U.M.P
196	TRANCO	Chrystopher	Balsamo	01-20-01	M		chrystopher.tranco@gmail.com	DDH
196	TRANCO	Chrysghyr	Balsamo	04-09-08	M		chrysghyr.tranco@gmail.com	DDH
196	TRANCO	Ruby Christopher Lyn	Balsamo	03-21-10	F		ruby.christopher.tranco@gmail.com	DDH
196	TRANCO	Rubilyn Christopher	Balsamo	12-02-12	F		rubilyn.christopher.tranco@gmail.com	DDH
197	TELLERO	Timothy	Cavange	04-28-77	M		timothy.tellero@gmail.com
198	TELLERO	Ray	Conoras	08-17-74	M		ray.tellero@gmail.com
198	TELLERO	Lenie	Cantero	07-20-79	F		lenie.tellero@gmail.com
198	TELLERO	Rizcell	Cantero	04-06-98	F		rizcell.tellero@gmail.com
198	TELLERO	Cybele	Cantero	10-05-02	F		cybele.tellero@gmail.com
198	TELLERO	Caryl	Cantero	08-01-04	F		caryl.tellero@gmail.com
199	TIUMBONG	Arvie	Camatac	10-13-77	M	4PS	arvie.tiumbong@gmail.com
199	TIUMBONG	Wilfreda	Cagape	12-22-75	F		wilfreda.tiumbong@gmail.com
199	TIUMBONG	Quinie	Cagape	02-22-03	F		quinie.tiumbong@gmail.com
199	TIUMBONG	Beverly	Cagape	12-01-04	F		beverly.tiumbong@gmail.com
199	TIUMBONG	Jonathan	Cagape	11-28-07	M		jonathan.tiumbong@gmail.com
200	CAGAPE	Walter Jr.	Cabaya		M	Senior	walter.jr.cagape@gmail.com
201	SELLERO	Melcy	Cabrestante	01-05-51	M	4PS / Senior	melcy.sellero@gmail.com
201	SELLERO	Nena	Cajeleg	04-01-64	F		nena.sellero@gmail.com
201	SELLERO	Melchor	Cajeleg	02-16-89	M		melchor.sellero@gmail.com
201	SELLERO	Joemel	Cajeleg	07-22-95	M		joemel.sellero@gmail.com
201	SELLERO	Nielbert	Cajeleg	10-14-02	M		nielbert.sellero@gmail.com
201	SELLERO	Amelyn	Cajeleg	04-02-97	F		amelyn.sellero@gmail.com
202	ENGLERO	Roland	Masil	06-24-80	M	4PS	roland.englero@gmail.com
202	ENGLERO	Aivin	Catanus	06-18-89	F		aivin.englero@gmail.com
202	ENGLERO	Muzalim	Catanus	04-04-14	M		muzalim.englero@gmail.com
202	ENGLERO	Abdulah	Catanus	02-26-12	M		abdulah.englero@gmail.com
203	SILBINO	Joel	Camporedondo	10-30-74	M		joel.silbino@gmail.com
203	SILBINO	Shierna	Villamor	06-10-72	F		shierna.silbino@gmail.com
203	SILBINO	Joeshierry Jose	Villamor	09-11-97	M		joeshierry.jose.silbino@gmail.com
203	SILBINO	Joushierly Faith	Villamor	01-22-02	F		joushierly.faith.silbino@gmail.com
203	SILBINO	Thierryne Jijhe	Villamor	06-02-04	M		thierryne.jijhe.silbino@gmail.com
204	CAUNOY	Conrado Jr.	Acasta	06-08-81	M	4PS	conrado.jr.caunoy@gmail.com
204	CAUNOY	Marites	Tanap	09-20-87	F		marites.caunoy@gmail.com
204	CAUNOY	Maricel	Tanap	09-14-08	F		maricel.caunoy@gmail.com
204	CAUNOY	Aldred	Tanap	04-02-11	M		aldred.caunoy@gmail.com
204	CAUNOY	Aldren	Tanap	04-02-11	M		aldren.caunoy@gmail.com
204	CAUNOY	Aica Kate	Tanap	01-31-15	F		aica.kate.caunoy@gmail.com
205	ROARING	George F	Sailing	11-06-74	M		george.f.roaring@gmail.com
205	ROARING	Sally	Tanap	04-07-79	F		sally.roaring@gmail.com
205	ROARING	Jissel	Tanap	10-24-01	F		jissel.roaring@gmail.com
205	ROARING	Jorren May	Tanap	07-04-12	F		jorren.may.roaring@gmail.com
206	CLARITO	Wilfredo Jr.	Telloro	02-04-62	M		wilfredo.jr.clarito@gmail.com
206	CLARITO	Cesar John Lloyd	Porcon	02-17-04	M		cesar.john.lloyd.clarito@gmail.com
207	BORCOLCOL	Erich Richard	Capilitan	12-30-84	M		erich.richard.borcolcol@gmail.com
208	CALAMBRO	Zenaida	Amorsolo	01-20-56	F	Senior	zenaida.calambro@gmail.com
208	CALAMBRO	Evelyn	Calambro		F		evelyn.calambro@gmail.com
208	CALAMBRO	Creny	Calambro	01-23-00	F		creny.calambro@gmail.com
208	CALAMBRO	Carlo	Calambro	01-09-04	M		carlo.calambro@gmail.com
209	CABALLERO	Maricto Jr.	Cabilitacan	09-18-82	M	4PS	maricto.jr.caballero@gmail.com
209	CABALLERO	Mongie	Malinda	09-29-89	F		mongie.caballero@gmail.com
209	CABALLERO	Glydel Joy	Malinda	01-11-07	F		glydel.joy.caballero@gmail.com
209	CABALLERO	Angel	Malinda	11-06-08	F		angel.caballero@gmail.com
209	CABALLERO	Monica May	Malinda	05-07-11	F		monica.may.caballero@gmail.com
209	CABALLERO	John Philip	Malinda	02-18-13	M		john.philip.caballero@gmail.com
210	CAMANCHO	Jun Mark	Andres	01-29-94	M		jun.mark.camancho@gmail.com
210	CAMANCHO	Jessa Mae	Canique	02-15-98	F		jessa.mae.camancho@gmail.com
210	CAMANCHO	Jhenny Rose	Canique	12-15-17	F		jhenny.rose.camancho@gmail.com
210	CAMANCHO	Teosico	Canique	06-04-19	F		teosico.camancho@gmail.com
211	SONELO	Ritchell	Calinawagan	08-05-80	M	4PS	ritchell.sonelo@gmail.com
211	SONELO	Regina	Camancho	09-22-84	F		regina.sonelo@gmail.com
211	SONELO	Leuna Marie	Camancho	01-17-01	F		leuna.marie.sonelo@gmail.com
211	SONELO	Reyland Clyd	Camancho	02-05-06	M		reyland.clyd.sonelo@gmail.com
212	MALLO	Romeo	Montas	02-17-81	M	4PS	romeo.mallo@gmail.com
212	MALLO	Arlene	Caballero	07-05-80	F		arlene.mallo@gmail.com
212	MALLO	Royalene	Caballero	01-13-05	F		royalene.mallo@gmail.com
212	MALLO	Rohselyn	Caballero	09-21-07	F		rohselyn.mallo@gmail.com
212	MALLO	Ronel Jay	Caballero	07-08-13	M		ronel.jay.mallo@gmail.com
212	MALLO	Rhasel Kent	Caballero	12-23-16	M		rhasel.kent.mallo@gmail.com
213	SAONOY	Renante Sr.	Acosta	09-12-75	M	4PS	renante.sr.saonoy@gmail.com
213	SAONOY	Darlene	Capilitan	03-09-73	F	Senior	darlene.saonoy@gmail.com
213	SAONOY	John Mark	Capilitan	05-22-03	M		john.mark.saonoy@gmail.com
213	SAONOY	Novie Jean	Capilitan	11-02-04	F		novie.jean.saonoy@gmail.com
213	SAONOY	Norlyn	Capilitan	11-01-07	F		norlyn.saonoy@gmail.com
213	SAONOY	Renalyn Mae	Capilitan	05-23-10	F		renalyn.mae.saonoy@gmail.com
213	SAONOY	Renante Jr.	Capilitan	12-13-11	M		renante.jr.saonoy@gmail.com
213	SAONOY	Raymond	Capilitan	07-06-17	M		raymond.saonoy@gmail.com
214	CALAMBRO	Lino	Amorsolo	05-25-87	M		lino.calambro@gmail.com
215	CATANUS	Cherrylyn	Catanus	04-04-83	F		cherrylyn.catanus@gmail.com
215	TAYONG	Danny	Tunga	03-14-97	M		danny.tayong@gmail.com
215	TAYONG	Hacob	Capilitan	03-14-19	M		hacob.tayong@gmail.com
216	DUMALOK	Rolando	Licayan	01-10-73	M	4PS	rolando.dumalok@gmail.com
216	DUMALOK	Yolanda	Catanus	09-01-74	F		yolanda.dumalok@gmail.com
216	DUMALOK	Ronan	Catanus	09-01-14	M		ronan.dumalok@gmail.com
217	CAPILITAN	Demark	Talaman	08-13-93	M		demark.capilitan@gmail.com
217	CAPILITAN	Genevieve	Benedicto	06-04-93	F		genevieve.capilitan@gmail.com
217	CAPILITAN	Geian Rey	Benedicto		M		geian.rey.capilitan@gmail.com
217	CAPILITAN	Ichrian Jeri	Benedicto		F		ichrian.jeri.capilitan@gmail.com
218	TELOS RYES	Rodrigo	Gasper	01-31-73	M		rodrigo.telos.ryes@gmail.com
218	TELOS RYES	Lovelyn	Catanus	02-07-78	F		lovelyn.telos.ryes@gmail.com
218	TELOS RYES	Rico Jiun	Catanus	05-28-01	M		rico.jiun.telos.ryes@gmail.com
218	TELOS RYES	Jeyric	Catanus	10-07-02	M		jeyric.telos.ryes@gmail.com
218	TELOS RYES	Rica Jean	Catanus	04-05-05	F		rica.jean.telos.ryes@gmail.com
218	TELOS RYES	Picalyn	Catanus	01-18-08	F		picalyn.telos.ryes@gmail.com
218	TELOS RYES	Ryan Lloyd	Catanus	10-22-09	M		ryan.lloyd.telos.ryes@gmail.com
218	TELOS RYES	April Jone	Catanus	04-28-15	F		april.jone.telos.ryes@gmail.com
219	TALAMAN	Rey	Clarito	02-18-85	M		rey.talaman@gmail.com	OFW
219	TALAMAN	Loredil	Anterero	05-04-87	F		loredil.talaman@gmail.com
219	TALAMAN	Laurence	Anterero	07-03-08	M		laurence.talaman@gmail.com
219	TALAMAN	Lorenjoy	Anterero	07-07-12	F		lorenjoy.talaman@gmail.com
219	TALAMAN	Ellamae	Anterero	11-16-18	F		ellamae.talaman@gmail.com
220	CABANA	Jackelyn	Capilitan	01-15-87	F		jackelyn.cabana@gmail.com
220	CUERPO	Mark Anthony		12-23-90	M		mark.anthony.cuerpo@gmail.com
220	CUERPO	Kiora Marie		01-18-24	F		kiora.marie.cuerpo@gmail.com
220	CUERPO	Khylianna		05-20-18	F		khylianna.cuerpo@gmail.com
221	CAMBEL	Ma. Victoria	Cabana	08-13-56	F	4PS / Senior	ma.victoria.cambel@gmail.com
221	CAMBEL	Dyren			M		dyren.cambel@gmail.com
222	CAMPONO	Dominador		08-29-98	M		dominador.campono@gmail.com
222	CABANA	Christine Grace	Capilitan	07-04-91	F		christine.grace.cabana@gmail.com
222	CABANA	Christian James		12-17-14	M		christian.james.cabana@gmail.com
222	CAMPONO	Sofia Kaye	Cabana	12-15-22	F		sofia.kaye.campono@gmail.com
223	CABANA	Michael Jay	Capilitan	03-30-93	M		michael.jay.cabana@gmail.com
223	TAHAN	Almera	Sanillano	08-14-01	F		almera.tahan@gmail.com
223	CABANA	Xtian	Sanillano	04-14-22	M		xtian.cabana@gmail.com
224	CABANIG	Joel	Catanus	02-06-84	M		joel.cabanig@gmail.com
225	TELLERO	Jones	Cabrestante	09-08-55	M	4PS	jones.tellero@gmail.com
226	CLARITO	Sofia	Catanus	01-28-48	F	Senior	sofia.clarito@gmail.com
227	CAMANCHO	Danilo	Andres	11-04-72	M	4PS	danilo.camancho@gmail.com
227	CAMANCHO	Jenny Ann	Catanus	04-01-05	F		jenny.ann.camancho@gmail.com
227	CAMANCHO	John Mark	Catanus	10-11-07	M		john.mark.camancho@gmail.com
228	ANDEA	Ian	Aldamar		M		ian.andea@gmail.com
229	ANGULO	Richey			M		richey.angulo@gmail.com
229	ANGULO	Leny	Calambro		F		leny.angulo@gmail.com
$resident_rows$, E'\n') WITH ORDINALITY AS raw_line(line, source_order)
  WHERE TRIM(line) <> ''
),
parsed_rows AS (
  SELECT
    source_order,
    NULLIF(TRIM(SPLIT_PART(line, E'\t', 1)), '') AS number_value,
    INITCAP(LOWER(NULLIF(TRIM(SPLIT_PART(line, E'\t', 2)), ''))) AS last_name,
    NULLIF(TRIM(SPLIT_PART(line, E'\t', 3)), '') AS first_name,
    NULLIF(TRIM(SPLIT_PART(line, E'\t', 4)), '') AS middle_name,
    NULLIF(TRIM(SPLIT_PART(line, E'\t', 5)), '') AS birth_date_text,
    CASE UPPER(NULLIF(TRIM(SPLIT_PART(line, E'\t', 6)), ''))
      WHEN 'F' THEN 'Female'
      ELSE 'Male'
    END AS sex,
    NULLIF(TRIM(SPLIT_PART(line, E'\t', 7)), '') AS flags,
    LOWER(NULLIF(TRIM(SPLIT_PART(line, E'\t', 8)), '')) AS email,
    NULLIF(TRIM(SPLIT_PART(line, E'\t', 9)), '') AS birthplace
  FROM raw_lines
),
date_parts AS (
  SELECT
    parsed_rows.*,
    regexp_match(birth_date_text, '^(\d{1,2})-(\d{1,2})-(\d{2})$') AS birth_parts
  FROM parsed_rows
),
resident_seed AS (
  SELECT
    source_order,
    number_value,
    CONCAT_WS(' ', first_name, middle_name, last_name) AS full_name,
    last_name,
    first_name,
    middle_name,
    email,
    CASE
      WHEN birth_parts IS NOT NULL
           AND (birth_parts)[1]::INTEGER BETWEEN 1 AND 12
           AND (birth_parts)[2]::INTEGER BETWEEN 1 AND 31
      THEN MAKE_DATE(
        CASE
          WHEN COALESCE(flags, '') ILIKE '%Senior%' OR (birth_parts)[3]::INTEGER >= 27
          THEN 1900 + (birth_parts)[3]::INTEGER
          ELSE 2000 + (birth_parts)[3]::INTEGER
        END,
        (birth_parts)[1]::INTEGER,
        (birth_parts)[2]::INTEGER
      )
      ELSE NULL::DATE
    END AS birthday,
    sex,
    COALESCE(flags, '') ILIKE '%4PS%' AS is_4ps_member,
    COALESCE(flags, '') ILIKE '%PWD%' AS is_pwd,
    birthplace
  FROM date_parts
),
positioned_seed AS (
  SELECT
    resident_seed.*,
    ROW_NUMBER() OVER (PARTITION BY number_value ORDER BY source_order) AS household_position
  FROM resident_seed
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
    CASE household_position
      WHEN 1 THEN 'Head'
      WHEN 2 THEN 'Spouse'
      ELSE 'Sibling'
    END AS relationship_to_household_head,
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
  FROM positioned_seed
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
