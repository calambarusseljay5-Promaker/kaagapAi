-- Read-only audit for resident Purok values and household totals.
-- Run in Supabase SQL Editor to see which records are inside the listed Puroks
-- and which records still have blank, old, or misspelled Purok values.

WITH classified AS (
  SELECT
    id,
    COALESCE(NULLIF(TRIM(status::text), ''), 'Active') AS status,
    NULLIF(TRIM(purok::text), '') AS raw_purok,
    NULLIF(TRIM(COALESCE(household_no::text, house_no::text, '')), '') AS household_key,
    CASE
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') = 'kamonsil' THEN 'Kamonsil'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') = 'payhod' THEN 'Payhod'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') IN ('muslim', 'purokmuslim') THEN 'Muslim'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') = 'malipayon' THEN 'Malipayon'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') IN (
        'purok3',
        'purok3uppermingadingaleosancotabato'
      ) THEN 'Purok-3'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') IN (
        'buklod',
        'purokbuklod',
        'purokbukloduppermingadingaleosancotabato'
      ) THEN 'Buklod'
      ELSE 'Not in listed Puroks'
    END AS display_purok
  FROM public.residents
  WHERE COALESCE(status::text, 'Active') <> 'Archived'
),
summary AS (
  SELECT
    display_purok,
    COUNT(*) AS residents,
    COUNT(DISTINCT household_key) FILTER (WHERE household_key IS NOT NULL) AS households,
    STRING_AGG(DISTINCT COALESCE(raw_purok, '(blank)'), ', ' ORDER BY COALESCE(raw_purok, '(blank)')) AS raw_values
  FROM classified
  GROUP BY display_purok
)
SELECT
  display_purok,
  residents,
  households,
  raw_values
FROM summary
ORDER BY CASE display_purok
  WHEN 'Kamonsil' THEN 1
  WHEN 'Payhod' THEN 2
  WHEN 'Muslim' THEN 3
  WHEN 'Malipayon' THEN 4
  WHEN 'Purok-3' THEN 5
  WHEN 'Buklod' THEN 6
  ELSE 7
END;

-- Detail for the records that are not being counted under the listed Puroks.
WITH classified AS (
  SELECT
    NULLIF(TRIM(purok::text), '') AS raw_purok,
    NULLIF(TRIM(COALESCE(household_no::text, house_no::text, '')), '') AS household_key,
    CASE
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') = 'kamonsil' THEN 'Kamonsil'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') = 'payhod' THEN 'Payhod'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') IN ('muslim', 'purokmuslim') THEN 'Muslim'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') = 'malipayon' THEN 'Malipayon'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') IN (
        'purok3',
        'purok3uppermingadingaleosancotabato'
      ) THEN 'Purok-3'
      WHEN regexp_replace(LOWER(COALESCE(purok::text, '')), '[^a-z0-9]', '', 'g') IN (
        'buklod',
        'purokbuklod',
        'purokbukloduppermingadingaleosancotabato'
      ) THEN 'Buklod'
      ELSE 'Not in listed Puroks'
    END AS display_purok
  FROM public.residents
  WHERE COALESCE(status::text, 'Active') <> 'Archived'
)
SELECT
  COALESCE(raw_purok, '(blank)') AS raw_purok,
  COUNT(*) AS residents,
  COUNT(DISTINCT household_key) FILTER (WHERE household_key IS NOT NULL) AS households
FROM classified
WHERE display_purok = 'Not in listed Puroks'
GROUP BY COALESCE(raw_purok, '(blank)')
ORDER BY residents DESC, raw_purok;
