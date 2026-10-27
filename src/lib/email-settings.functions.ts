import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkspaceAdmin } from "./email-settings-helpers";

export type EmailProviderName = "resend" | "sendgrid" | "postmark";


export interface EmailSenderStatus {
  configured: boolean;
  provider: EmailProviderName | null;
  from_email: string | null;
  from_name: string | null;
  from_domain: string | null;
  health: any | null;
  health_checked_at: string | null;
}

export const getEmailSenderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ context, data }): Promise<EmailSenderStatus> => {
    const { data: ws } = await context.supabase
      .from("workspaces")
      .select(
        "email_provider, email_api_key_ciphertext, email_from_email, email_from_name, email_from_domain, email_domain_health, email_domain_health_checked_at",
      )
      .eq("id", data.workspace_id)
      .maybeSingle();
    if (!ws) throw new Error("Workspace not found");
    return {
      configured: !!(ws.email_provider && ws.email_api_key_ciphertext && ws.email_from_email),
      provider: (ws.email_provider as EmailProviderName | null) ?? null,
      from_email: ws.email_from_email ?? null,
      from_name: ws.email_from_name ?? null,
      from_domain: ws.email_from_domain ?? null,
      health: ws.email_domain_health ?? null,
      health_checked_at: ws.email_domain_health_checked_at ?? null,
    };
  });

export const saveEmailSender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    workspace_id: string;
    provider: EmailProviderName;
    api_key?: string; // omit or empty => keep existing
    from_email: string;
    from_name?: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    await assertWorkspaceAdmin(context.supabase, context.userId, data.workspace_id);
    if (!["resend", "sendgrid", "postmark"].includes(data.provider)) {
      throw new Error("Unsupported provider");
    }
    const email = data.from_email.trim().toLowerCase();
    const match = email.match(/^[^@\s]+@([^@\s]+\.[a-z]{2,})$/i);
    if (!match) throw new Error("Enter a valid from-address");
    const domain = match[1].toLowerCase();

    const patch: Record<string, any> = {
      email_provider: data.provider,
      email_from_email: email,
      email_from_domain: domain,
      email_from_name: (data.from_name ?? "").trim() || null,
    };

    if (data.api_key && data.api_key.trim()) {
      const { testProviderCredentials } = await import("./email-provider.server");
      const t = await testProviderCredentials(data.provider, data.api_key.trim());
      if (!t.ok) throw new Error(t.message);
      const { encryptSecret } = await import("./workspace-crypto.server");
      patch.email_api_key_ciphertext = encryptSecret(data.api_key.trim());
    }

    const { error } = await context.supabase
      .from("workspaces")
      .update(patch as never)
      .eq("id", data.workspace_id);
    if (error) throw error;
    return { ok: true };
  });

export const clearEmailSender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertWorkspaceAdmin(context.supabase, context.userId, data.workspace_id);
    const { error } = await context.supabase
      .from("workspaces")
      .update({
        email_provider: null,
        email_api_key_ciphertext: null,
        email_from_email: null,
        email_from_domain: null,
        email_from_name: null,
        email_domain_health: null,
        email_domain_health_checked_at: null,
      } as never)
      .eq("id", data.workspace_id);
    if (error) throw error;
    return { ok: true };
  });

export const testEmailSender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string; to?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertWorkspaceAdmin(context.supabase, context.userId, data.workspace_id);
    const { loadWorkspaceSender, sendWithWorkspaceProvider } = await import("./email-provider.server");
    const cfg = await loadWorkspaceSender(data.workspace_id);
    if (!cfg) return { ok: false, message: "No sender configured yet" };
    const to = (data.to ?? "").trim() || context.claims.email;
    if (!to) return { ok: false, message: "No recipient" };
    try {
      const { data: ws } = await context.supabase
        .from("workspaces").select("email_branding").eq("id", data.workspace_id).maybeSingle();
      const { renderBrandedEmail } = await import("./email-branding");
      const r = renderBrandedEmail(
        "Hi there,\n\nThis is a test email from PixelOutreach confirming your sender is connected and showing your email design.\n\n{{DEMO_LINK}}\n\nBest,",
        ((ws as any)?.email_branding ?? null),
        "https://example.com/demo-preview",
      );
      const result = await sendWithWorkspaceProvider(data.workspace_id, {
        to,
        subject: "PixelOutreach — sender test",
        text: r.text,
        html: r.html,
      });
      return { ok: true, message: `Sent to ${to} (id ${result.message_id})` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  });

export const runDomainHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string; domain?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertWorkspaceAdmin(context.supabase, context.userId, data.workspace_id);
    const { data: ws } = await context.supabase
      .from("workspaces")
      .select("email_from_domain, email_provider")
      .eq("id", data.workspace_id)
      .maybeSingle();
    const domain = (data.domain ?? ws?.email_from_domain ?? "").trim();
    if (!domain) throw new Error("No domain set on this workspace");
    const { checkDomainHealth } = await import("./email-provider.server");
    const health = await checkDomainHealth(domain, (ws?.email_provider as any) ?? null);
    await context.supabase
      .from("workspaces")
      .update({
        email_domain_health: health as never,
        email_domain_health_checked_at: new Date().toISOString(),
      } as never)
      .eq("id", data.workspace_id);
    return health;
  });

export const getEmailBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: ws } = await context.supabase
      .from("workspaces").select("email_branding").eq("id", data.workspace_id).maybeSingle();
    return ((ws as any)?.email_branding ?? {}) as import("./email-branding").EmailBranding;
  });

export const saveEmailBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string; branding: import("./email-branding").EmailBranding }) => d)
  .handler(async ({ context, data }) => {
    await assertWorkspaceAdmin(context.supabase, context.userId, data.workspace_id);
    const b = data.branding ?? {};
    const clip = (s: unknown, n = 200) => (typeof s === "string" ? s.slice(0, n) : undefined);
    const clean = {
      sig_name: clip(b.sig_name), sig_title: clip(b.sig_title), logo_url: clip(b.logo_url, 2000),
      logo_width: Number(b.logo_width) || 140, website: clip(b.website), email: clip(b.email),
      phone: clip(b.phone, 50), button_label: clip(b.button_label, 60), button_color: clip(b.button_color, 9),
    };
    const { error } = await context.supabase
      .from("workspaces").update({ email_branding: clean } as never).eq("id", data.workspace_id);
    if (error) throw error;
    return { ok: true };
  });
