import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "./workspace-helpers";


export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
  is_active: boolean;
  has_platform_key: boolean;
  has_main_site_key: boolean;
  has_webhook_secret: boolean;
  platform_wl_domain: string | null;
  main_site_domain: string | null;
  sync_replies_to_main_site: boolean;
  reply_contact_default_tag: string;
};

export const getMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceSummary[]> => {
    const { data: members, error: mErr } = await context.supabase
      .from("workspace_members")
      .select("role, workspace_id, workspaces(id, name, slug, platform_wl_domain, main_site_domain, platform_client_key_ciphertext, main_site_api_key_ciphertext, webhook_secret_ciphertext, sync_replies_to_main_site, reply_contact_default_tag)")
      .eq("user_id", context.userId);
    if (mErr) throw mErr;

    const { data: bp } = await context.supabase
      .from("business_profiles")
      .select("active_workspace_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const activeId = bp?.active_workspace_id ?? null;

    return (members ?? [])
      .map((m: any) => {
        const w = m.workspaces;
        if (!w) return null;
        return {
          id: w.id,
          name: w.name,
          slug: w.slug,
          role: m.role,
          is_active: w.id === activeId,
          has_platform_key: !!w.platform_client_key_ciphertext,
          has_main_site_key: !!w.main_site_api_key_ciphertext,
          has_webhook_secret: !!w.webhook_secret_ciphertext,
          platform_wl_domain: w.platform_wl_domain,
          main_site_domain: w.main_site_domain,
          sync_replies_to_main_site: w.sync_replies_to_main_site ?? true,
          reply_contact_default_tag: w.reply_contact_default_tag ?? "PixelOutreach Reply",
        } as WorkspaceSummary;
      })
      .filter(Boolean) as WorkspaceSummary[];
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ context, data }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Name required");
    const baseSlug = slugify(name);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: row, error } = await context.supabase
      .from("workspaces")
      .insert({ name, slug, owner_id: context.userId })
      .select()
      .single();
    if (error) throw error;

    // Set as active if user has no active workspace yet
    const { data: bp } = await context.supabase
      .from("business_profiles")
      .select("id, active_workspace_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (bp) {
      if (!bp.active_workspace_id) {
        await context.supabase
          .from("business_profiles")
          .update({ active_workspace_id: row.id })
          .eq("user_id", context.userId);
      }
    } else {
      await context.supabase
        .from("business_profiles")
        .insert({ user_id: context.userId, active_workspace_id: row.id });
    }
    return row;
  });

export const setActiveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ context, data }) => {
    // Confirm membership via RLS-safe query
    const { data: member } = await context.supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", context.userId)
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    if (!member) throw new Error("Not a member of that workspace");
    const { data: bp } = await context.supabase
      .from("business_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (bp) {
      await context.supabase
        .from("business_profiles")
        .update({ active_workspace_id: data.workspace_id })
        .eq("user_id", context.userId);
    } else {
      await context.supabase
        .from("business_profiles")
        .insert({ user_id: context.userId, active_workspace_id: data.workspace_id });
    }
    return { ok: true };
  });

export const updateWorkspaceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    workspace_id: string;
    name?: string;
    platform_wl_domain?: string | null;
    main_site_domain?: string | null;
    platform_client_key?: string | null; // plaintext; empty => clear
    main_site_api_key?: string | null;
    webhook_secret?: string | null;
    sync_replies_to_main_site?: boolean;
    reply_contact_default_tag?: string;
  }) => d)
  .handler(async ({ context, data }) => {
    // Authorization: must be admin/owner
    const { data: member } = await context.supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", context.userId)
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("Forbidden");

    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.platform_wl_domain !== undefined) patch.platform_wl_domain = data.platform_wl_domain?.trim() || null;
    if (data.main_site_domain !== undefined) patch.main_site_domain = data.main_site_domain?.trim() || null;
    if (data.sync_replies_to_main_site !== undefined) patch.sync_replies_to_main_site = data.sync_replies_to_main_site;
    if (data.reply_contact_default_tag !== undefined) {
      patch.reply_contact_default_tag = (data.reply_contact_default_tag || "PixelOutreach Reply").slice(0, 100);
    }

    const { encryptSecret } = await import("./workspace-crypto.server");
    if (data.platform_client_key !== undefined) {
      patch.platform_client_key_ciphertext = data.platform_client_key
        ? encryptSecret(data.platform_client_key)
        : null;
    }
    if (data.main_site_api_key !== undefined) {
      patch.main_site_api_key_ciphertext = data.main_site_api_key
        ? encryptSecret(data.main_site_api_key)
        : null;
    }
    if (data.webhook_secret !== undefined) {
      patch.webhook_secret_ciphertext = data.webhook_secret
        ? encryptSecret(data.webhook_secret)
        : null;
    }

    const { error } = await context.supabase
      .from("workspaces")
      .update(patch as never)
      .eq("id", data.workspace_id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Ping the configured Platform API using the workspace's stored key.
 * Returns { ok, plans_count?, message? }.
 */
export const testPlatformApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: ws } = await context.supabase
      .from("workspaces")
      .select("platform_wl_domain, platform_client_key_ciphertext")
      .eq("id", data.workspace_id)
      .maybeSingle();
    if (!ws?.platform_wl_domain || !ws.platform_client_key_ciphertext) {
      return { ok: false, message: "Domain and key required" };
    }
    const { decryptSecret } = await import("./workspace-crypto.server");
    const clientKey = decryptSecret(ws.platform_client_key_ciphertext);
    const url = `https://api.${ws.platform_wl_domain}/api/v1/plans`;
    try {
      const res = await fetch(url, { headers: { "X-CLIENT-KEY": clientKey } });
      if (!res.ok) return { ok: false, message: `${res.status} ${res.statusText}` };
      const json: any = await res.json();
      return { ok: true, plans_count: Array.isArray(json?.data) ? json.data.length : 0 };
    } catch (e) {
      return { ok: false, message: String(e) };
    }
  });

export const testMainSiteApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: ws } = await context.supabase
      .from("workspaces")
      .select("main_site_domain, main_site_api_key_ciphertext")
      .eq("id", data.workspace_id)
      .maybeSingle();
    if (!ws?.main_site_domain || !ws.main_site_api_key_ciphertext) {
      return { ok: false, message: "Domain and key required" };
    }
    const { decryptSecret } = await import("./workspace-crypto.server");
    const apiKey = decryptSecret(ws.main_site_api_key_ciphertext);
    const url = `https://${ws.main_site_domain}/api/site/contacts?limit=1`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) return { ok: false, message: `${res.status} ${res.statusText}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e) };
    }
  });
