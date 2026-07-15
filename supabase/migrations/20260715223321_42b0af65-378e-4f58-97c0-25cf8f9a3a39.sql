
ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS auto_provision_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_insert_sso_in_email3 boolean NOT NULL DEFAULT false;
