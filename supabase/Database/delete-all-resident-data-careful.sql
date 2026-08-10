-- Delete all resident data carefully.
-- Run this manually in Supabase SQL Editor only after you have a backup/export.
--
-- This removes:
-- - public.residents
-- - resident document requests
-- - resident notifications
-- - public.user_profiles rows for resident accounts
-- - profile-photos storage objects that belong to resident user profile IDs
--
-- This preserves:
-- - admin user_profiles
-- - document templates
-- - livelihood posts
-- - announcements
-- - AI knowledge
-- - system/table structure and policies
--
-- Supabase Auth users are NOT deleted by default. See the optional block below.

-- 1) Preview what will be affected.
SELECT 'residents' AS item, COUNT(*) AS total
FROM public.residents
UNION ALL
SELECT 'document_requests', COUNT(*)
FROM public.document_requests
UNION ALL
SELECT 'resident_notifications', COUNT(*)
FROM public.resident_notifications
UNION ALL
SELECT 'resident user_profiles', COUNT(*)
FROM public.user_profiles
WHERE role = 'resident' OR resident_id IS NOT NULL
UNION ALL
SELECT 'resident profile photos', COUNT(*)
FROM storage.objects
WHERE bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::TEXT
    FROM public.user_profiles
    WHERE role = 'resident' OR resident_id IS NOT NULL
  );

-- Optional: inspect foreign keys that point to residents before deleting.
SELECT
  conrelid::REGCLASS AS referencing_table,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid = 'public.residents'::REGCLASS
ORDER BY referencing_table::TEXT, constraint_name;

-- 2) Test-delete resident data.
-- Safety default: this transaction ends with ROLLBACK, so running the whole file
-- will NOT permanently delete anything. After you review the remaining counts,
-- change the final ROLLBACK to COMMIT and run this section again.
BEGIN;

CREATE TEMP TABLE target_resident_profiles ON COMMIT DROP AS
SELECT id
FROM public.user_profiles
WHERE role = 'resident' OR resident_id IS NOT NULL;

CREATE TEMP TABLE target_resident_auth_users ON COMMIT DROP AS
SELECT auth_users.id
FROM auth.users AS auth_users
JOIN target_resident_profiles AS target_profiles
  ON target_profiles.id = auth_users.id;

DELETE FROM storage.objects
WHERE bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::TEXT
    FROM target_resident_profiles
  );

DELETE FROM public.resident_notifications;
DELETE FROM public.document_requests;

DELETE FROM public.user_profiles
WHERE id IN (
  SELECT id
  FROM target_resident_profiles
);

DELETE FROM public.residents;

-- Optional auth cleanup:
-- Uncomment this only if you also want to remove resident accounts from
-- Supabase Authentication. Leave it commented if you want to keep login users.
--
-- DELETE FROM auth.users
-- WHERE id IN (
--   SELECT id
--   FROM target_resident_auth_users
-- );

NOTIFY pgrst, 'reload schema';

-- 3) Confirm the cleanup before deciding to commit.
SELECT 'residents remaining' AS item, COUNT(*) AS total
FROM public.residents
UNION ALL
SELECT 'document_requests remaining', COUNT(*)
FROM public.document_requests
UNION ALL
SELECT 'resident_notifications remaining', COUNT(*)
FROM public.resident_notifications
UNION ALL
SELECT 'resident user_profiles remaining', COUNT(*)
FROM public.user_profiles
WHERE role = 'resident' OR resident_id IS NOT NULL;

-- Change this to COMMIT only when you are sure.
ROLLBACK;
