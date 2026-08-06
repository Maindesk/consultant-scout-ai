/**
 * Thin server-only client for the main marketing site (Simvoly Website API).
 * Used to sync leads & repliers as contacts, and to push/remove tags on those
 * contacts so users can trigger main-site automations (nurture sequences,
 * segments, etc.) directly from PixelOutreach.
 *
 * Endpoint convention (Simvoly Website API):
 *   Base:   https://{main_site_domain}/api/site
 *   Auth:   Authorization: Bearer <api_key>
 *   Format: JSON
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "./workspace-crypto.server";

interface MainSiteCreds {
  domain: string;
  api_key: string;
}

async function loadCreds(workspaceId: string): Promise<MainSiteCreds | null> {
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("main_site_domain, main_site_api_key_ciphertext")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws?.main_site_domain || !ws.main_site_api_key_ciphertext) return null;
  return { domain: ws.main_site_domain, api_key: decryptSecret(ws.main_site_api_key_ciphertext) };
}

async function mainSiteFetch(
  workspaceId: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const creds = await loadCreds(workspaceId);
  if (!creds) {
    return { ok: false, status: 0, json: null, text: "Main site API not configured" };
  }
  const url = `https://${creds.domain}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${creds.api_key}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (full ?? "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export interface UpsertContactInput {
  workspaceId: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  company?: string | null;
  website?: string | null;
  tags?: string[];
  source?: string;
}

/**
 * Create or update a contact on the workspace's main website and apply tags.
 * Returns { ok, contactId?, error? }.
 */
export async function upsertMainSiteContact(input: UpsertContactInput): Promise<{
  ok: boolean;
  contactId?: string;
  error?: string;
}> {
  const { firstName, lastName } = splitName(input.fullName);
  const tags = Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)));

  // The Website API ContactDetails DTO only accepts these fields — sending
  // unknown ones (firstName/lastName/website/source) returns a 400.
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const payload: Record<string, unknown> = {
    email: input.email,
    tags,
  };
  if (fullName) payload.name = fullName;
  if (input.phone) payload.phone = input.phone;
  if (input.company) payload.companyName = input.company;

  const noteParts: string[] = [];
  if (input.website) noteParts.push(`Website: ${input.website}`);
  noteParts.push(`Source: ${input.source ?? "PixelOutreach"}`);
  payload.note = noteParts.join(" | ");

  const res = await mainSiteFetch(input.workspaceId, "POST", "/api/site/contacts", payload);

  if (!res.ok) {
    return { ok: false, error: `${res.status} ${res.text.slice(0, 300)}` };
  }
  const contactId =
    res.json?.id ??
    res.json?.data?.id ??
    res.json?.contact?.id ??
    res.json?.data?.contact?.id ??
    null;
  return { ok: true, contactId: contactId ? String(contactId) : undefined };
}

/**
 * Add a single tag to an existing main-site contact (looked up by email).
 * Works even if the contact wasn't created by PixelOutreach — the upsert
 * endpoint merges tags server-side.
 */
export async function addMainSiteContactTag(input: {
  workspaceId: string;
  email: string;
  tag: string;
  fullName?: string | null;
}): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  return upsertMainSiteContact({
    workspaceId: input.workspaceId,
    email: input.email,
    fullName: input.fullName ?? null,
    tags: [input.tag],
    source: "PixelOutreach",
  });
}
