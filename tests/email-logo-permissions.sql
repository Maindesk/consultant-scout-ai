-- Regression: authorize the caller against the workspace folder for every logo
-- operation. Run against the database; passed must be true.
SELECT count(*) = 3
  AND bool_and(roles = ARRAY['authenticated']::name[])
  AND bool_and(CASE WHEN cmd IN ('SELECT', 'UPDATE') THEN
    qual LIKE '%bucket_id = ''email-logos''%'
    AND qual LIKE '%is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)%'
    ELSE true END)
  AND bool_and(CASE WHEN cmd IN ('INSERT', 'UPDATE') THEN
    with_check LIKE '%bucket_id = ''email-logos''%'
    AND with_check LIKE '%is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)%'
    ELSE true END) AS passed
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN ('Members read email logos', 'Members upload email logos', 'Members update email logos');