import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: flushes due items from outbound_queue via Lovable Emails.
 * Scheduled via pg_cron; called with the project anon key in the `apikey` header.
 * Bypasses auth via /api/public/ prefix but we still gate on the anon key.
 *
 * Metering: each successful send debits the workspace's email quota. A queue
 * item whose workspace is out of email quota (or has a canceled subscription)
 * is marked failed with a clear message rather than silently skipped.
 */
export const Route = createFileRoute("/api/public/cron/send-outbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apikey = request.headers.get("apikey");
        if (!anon || apikey !== anon) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWithWorkspaceProvider } = await import("@/lib/email-provider.server");
        const { textToHtml } = await import("@/lib/send-email.server");
        const { getActiveWorkspaceIdForUser, checkQuota, recordUsage } = await import("@/lib/quota.server");

        const { data: due, error } = await supabaseAdmin
          .from("outbound_queue")
          .select("*, email_drafts(*), leads(*)")
          .eq("status", "queued")
          .lte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(25);

        if (error) return Response.json({ error: error.message }, { status: 500 });

        const results: Array<{ id: string; ok: boolean; error?: string }> = [];

        for (const item of due ?? []) {
          const draft = (item as any).email_drafts;
          const lead = (item as any).leads;
          if (!draft || !lead?.email) {
            await supabaseAdmin
              .from("outbound_queue")
              .update({ status: "failed", last_error: "Missing draft or lead email" })
              .eq("id", item.id);
            results.push({ id: item.id, ok: false, error: "missing draft/email" });
            continue;
          }

          const workspaceId =
            (item as any).workspace_id ?? (await getActiveWorkspaceIdForUser(item.user_id));
          if (!workspaceId) {
            await supabaseAdmin
              .from("outbound_queue")
              .update({ status: "failed", last_error: "No workspace resolved for user" })
              .eq("id", item.id);
            results.push({ id: item.id, ok: false, error: "no workspace" });
            continue;
          }

          // Enforce email quota before sending
          const quota = await checkQuota(workspaceId, "emails", 1);
          if (!quota.ok) {
            await supabaseAdmin
              .from("outbound_queue")
              .update({ status: "failed", last_error: quota.message ?? "Email quota exceeded" })
              .eq("id", item.id);
            results.push({ id: item.id, ok: false, error: "quota" });
            continue;
          }

          const { data: bp } = await supabaseAdmin
            .from("business_profiles")
            .select("sender_name, sender_email")
            .eq("user_id", item.user_id)
            .maybeSingle();

          const fromName = bp?.sender_name ?? "Outreach";
          const fromEmail = bp?.sender_email;
          if (!fromEmail) {
            await supabaseAdmin
              .from("outbound_queue")
              .update({ status: "failed", last_error: "No sender_email in business profile" })
              .eq("id", item.id);
            results.push({ id: item.id, ok: false, error: "no sender_email" });
            continue;
          }

          try {
            // Optional: on email step 3, inject a fresh 15-min SSO edit link for
            // the lead's personalized demo site (auto-provisions if none exists).
            const subject = draft.subject as string;
            let bodyText = draft.body as string;

            if (draft.step_number === 3) {
              const { data: settings } = await supabaseAdmin
                .from("automation_settings")
                .select("auto_insert_sso_in_email3, auto_provision_demo")
                .eq("user_id", item.user_id)
                .maybeSingle();
              if (settings?.auto_insert_sso_in_email3) {
                try {
                  const demoUrl = await ensureDemoSiteAndSsoLink({
                    userId: item.user_id,
                    workspaceId,
                    leadId: item.lead_id,
                    autoProvision: !!settings.auto_provision_demo,
                  });
                  if (demoUrl) {
                    if (bodyText.includes("{{DEMO_LINK}}")) {
                      bodyText = bodyText.replaceAll("{{DEMO_LINK}}", demoUrl);
                    } else {
                      bodyText = `${bodyText}\n\nP.S. I put together a personalized preview of what your site could look like on our platform — one-click edit (link expires in 15 min): ${demoUrl}`;
                    }
                  }
                } catch (e) {
                  console.error("SSO injection failed", e);
                }
              }
            }

            const { message_id } = await sendWithWorkspaceProvider(workspaceId, {
              to: lead.email,
              subject,
              html: textToHtml(bodyText),
              text: bodyText,
              reply_to: fromEmail,
              headers: {
                "X-PixelOutreach-Template": "cold-outreach",
                "X-PixelOutreach-From-Name": fromName,
              },
            });


            await supabaseAdmin.from("email_sends").insert({
              user_id: item.user_id,
              lead_id: item.lead_id,
              draft_id: draft.id,
              subject,
              body: bodyText,
              provider_message_id: message_id,
              status: "sent",
            });


            await supabaseAdmin
              .from("outbound_queue")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", item.id);

            await supabaseAdmin
              .from("email_drafts")
              .update({ status: "sent" })
              .eq("id", draft.id);

            await supabaseAdmin
              .from("leads")
              .update({ status: "contacted" })
              .eq("id", item.lead_id)
              .in("status", ["approved", "drafted", "enriched", "new"]);

            await recordUsage(workspaceId, { emails: 1 });
            results.push({ id: item.id, ok: true });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const attempts = (item.attempts ?? 0) + 1;
            await supabaseAdmin
              .from("outbound_queue")
              .update({
                status: attempts >= 3 ? "failed" : "queued",
                attempts,
                last_error: msg,
              })
              .eq("id", item.id);
            results.push({ id: item.id, ok: false, error: msg });
          }
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
});

/**
 * Ensures the lead has a demo site on the workspace's WL platform and
 * mints a fresh 15-minute SSO edit URL. Returns null if the workspace
 * has no Platform API creds or provisioning fails.
 */
async function ensureDemoSiteAndSsoLink(input: {
  userId: string;
  workspaceId: string;
  leadId: string;
  autoProvision: boolean;
}): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("platform_wl_domain, platform_client_key_ciphertext")
    .eq("id", input.workspaceId)
    .maybeSingle();
  if (!ws?.platform_wl_domain || !ws.platform_client_key_ciphertext) return null;

  let { data: site } = await supabaseAdmin
    .from("lead_platform_sites")
    .select("*")
    .eq("lead_id", input.leadId)
    .maybeSingle();

  if (!site && input.autoProvision) {
    const [{ data: lead }, { data: enrichment }] = await Promise.all([
      supabaseAdmin.from("leads").select("*").eq("id", input.leadId).maybeSingle(),
      supabaseAdmin.from("lead_enrichments").select("*").eq("lead_id", input.leadId).maybeSingle(),
    ]);
    if (!lead) return null;
    const businessName = lead.business_name ?? lead.domain ?? "Prospect";
    const email = lead.email ?? `demo+${lead.id}@example.com`;
    const tags: Record<string, string> = {
      business_name: businessName,
      offer: (enrichment?.offer ?? "").slice(0, 200),
      audience: (enrichment?.target_audience ?? "").slice(0, 200),
      brand_color: ((enrichment as any)?.website_signals?.brand_color ?? "") as string,
    };
    try {
      const { createProjectWithWebsite } = await import("@/lib/platform-api.server");
      const result: any = await createProjectWithWebsite({
        workspaceId: input.workspaceId,
        externalCustomerId: lead.id,
        email,
        name: businessName,
        websiteName: `${businessName} demo`,
        personalizationTags: tags,
      });
      const projectId = result?.project?.id ?? result?.data?.projectId ?? "";
      const websiteId = result?.website?.id ?? result?.data?.websiteId ?? null;
      const subdomain = result?.website?.subdomain ?? result?.data?.subdomain ?? null;
      const { data: row } = await supabaseAdmin
        .from("lead_platform_sites")
        .insert({
          lead_id: lead.id,
          workspace_id: input.workspaceId,
          project_id: String(projectId),
          website_id: websiteId ? String(websiteId) : null,
          subdomain,
          personalization_tags: tags,
        })
        .select()
        .single();
      site = row ?? null;
    } catch (e) {
      console.error("auto-provision failed", e);
      return null;
    }
  }

  if (!site) return null;

  try {
    const { createSsoSession } = await import("@/lib/platform-api.server");
    const sso: any = await createSsoSession(site.workspace_id, input.userId, site.project_id);
    const url: string | null = sso?.accessUrl ?? sso?.url ?? sso?.data?.accessUrl ?? null;
    if (url) {
      await supabaseAdmin
        .from("lead_platform_sites")
        .update({ edit_sso_url: url, sso_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
        .eq("id", site.id);
    }
    return url;
  } catch (e) {
    console.error("SSO mint failed", e);
    return null;
  }
}

