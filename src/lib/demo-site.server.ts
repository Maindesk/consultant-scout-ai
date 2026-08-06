/**
 * Server-only helpers for provisioning + linking white-label demo sites.
 * Shared by the lead UI server fns, the outbound cron and the inbound webhook.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createProjectWithWebsite,
  createSsoSession,
  loadWorkspaceCreds,
} from "./platform-api.server";

function slugifySubdomain(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "demo"
  );
}

function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Builds the personalization tags injected into the template. */
export function buildPersonalizationTags(lead: any, enrichment: any): Record<string, string> {
  const signals = (enrichment?.website_signals ?? {}) as Record<string, any>;
  const businessName = lead?.business_name ?? lead?.domain ?? "Your Business";
  return {
    business_name: businessName,
    company_name: businessName,
    contact_name: lead?.name ?? "",
    email: lead?.email ?? "",
    phone: signals.phone ?? "",
    address: signals.address ?? lead?.location ?? "",
    city: lead?.location ?? "",
    website: lead?.website ?? (lead?.domain ? `https://${lead.domain}` : ""),
    industry: lead?.niche ?? "",
    headline: (enrichment?.value_proposition ?? enrichment?.business_summary ?? "").slice(0, 140),
    tagline: (enrichment?.offer ?? "").slice(0, 140),
    offer: (enrichment?.offer ?? "").slice(0, 200),
    audience: (enrichment?.target_audience ?? "").slice(0, 200),
    about: (enrichment?.business_summary ?? "").slice(0, 400),
  };
}

export function brandColorFrom(enrichment: any): string | null {
  const signals = (enrichment?.website_signals ?? {}) as Record<string, any>;
  const c = signals.brand_color ?? signals.primary_color ?? null;
  return typeof c === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(c.replace("#", "#")) ? c : null;
}

export interface ProvisionResult {
  site: any;
  created: boolean;
}

/**
 * Creates the demo site on the WL platform for a lead (idempotent).
 * `approved` controls whether the site can immediately be used in outreach.
 */
export async function provisionDemoSite(input: {
  workspaceId: string;
  leadId: string;
  templateId?: string | null;
  funnelTemplateId?: string | null;
  approved: boolean;
}): Promise<ProvisionResult> {
  const { data: existing } = await supabaseAdmin
    .from("lead_platform_sites")
    .select("*")
    .eq("lead_id", input.leadId)
    .maybeSingle();
  if (existing) return { site: existing, created: false };

  const [{ data: lead }, { data: enrichment }] = await Promise.all([
    supabaseAdmin.from("leads").select("*").eq("id", input.leadId).maybeSingle(),
    supabaseAdmin.from("lead_enrichments").select("*").eq("lead_id", input.leadId).maybeSingle(),
  ]);
  if (!lead) throw new Error("Lead not found");

  // Fall back to the template chosen on the audience this lead came from.
  let templateId = input.templateId ?? null;
  let funnelTemplateId = input.funnelTemplateId ?? null;
  if (!templateId && !funnelTemplateId && lead.search_config_id) {
    const { data: cfg } = await supabaseAdmin
      .from("search_configs")
      .select("demo_template_id, demo_template_type")
      .eq("id", lead.search_config_id)
      .maybeSingle();
    const cfgAny = cfg as any;
    if (cfgAny?.demo_template_id) {
      if (cfgAny.demo_template_type === "FUNNEL") funnelTemplateId = String(cfgAny.demo_template_id);
      else templateId = String(cfgAny.demo_template_id);
    }
  }

  const { wl_domain } = await loadWorkspaceCreds(input.workspaceId);

  const businessName = lead.business_name ?? lead.domain ?? "Prospect";
  const tags = buildPersonalizationTags(lead, enrichment);
  const brandColor = brandColorFrom(enrichment);
  const { first, last } = splitName(lead.name ?? businessName);

  const result = await createProjectWithWebsite({
    workspaceId: input.workspaceId,
    externalCustomerId: lead.id,
    customerEmail: lead.email ?? `demo+${lead.id}@example.com`,
    customerFirstName: first,
    customerLastName: last,
    websiteName: `${businessName} — demo`,
    customerSubdomain: slugifySubdomain(businessName),
    templateId: input.templateId ?? null,
    funnelTemplateId: input.funnelTemplateId ?? null,
    brandColor,
    personalizationTags: tags,
  });

  const previewUrl = result.subdomain ? `https://${result.subdomain}.${wl_domain}` : null;

  const { data: row, error } = await supabaseAdmin
    .from("lead_platform_sites")
    .insert({
      lead_id: lead.id,
      workspace_id: input.workspaceId,
      project_id: result.projectId,
      website_id: result.websiteId,
      subdomain: result.subdomain,
      template_id: input.templateId ?? null,
      funnel_template_id: input.funnelTemplateId ?? null,
      template_type: input.funnelTemplateId ? "FUNNEL" : "WEBSITE",
      personalization_tags: tags,
      brand_color: brandColor,
      preview_url: previewUrl,
      approved: input.approved,
      approved_at: input.approved ? new Date().toISOString() : null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return { site: row, created: true };
}

/** Mints a fresh 15-minute SSO edit URL for an existing demo site row. */
export async function mintSsoLink(site: any): Promise<{ url: string | null; expires_at: string }> {
  const sso = await createSsoSession({
    workspaceId: site.workspace_id,
    externalCustomerId: site.lead_id,
    projectId: site.project_id,
  });
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  if (sso.accessUrl) {
    await supabaseAdmin
      .from("lead_platform_sites")
      .update({ edit_sso_url: sso.accessUrl, sso_expires_at: expiresAt })
      .eq("id", site.id);
  }
  return { url: sso.accessUrl, expires_at: expiresAt };
}
