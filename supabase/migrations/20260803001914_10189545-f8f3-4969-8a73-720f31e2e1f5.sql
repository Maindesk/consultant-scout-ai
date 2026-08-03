ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS overage_price_cents_per_lead integer NOT NULL DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS overage_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.usage_counters ADD COLUMN IF NOT EXISTS overage_leads_used integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_usage(_workspace_id uuid, _period_start timestamp with time zone, _period_end timestamp with time zone, _ai integer, _emails integer, _leads integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.usage_counters (workspace_id, period_start, period_end, ai_credits_used, emails_used, leads_discovered_used)
  VALUES (_workspace_id, _period_start, _period_end, COALESCE(_ai,0), COALESCE(_emails,0), COALESCE(_leads,0))
  ON CONFLICT (workspace_id, period_start) DO UPDATE
    SET ai_credits_used = usage_counters.ai_credits_used + COALESCE(_ai,0),
        emails_used = usage_counters.emails_used + COALESCE(_emails,0),
        leads_discovered_used = usage_counters.leads_discovered_used + COALESCE(_leads,0),
        updated_at = now();
END; $function$;

CREATE OR REPLACE FUNCTION public.increment_overage_leads(_workspace_id uuid, _period_start timestamp with time zone, _period_end timestamp with time zone, _leads integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.usage_counters (workspace_id, period_start, period_end, overage_leads_used)
  VALUES (_workspace_id, _period_start, _period_end, COALESCE(_leads,0))
  ON CONFLICT (workspace_id, period_start) DO UPDATE
    SET overage_leads_used = usage_counters.overage_leads_used + COALESCE(_leads,0),
        updated_at = now();
END; $function$;

REVOKE ALL ON FUNCTION public.increment_overage_leads(uuid, timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_overage_leads(uuid, timestamptz, timestamptz, integer) TO service_role;