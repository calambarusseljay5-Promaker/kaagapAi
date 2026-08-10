-- Run this in Supabase SQL Editor if resident login says residents.email is missing.
ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.residents
ADD COLUMN IF NOT EXISTS house_no TEXT;

CREATE INDEX IF NOT EXISTS idx_residents_email ON public.residents(email);

NOTIFY pgrst, 'reload schema';
