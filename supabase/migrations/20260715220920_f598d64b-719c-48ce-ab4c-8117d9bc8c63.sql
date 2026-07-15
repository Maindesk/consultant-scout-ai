
-- ============================================================
-- 1. SUPER ADMINS
-- ============================================================
CREATE TABLE public.super_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id);
$$;

CREATE POLICY "super admins read themselves" ON public.super_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- ============================================================
-- 2. PLANS CATALOG (public read)
-- ============================================================
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_usd_monthly integer NOT NULL,
  leads_monthly integer NOT NULL,
  ai_credits_monthly integer NOT NULL,
  emails_monthly integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans are public" ON public.plans FOR SELECT USING (is_active = true);

INSERT INTO public.plans (code, name, price_usd_monthly, leads_monthly, ai_credits_monthly, emails_monthly, sort_order) VALUES
  ('trial',   'Free Trial', 0,   25,   500,   100,  0),
  ('starter', 'Starter',    49,  300,  5000,  1200, 1),
  ('growth',  'Growth',     149, 1500, 25000, 6000, 2),
  ('scale',   'Scale',      399, 5000, 80000, 20000, 3),
  ('agency',  'Agency',     999, 15000, 250000, 60000, 4);

-- ============================================================
-- 3. SUBSCRIPTIONS (one per workspace)
-- ============================================================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.plans(code),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','canceled')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  trial_end timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-provision a trial subscription whenever a workspace is created
CREATE OR REPLACE FUNCTION public.provision_trial_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (workspace_id, plan_code, status, trial_end, current_period_end)
  VALUES (NEW.id, 'trial', 'trialing', now() + interval '7 days', now() + interval '7 days')
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_provision_trial AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.provision_trial_subscription();

-- Backfill existing workspaces
INSERT INTO public.subscriptions (workspace_id, plan_code, status, trial_end, current_period_end)
SELECT id, 'trial', 'trialing', now() + interval '7 days', now() + interval '7 days'
FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- ============================================================
-- 4. USAGE COUNTERS (per workspace, per billing period)
-- ============================================================
CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  ai_credits_used integer NOT NULL DEFAULT 0,
  emails_used integer NOT NULL DEFAULT 0,
  leads_discovered_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period_start)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own usage" ON public.usage_counters FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_usage_counters_updated_at BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Server-callable RPC to atomically increment usage (called from service_role handlers)
CREATE OR REPLACE FUNCTION public.increment_usage(
  _workspace_id uuid,
  _period_start timestamptz,
  _period_end timestamptz,
  _ai integer,
  _emails integer,
  _leads integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.usage_counters (workspace_id, period_start, period_end, ai_credits_used, emails_used, leads_discovered_used)
  VALUES (_workspace_id, _period_start, _period_end, COALESCE(_ai,0), COALESCE(_emails,0), COALESCE(_leads,0))
  ON CONFLICT (workspace_id, period_start) DO UPDATE
    SET ai_credits_used = usage_counters.ai_credits_used + COALESCE(_ai,0),
        emails_used = usage_counters.emails_used + COALESCE(_emails,0),
        leads_discovered_used = usage_counters.leads_discovered_used + COALESCE(_leads,0),
        updated_at = now();
END; $$;

-- ============================================================
-- 5. REVENUE EVENTS (from Platform webhooks)
-- ============================================================
CREATE TABLE public.revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('activation','renewal','refund','expired')),
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  plan_id text,
  plan_name text,
  period text,
  external_subscription_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.revenue_events TO authenticated;
GRANT ALL ON public.revenue_events TO service_role;
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_revenue_events_workspace ON public.revenue_events(workspace_id, occurred_at DESC);

CREATE POLICY "members read own revenue" ON public.revenue_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id) OR public.is_super_admin(auth.uid()));

-- ============================================================
-- 6. LEAD PLATFORM SITES (auto-provisioned demo sites)
-- ============================================================
CREATE TABLE public.lead_platform_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  website_id text,
  subdomain text,
  template_id text,
  template_type text,
  personalization_tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  edit_sso_url text,
  sso_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_platform_sites TO authenticated;
GRANT ALL ON public.lead_platform_sites TO service_role;
ALTER TABLE public.lead_platform_sites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lps_workspace ON public.lead_platform_sites(workspace_id);
CREATE INDEX idx_lps_project ON public.lead_platform_sites(project_id);

CREATE POLICY "members manage demo sites" ON public.lead_platform_sites FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER trg_lps_updated_at BEFORE UPDATE ON public.lead_platform_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. PLATFORM EVENTS (raw webhook log)
-- ============================================================
CREATE TABLE public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  handled boolean NOT NULL DEFAULT false,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_events TO authenticated;
GRANT ALL ON public.platform_events TO service_role;
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_platform_events_workspace ON public.platform_events(workspace_id, received_at DESC);

CREATE POLICY "members read own events" ON public.platform_events FOR SELECT TO authenticated
  USING ((workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id))
         OR public.is_super_admin(auth.uid()));

-- ============================================================
-- 8. LEADS: real MRR fields for won deals
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS won_mrr_cents integer,
  ADD COLUMN IF NOT EXISTS won_period text,
  ADD COLUMN IF NOT EXISTS won_at timestamptz;
