ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS usage_alert_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS usage_alert_threshold_pct integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS usage_alert_email text,
  ADD COLUMN IF NOT EXISTS usage_alert_last_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_alert_period_start timestamptz;