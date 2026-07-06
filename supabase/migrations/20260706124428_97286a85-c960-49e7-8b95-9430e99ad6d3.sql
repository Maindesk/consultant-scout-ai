
-- business_sources: multiple URLs feeding the business knowledge base
CREATE TABLE public.business_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  source_type TEXT NOT NULL DEFAULT 'page',
  scraped_markdown TEXT,
  ai_notes TEXT,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_sources TO authenticated;
GRANT ALL ON public.business_sources TO service_role;
ALTER TABLE public.business_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business_sources" ON public.business_sources
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_business_sources_updated BEFORE UPDATE ON public.business_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- search_configs additions
ALTER TABLE public.search_configs
  ADD COLUMN tech_stack TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;

-- leads additions
ALTER TABLE public.leads
  ADD COLUMN platform TEXT;
CREATE INDEX leads_user_platform_idx ON public.leads(user_id, platform);

-- automation_settings: daily autopilot control
CREATE TABLE public.automation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  daily_lead_target INT NOT NULL DEFAULT 10,
  auto_enrich BOOLEAN NOT NULL DEFAULT true,
  auto_draft BOOLEAN NOT NULL DEFAULT true,
  active_search_config_id UUID REFERENCES public.search_configs(id) ON DELETE SET NULL,
  last_run_at TIMESTAMPTZ,
  last_run_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_settings TO authenticated;
GRANT ALL ON public.automation_settings TO service_role;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own automation_settings" ON public.automation_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_automation_settings_updated BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
