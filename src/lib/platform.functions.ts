import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Auto-provisions a personalized demo site on the workspace's WL platform
 * for a specific lead. Idempotent — returns the existing site row if one
 * has already been created for this lead. Newly created sites start as
 * NOT approved so the user can preview them before they're used in outreach.
 */
export const provisionDemoSiteForLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string; template_id?: string; funnel_template_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: lead } = await context.supabase
      .from("leads")
      .select("id, workspace_id")
      .eq("id", data.lead_id)
      .maybeSingle();
    if (!lead) throw new Error("Lead not found");

    const { getActiveWorkspaceIdForUser } = await import("./quota.server");
    const workspaceId =
      ((lead as any).workspace_id as string | null) ?? (await getActiveWorkspaceIdForUser(context.userId));
    if (!workspaceId) throw new Error("No active workspace");

    const { provisionDemoSite } = await import("./demo-site.server");
    const { site, created } = await provisionDemoSite({
      workspaceId,
      leadId: lead.id,
      templateId: data.template_id ?? null,
      funnelTemplateId: data.funnel_template_id ?? null,
      approved: false,
    });
    return { site, created };
  });

/** Approve (or un-approve) a demo site for use in outreach emails. */
export const setDemoSiteApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string; approved: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { data: site } = await context.supabase
      .from("lead_platform_sites")
      .select("id, workspace_id")
      .eq("lead_id", data.lead_id)
      .maybeSingle();
    if (!site) throw new Error("No demo site for this lead");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("lead_platform_sites")
      .update({
        approved: data.approved,
        approved_at: data.approved ? new Date().toISOString() : null,
        approved_by: data.approved ? context.userId : null,
      } as never)
      .eq("id", site.id)
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
    const { data: site } = await context.supabase
      .from("lead_platform_sites")
      .select("*")
      .eq("lead_id", data.lead_id)
      .maybeSingle();
    if (!site) throw new Error("No demo site provisioned for this lead yet");

    const { mintSsoLink } = await import("./demo-site.server");
    return mintSsoLink(site);
  });

export const listAvailableTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActiveWorkspaceIdForUser } = await import("./quota.server");
    const workspaceId = await getActiveWorkspaceIdForUser(context.userId);
    if (!workspaceId) return { ok: false, error: "No active workspace", templates: [] };
    try {
      const { listWebsiteTemplates, listFunnelTemplates } = await import("./platform-api.server");
      const [sites, funnels] = await Promise.all([
        listWebsiteTemplates(workspaceId),
        listFunnelTemplates(workspaceId).catch(() => []),
      ]);
      return { ok: true, error: null as string | null, templates: [...sites, ...funnels] };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), templates: [] };
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
