
-- Business profile (one per user)
CREATE TABLE public.business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  website_url TEXT,
  offer_description TEXT,
  ai_summary TEXT,
  value_proposition TEXT,
  ideal_client TEXT,
  services JSONB,
  daily_send_cap INT NOT NULL DEFAULT 25,
  sender_name TEXT,
  sender_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business_profiles" ON public.business_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Targeting search configs
CREATE TABLE public.search_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  niches TEXT[] NOT NULL DEFAULT '{}',
  locations TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_configs TO authenticated;
GRANT ALL ON public.search_configs TO service_role;
ALTER TABLE public.search_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own search_configs" ON public.search_configs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  search_config_id UUID REFERENCES public.search_configs ON DELETE SET NULL,
  name TEXT,
  business_name TEXT,
  website TEXT,
  domain TEXT,
  email TEXT,
  niche TEXT,
  location TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new | enriched | drafted | approved | sending | sent | replied | rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);
CREATE INDEX leads_user_status_idx ON public.leads(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own leads" ON public.leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enrichments (one per lead)
CREATE TABLE public.lead_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  business_summary TEXT,
  offer TEXT,
  target_audience TEXT,
  pricing_signals TEXT,
  funnel_presence TEXT,
  pain_points JSONB, -- array of {title, description}
  raw_markdown TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_enrichments TO authenticated;
GRANT ALL ON public.lead_enrichments TO service_role;
ALTER TABLE public.lead_enrichments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own enrichments" ON public.lead_enrichments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email drafts
CREATE TABLE public.email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads ON DELETE CASCADE,
  step_number INT NOT NULL DEFAULT 1, -- 1=initial, 2..5 follow-ups
  day_offset INT NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT DEFAULT 'professional',
  status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval | approved | rejected | sent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_drafts_user_status_idx ON public.email_drafts(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
GRANT ALL ON public.email_drafts TO service_role;
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own email_drafts" ON public.email_drafts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Outbound queue (approved drafts scheduled to send)
CREATE TABLE public.outbound_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES public.email_drafts ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sent | failed | cancelled
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX outbound_queue_user_status_idx ON public.outbound_queue(user_id, status, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_queue TO authenticated;
GRANT ALL ON public.outbound_queue TO service_role;
ALTER TABLE public.outbound_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outbound_queue" ON public.outbound_queue FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email sends log
CREATE TABLE public.email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads ON DELETE CASCADE,
  draft_id UUID REFERENCES public.email_drafts ON DELETE SET NULL,
  subject TEXT,
  body TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_sends_user_sent_idx ON public.email_sends(user_id, sent_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_sends TO authenticated;
GRANT ALL ON public.email_sends TO service_role;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own email_sends" ON public.email_sends FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Inbound messages
CREATE TABLE public.inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads ON DELETE CASCADE,
  from_email TEXT,
  subject TEXT,
  body TEXT,
  classification TEXT, -- interested | question | objection | not_interested | other
  suggested_reply TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_messages TO authenticated;
GRANT ALL ON public.inbound_messages TO service_role;
ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inbound_messages" ON public.inbound_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_bp_updated BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_drafts_updated BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
