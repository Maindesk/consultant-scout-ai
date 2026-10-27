ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS email_branding jsonb;
CREATE POLICY "Members upload email logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-logos' AND public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Members update email logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'email-logos' AND public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid()));