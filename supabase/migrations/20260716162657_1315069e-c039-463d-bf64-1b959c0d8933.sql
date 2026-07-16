ALTER TABLE public.search_configs
  ADD COLUMN IF NOT EXISTS audience_description text,
  ADD COLUMN IF NOT EXISTS search_intents text[] NOT NULL DEFAULT '{}';