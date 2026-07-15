import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Auto-provisions a personalized demo site on the workspace's WL platform
 * for a specific lead. Idempotent — returns the existing site row if one
 * has already been created for this lead.
 */
export const provisionDemoSiteForLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string; template_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const [{ data: lead }, { data: enrichment }] = await Promise.all([
      context.supabase.from("leads").select("*").eq("id", data.lead_id).maybeSingle(),
      context.supabase.from("lead_enrichments").select("*").eq("lead_id", data.lead_id).maybeSingle(),
    ]);
    if (!lead) throw new Error("Lead not found");

    const { getActiveWorkspaceIdForUser } = await import("./quota.server");
    const workspaceId =
      ((lead as any).workspace_id as string | null) ?? (await getActiveWorkspaceIdForUser(context.userId));
    if (!workspaceId) throw new Error("No active workspace");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("lead_platform_sites")
      .select("*")
      .eq("lead_id", lead.id)
      .maybeSingle();
    if (existing) return existing;

    const { createProjectWithWebsite } = await import("./platform-api.server");

    const businessName = lead.business_name ?? lead.domain ?? "Prospect";
    const email = lead.email ?? `demo+${lead.id}@example.com`;
    const tags: Record<string, string> = {
      business_name: businessName,
      offer: (enrichment?.offer ?? "").slice(0, 200),
      audience: (enrichment?.target_audience ?? "").slice(0, 200),
      brand_color: ((enrichment as any)?.website_signals?.brand_color ?? "") as string,
    };

    const result = await createProjectWithWebsite({
      workspaceId,
      externalCustomerId: lead.id,
      email,
      name: businessName,
      websiteName: `${businessName} demo`,
      templateId: data.template_id,
      personalizationTags: tags,
    });

    const projectId = result?.project?.id ?? result?.data?.projectId ?? "";
    const websiteId = result?.website?.id ?? result?.data?.websiteId ?? null;
    const subdomain = result?.website?.subdomain ?? result?.data?.subdomain ?? null;

    const { data: row, error } = await supabaseAdmin
      .from("lead_platform_sites")
      .insert({
        lead_id: lead.id,
        workspace_id: workspaceId,
        project_id: String(projectId),
        website_id: websiteId ? String(websiteId) : null,
        subdomain,
        template_id: data.template_id ?? null,
        personalization_tags: tags,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

/** Mints a fresh 15-min SSO edit link for the lead's demo site. */
export const getFreshEditLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site } = await supabaseAdmin
      .from("lead_platform_sites")
      .select("*")
      .eq("lead_id", data.lead_id)
      .maybeSingle();
    if (!site) throw new Error("No demo site provisioned for this lead yet");

    const { data: mem } = await context.supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", site.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!mem) throw new Error("Forbidden");

    const { createSsoSession } = await import("./platform-api.server");
    const sso: any = await createSsoSession(site.workspace_id, context.userId, site.project_id);
    const url: string | null = sso?.accessUrl ?? sso?.url ?? sso?.data?.accessUrl ?? null;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("lead_platform_sites")
      .update({ edit_sso_url: url, sso_expires_at: expiresAt })
      .eq("id", site.id);
    return { url, expires_at: expiresAt };
  });

export const listAvailableTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActiveWorkspaceIdForUser } = await import("./quota.server");
    const workspaceId = await getActiveWorkspaceIdForUser(context.userId);
    if (!workspaceId) return [];
    try {
      const { listWebsiteTemplates } = await import("./platform-api.server");
      const res: any = await listWebsiteTemplates(workspaceId);
      return (res?.data ?? res?.templates ?? []) as Array<{ id: string; name: string; type?: string }>;
    } catch {
      return [];
    }
  });

export const getDemoSiteForLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("lead_platform_sites")
      .select("*")
      .eq("lead_id", data.lead_id)
      .maybeSingle();
    return row ?? null;
  });
