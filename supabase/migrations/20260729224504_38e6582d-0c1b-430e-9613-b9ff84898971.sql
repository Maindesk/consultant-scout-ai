-- Owners can always read their own workspace (needed for INSERT ... RETURNING)
DROP POLICY IF EXISTS "Owners can view their workspace" ON public.workspaces;
CREATE POLICY "Owners can view their workspace"
ON public.workspaces FOR SELECT TO authenticated
USING (owner_id = auth.uid());

-- Recreate missing trigger so creator becomes an owner member
DROP TRIGGER IF EXISTS trg_add_workspace_owner_as_member ON public.workspaces;
CREATE TRIGGER trg_add_workspace_owner_as_member
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_as_member();

-- Provision trial subscription trigger (also missing)
DROP TRIGGER IF EXISTS trg_provision_trial_subscription ON public.workspaces;
CREATE TRIGGER trg_provision_trial_subscription
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.provision_trial_subscription();

-- Backfill owner memberships
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner' FROM public.workspaces w
ON CONFLICT (workspace_id, user_id) DO NOTHING;