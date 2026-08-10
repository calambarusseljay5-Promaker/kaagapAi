-- Add complete resident profile and household fields.
-- Run this in Supabase SQL Editor if setup-supabase.sql was already run before
-- these fields were added.

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS last_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS middle_name TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS birthday DATE;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS sex TEXT;

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
ADD COLUMN IF NOT EXISTS household_no TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS relationship_to_household_head TEXT;

UPDATE public.residents
SET sex = COALESCE(sex, gender),
    gender = COALESCE(gender, sex),
    is_4ps_member = COALESCE(is_4ps_member, FALSE),
    is_solo_parent = COALESCE(is_solo_parent, FALSE)
WHERE sex IS NULL
   OR gender IS NULL
   OR is_4ps_member IS NULL
   OR is_solo_parent IS NULL;

CREATE INDEX IF NOT EXISTS idx_residents_last_name ON public.residents(last_name);
CREATE INDEX IF NOT EXISTS idx_residents_first_name ON public.residents(first_name);
CREATE INDEX IF NOT EXISTS idx_residents_birthday ON public.residents(birthday);
CREATE INDEX IF NOT EXISTS idx_residents_sex ON public.residents(sex);
CREATE INDEX IF NOT EXISTS idx_residents_household_no ON public.residents(household_no);
CREATE INDEX IF NOT EXISTS idx_residents_household_relationship ON public.residents(relationship_to_household_head);
CREATE INDEX IF NOT EXISTS idx_residents_civil_status ON public.residents(civil_status);
CREATE INDEX IF NOT EXISTS idx_residents_4ps ON public.residents(is_4ps_member);
CREATE INDEX IF NOT EXISTS idx_residents_solo_parent ON public.residents(is_solo_parent);

NOTIFY pgrst, 'reload schema';
