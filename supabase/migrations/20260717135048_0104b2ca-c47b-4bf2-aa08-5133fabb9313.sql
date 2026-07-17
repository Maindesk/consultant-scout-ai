
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS email_provider text,
  ADD COLUMN IF NOT EXISTS email_api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS email_from_domain text,
  ADD COLUMN IF NOT EXISTS email_from_email text,
  ADD COLUMN IF NOT EXISTS email_from_name text,
  ADD COLUMN IF NOT EXISTS email_domain_health jsonb,
  ADD COLUMN IF NOT EXISTS email_domain_health_checked_at timestamptz;
