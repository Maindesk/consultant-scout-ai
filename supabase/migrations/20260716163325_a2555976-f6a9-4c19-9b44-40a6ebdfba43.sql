
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS sync_replies_to_main_site boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reply_contact_default_tag text NOT NULL DEFAULT 'PixelOutreach Reply';

ALTER TABLE public.inbound_messages
  ADD COLUMN IF NOT EXISTS main_site_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS main_site_sync_error text,
  ADD COLUMN IF NOT EXISTS main_site_contact_id text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS main_site_contact_id text,
  ADD COLUMN IF NOT EXISTS main_site_tags text[] NOT NULL DEFAULT '{}'::text[];
