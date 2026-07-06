import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: flushes due items from outbound_queue via Lovable Emails.
 * Scheduled via pg_cron; called with the project anon key in the `apikey` header.
 * Bypasses auth via /api/public/ prefix but we still gate on the anon key.
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
        const { sendTransactionalEmail, textToHtml } = await import("@/lib/send-email.server");

        // Pull up to 25 due items across all users
        const { data: due, error } = await supabaseAdmin
          .from("outbound_queue")
          .select("*, email_drafts(*), leads(*), business_profiles:user_id(*)")
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

          // Load sender business profile
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
            const { message_id } = await sendTransactionalEmail({
              to: lead.email,
              from: `${fromName} <${fromEmail}>`,
              subject: draft.subject,
              html: textToHtml(draft.body),
              text: draft.body,
              template_name: "cold-outreach",
              reply_to: fromEmail,
            });

            await supabaseAdmin.from("email_sends").insert({
              user_id: item.user_id,
              lead_id: item.lead_id,
              draft_id: draft.id,
              subject: draft.subject,
              body: draft.body,
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

            // Advance lead status to 'contacted' on first send
            await supabaseAdmin
              .from("leads")
              .update({ status: "contacted" })
              .eq("id", item.lead_id)
              .in("status", ["approved", "drafted", "enriched", "new"]);

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
