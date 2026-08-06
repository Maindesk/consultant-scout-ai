/**
 * Thin server-only client for the Simvoly / Maindesk Platform API.
 * Every call resolves the workspace's WL domain + client key from the DB.
 * Form-encoded per Platform API convention.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./workspace-crypto.server";

interface WsCreds {
  wl_domain: string;
  client_key: string;
}

export async function loadWorkspaceCreds(workspaceId: string): Promise<WsCreds> {
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("platform_wl_domain, platform_client_key_ciphertext")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws?.platform_wl_domain || !ws.platform_client_key_ciphertext) {
    throw new Error(
      "Platform API is not configured for this workspace. Add your WL domain + client key in Settings → Integrations.",
    );
  }
  return {
    wl_domain: ws.platform_wl_domain.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    client_key: decryptSecret(ws.platform_client_key_ciphertext),
  };
}

async function platformFetch(
  workspaceId: string,
  method: "GET" | "POST",
  path: string,
  form?: Record<string, string | number | boolean>,
  auth: "client-key" | "bearer" = "client-key",
) {
  const { wl_domain, client_key } = await loadWorkspaceCreds(workspaceId);
  const url = `https://api.${wl_domain}${path}`;
  const headers: Record<string, string> =
    auth === "bearer" ? { Authorization: `Bearer ${client_key}` } : { "X-CLIENT-KEY": client_key };
  const init: RequestInit = { method, headers };
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) body.append(k, String(v));
    init.body = body.toString();
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json?.success === false) {
    const msg = json?.message ?? text.slice(0, 400);
    throw new Error(`Platform API ${method} ${path} failed [${res.status}]: ${msg}`);
  }
  return json;
}

/** Personalization tags are sent as a JSON array of { name, value }. */
export function serializeTags(tags: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(tags)
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
      .map(([name, value]) => ({ name, value: String(value) })),
  );
}

export interface CreatedWebsite {
  websiteId: string | null;
  projectId: string;
  subdomain: string | null;
  raw: any;
}

export async function createProjectWithWebsite(input: {
  workspaceId: string;
  externalCustomerId: string;
  customerEmail: string;
  customerFirstName?: string;
  customerLastName?: string;
  websiteName: string;
  customerSubdomain?: string;
  templateId?: string | null;
  funnelTemplateId?: string | null;
  brandColor?: string | null;
  personalizationTags?: Record<string, string>;
}): Promise<CreatedWebsite> {
  const form: Record<string, string> = {
    externalCustomerId: input.externalCustomerId,
    customerEmail: input.customerEmail,
    customerFirstName: input.customerFirstName ?? "",
    customerLastName: input.customerLastName ?? "",
    websiteName: input.websiteName,
  };
  if (input.customerSubdomain) form.customerSubdomain = input.customerSubdomain;
  if (input.templateId) form.templateId = String(input.templateId);
  if (input.funnelTemplateId) form.funnelTemplateId = String(input.funnelTemplateId);
  if (input.brandColor) form.brandColor = input.brandColor;
  if (input.personalizationTags) form.personalizationTags = serializeTags(input.personalizationTags);

  const json = await platformFetch(input.workspaceId, "POST", "/api/v1/website", form);
  const data = json?.data ?? json ?? {};
  return {
    websiteId: data.websiteId != null ? String(data.websiteId) : null,
    projectId: String(data.projectId ?? ""),
    subdomain: data.subdomain ?? null,
    raw: json,
  };
}

/** Update the personalization tags / colors of an existing website. */
export async function setPersonalizationTags(input: {
  workspaceId: string;
  websiteId: string;
  tags: Record<string, string>;
  brandColor?: string | null;
}) {
  const form: Record<string, string> = { tags: serializeTags(input.tags) };
  if (input.brandColor) form.brandColor = input.brandColor;
  return platformFetch(
    input.workspaceId,
    "POST",
    `/api/v1/website/${encodeURIComponent(input.websiteId)}/set-personalization-tags`,
    form,
  );
}

/**
 * Single Sign-On (Start Building Session).
 * Uses Authorization: Bearer <client key> and the externalCustomerId that owns
 * the project (the lead id we passed on creation). Valid 15 minutes.
 */
export async function createSsoSession(input: {
  workspaceId: string;
  externalCustomerId: string;
  projectId: string;
  websiteId?: string | null;
  path?: string;
}): Promise<{ accessUrl: string | null; expiresAt: number | null }> {
  const form: Record<string, string> = {
    externalCustomerId: input.externalCustomerId,
    projectId: input.projectId,
  };
  if (input.path) form.path = input.path;
  const json = await platformFetch(input.workspaceId, "POST", "/api/platform/session", form, "bearer");
  return {
    accessUrl: json?.accessUrl ?? json?.data?.accessUrl ?? null,
    expiresAt: json?.expiresAt ?? null,
  };
}

export interface PlatformTemplate {
  id: string;
  name: string;
  primaryCategories?: string;
  categories?: string;
  previewUrl?: string;
  thumb?: string;
  visible?: boolean;
  type: "WEBSITE" | "FUNNEL";
}

export async function listWebsiteTemplates(workspaceId: string): Promise<PlatformTemplate[]> {
  const json = await platformFetch(workspaceId, "GET", "/api/v1/templates");
  const arr: any[] = Array.isArray(json) ? json : (json?.data ?? []);
  return arr
    .filter((t) => t?.visible !== false)
    .map((t) => ({
      id: String(t.id),
      name: String(t.name ?? `Template ${t.id}`),
      primaryCategories: t.primaryCategories,
      categories: t.categories,
      previewUrl: t.previewUrl
        ? t.previewUrl.startsWith("http")
          ? t.previewUrl
          : `https://${t.previewUrl}`
        : undefined,
      thumb: t.thumb,
      visible: t.visible,
      type: "WEBSITE" as const,
    }));
}

export async function listFunnelTemplates(workspaceId: string): Promise<PlatformTemplate[]> {
  const json = await platformFetch(workspaceId, "GET", "/api/v1/funnel-templates");
  const cats: any[] = Array.isArray(json) ? json : (json?.data ?? []);
  const out: PlatformTemplate[] = [];
  for (const cat of cats) {
    for (const item of cat?.items ?? []) {
      out.push({
        id: String(item.id),
        name: String(item?.name?.en ?? item?.name ?? `Funnel ${item.id}`),
        primaryCategories: String(cat?.name?.en ?? ""),
        thumb: item.image,
        type: "FUNNEL",
      });
    }
  }
  return out;
}

export async function getPlans(workspaceId: string) {
  return platformFetch(workspaceId, "GET", "/api/v1/plans");
}
