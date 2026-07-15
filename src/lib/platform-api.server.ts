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

async function loadCreds(workspaceId: string): Promise<WsCreds> {
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("platform_wl_domain, platform_client_key_ciphertext")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws?.platform_wl_domain || !ws.platform_client_key_ciphertext) {
    throw new Error("Platform API is not configured for this workspace. Add your WL domain + client key in Settings.");
  }
  return { wl_domain: ws.platform_wl_domain, client_key: decryptSecret(ws.platform_client_key_ciphertext) };
}

async function platformFetch(
  workspaceId: string,
  method: "GET" | "POST",
  path: string,
  form?: Record<string, string | number | boolean>,
) {
  const { wl_domain, client_key } = await loadCreds(workspaceId);
  const url = `https://api.${wl_domain}${path}`;
  const headers: Record<string, string> = { "X-CLIENT-KEY": client_key };
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
  if (!res.ok) {
    throw new Error(`Platform API ${method} ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
  }
  return json;
}

export interface CreatedWebsite {
  project?: { id: string };
  website?: { id: string; subdomain?: string; url?: string };
  data?: any;
}

export async function createProjectWithWebsite(input: {
  workspaceId: string;
  externalCustomerId: string;
  email: string;
  name: string;
  websiteName: string;
  templateId?: string;
  personalizationTags?: Record<string, string>;
}): Promise<CreatedWebsite> {
  const form: Record<string, string> = {
    externalCustomerId: input.externalCustomerId,
    email: input.email,
    name: input.name,
    websiteName: input.websiteName,
  };
  if (input.templateId) form.templateId = input.templateId;
  if (input.personalizationTags) {
    form.personalizationTags = JSON.stringify(input.personalizationTags);
  }
  return platformFetch(input.workspaceId, "POST", "/api/v1/website", form);
}

export async function createSsoSession(workspaceId: string, userIdInPlatform: string, projectId: string) {
  return platformFetch(workspaceId, "POST", "/api/platform/session", {
    userId: userIdInPlatform,
    projectId,
    expiresIn: 900,
  });
}

export async function listWebsiteTemplates(workspaceId: string) {
  return platformFetch(workspaceId, "GET", "/api/v1/website/templates");
}

export async function getPlans(workspaceId: string) {
  return platformFetch(workspaceId, "GET", "/api/v1/plans");
}
