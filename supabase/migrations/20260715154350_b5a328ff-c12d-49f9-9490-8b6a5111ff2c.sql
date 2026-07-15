
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS platform_confidence numeric,
  ADD COLUMN IF NOT EXISTS platform_matches integer,
  ADD COLUMN IF NOT EXISTS platform_alternatives jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ai_stage_reason text;

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS avg_deal_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_close_rate numeric DEFAULT 0.1,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
