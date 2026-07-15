
-- Phase 1: workspaces + encrypted per-workspace platform/website API keys.
-- Non-breaking: existing user-scoped tables are untouched. Workspace-scoping
-- of existing data is deferred to Phase 2 when we actually multi-tenant.

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  platform_wl_domain text,
  platform_client_key_ciphertext text,
  main_site_domain text,
  main_site_api_key_ciphertext text,
  webhook_secret_ciphertext text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.workspace_members(user_id);
CREATE INDEX ON public.workspace_members(workspace_id);

-- Security definer helper to avoid recursive RLS on workspace_members
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND (
        role = _role
        OR (_role = 'member')
        OR (_role = 'admin'  AND role IN ('owner','admin'))
        OR (_role = 'owner'  AND role = 'owner')
      )
  );
$$;

-- RLS: workspaces
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Users can create a workspace they own"
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners/admins can update workspace"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), id, 'admin'))
  WITH CHECK (public.has_workspace_role(auth.uid(), id, 'admin'));

CREATE POLICY "Owner can delete workspace"
  ON public.workspaces FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- RLS: workspace_members
CREATE POLICY "Members can view fellow members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Owners/admins can add members"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "Owners/admins can update members"
  ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'))
  WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "Owners/admins can remove members"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- Auto-add owner as a member on workspace creation
CREATE OR REPLACE FUNCTION public.add_workspace_owner_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspace_owner_member
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_as_member();

CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Track user's currently active workspace (used by UI + server fns)
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS active_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
