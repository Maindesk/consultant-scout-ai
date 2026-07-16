
-- 1) lead_platform_sites: split policies by role
DROP POLICY IF EXISTS "members manage demo sites" ON public.lead_platform_sites;

CREATE POLICY "members read demo sites"
ON public.lead_platform_sites
FOR SELECT
TO authenticated
USING (
  public.is_workspace_member(auth.uid(), workspace_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "admins insert demo sites"
ON public.lead_platform_sites
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "admins update demo sites"
ON public.lead_platform_sites
FOR UPDATE
TO authenticated
USING (
  public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "admins delete demo sites"
ON public.lead_platform_sites
FOR DELETE
TO authenticated
USING (
  public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  OR public.is_super_admin(auth.uid())
);

-- 2) plans: require authentication to read
DROP POLICY IF EXISTS "plans are public" ON public.plans;

CREATE POLICY "authenticated read active plans"
ON public.plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- 3) Revoke EXECUTE from anon/authenticated/public on internal SECURITY DEFINER helpers.
--    RLS policies and triggers continue to work because they run as table owner (postgres).
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, timestamptz, timestamptz, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_workspace_owner_as_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_trial_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
