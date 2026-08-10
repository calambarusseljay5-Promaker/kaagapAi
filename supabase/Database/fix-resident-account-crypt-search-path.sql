-- Fix resident login error:
--   function crypt(text, text) does not exist
--
-- Supabase commonly installs pgcrypto functions in the "extensions" schema.
-- The resident account RPC functions use SECURITY DEFINER with search_path=public,
-- so password verification cannot find crypt/gen_salt unless extensions is included.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  target_function REGPROCEDURE;
  target_functions REGPROCEDURE[] := ARRAY[
    to_regprocedure('public.login_resident_account(text,text)'),
    to_regprocedure('public.update_resident_account_credentials(text,text,text,text)'),
    to_regprocedure('public.request_resident_profile_update(uuid,text,text,text,jsonb)'),
    to_regprocedure('public.approve_resident_activation_request(uuid)')
  ];
BEGIN
  FOREACH target_function IN ARRAY target_functions
  LOOP
    IF target_function IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', target_function);
    END IF;
  END LOOP;
END
$$;

SELECT
  extname AS extension_name,
  extnamespace::regnamespace::TEXT AS extension_schema
FROM pg_extension
WHERE extname = 'pgcrypto';

SELECT
  to_regprocedure('public.login_resident_account(text,text)') IS NOT NULL AS resident_login_rpc_found;

NOTIFY pgrst, 'reload schema';
