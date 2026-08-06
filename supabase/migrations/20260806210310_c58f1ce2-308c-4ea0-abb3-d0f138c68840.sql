ALTER TABLE public.search_configs
  ADD COLUMN IF NOT EXISTS demo_template_id text,
  ADD COLUMN IF NOT EXISTS demo_template_type text,
  ADD COLUMN IF NOT EXISTS demo_template_name text,
  ADD COLUMN IF NOT EXISTS demo_template_thumb text;