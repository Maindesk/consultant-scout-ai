
REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, timestamptz, timestamptz, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, timestamptz, timestamptz, integer, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.provision_trial_subscription() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_trial_subscription() TO service_role;
