import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Inbound email webhook: receives replies from the email provider,
 * matches to a lead by from-address or reply-to-message-id, then
 * runs classification + suggested reply and cancels remaining
 * queued follow-ups for that lead.
 *
 * Provider should POST JSON: { from, to, subject, text, in_reply_to?, message_id? }
 */
const Payload = z.object({
  from: z.string().email(),
  to: z.string().optional(),
  subject: z.string().optional().default(""),
  text: z.string().optional().default(""),
  html: z.string().optional(),
  in_reply_to: z.string().optional(),
  message_id: z.string().optional(),
});

export const Route = createFileRoute("/api/public/webhooks/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = Payload.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const msg = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Match lead: first by in_reply_to -> email_sends.provider_message_id
        let lead: { id: string; user_id: string; business_name: string | null; niche: string | null; website: string | null } | null = null;
        let inReplyToSendId: string | null = null;

        if (msg.in_reply_to) {
          const { data: send } = await supabaseAdmin
            .from("email_sends")
            .select("id, lead_id, user_id, leads(id, user_id, business_name, niche, website)")
            .eq("provider_message_id", msg.in_reply_to)
            .maybeSingle();
          if (send) {
            inReplyToSendId = send.id;
            lead = (send as any).leads;
          }
        }

        // Fallback: match by from address
        if (!lead) {
          const { data: found } = await supabaseAdmin
            .from("leads")
            .select("id, user_id, business_name, niche, website")
            .ilike("email", msg.from)
            .limit(1)
            .maybeSingle();
          if (found) lead = found;
        }

        if (!lead) {
          // Unknown sender — store as orphan under first user? Skip instead.
          return Response.json({ status: "unmatched" });
        }

        // Classify + suggest reply
        const { classifyAndSuggest } = await import("@/lib/reply-ai.server");
        let classification = "unknown";
        let suggested_reply = "";
        let suggested_stage: string | null = null;
        let stage_reason: string | null = null;
        try {
          const out = await classifyAndSuggest({
            userId: lead.user_id,
            leadBusiness: lead.business_name ?? lead.website ?? "the prospect",
            replyText: msg.text || (msg.html ? msg.html.replace(/<[^>]+>/g, " ") : ""),
            replySubject: msg.subject,
          });
          classification = out.classification;
          suggested_reply = out.suggested_reply;
          suggested_stage = out.suggested_stage;
          stage_reason = out.stage_reason;
        } catch (e) {
          console.error("Classifier failed", e);
        }

        await supabaseAdmin.from("inbound_messages").insert({
          user_id: lead.user_id,
          lead_id: lead.id,
          from_email: msg.from,
          subject: msg.subject,
          body: msg.text || msg.html || "",
          classification,
          suggested_reply,
          reply_status: "pending_review",
          in_reply_to_send_id: inReplyToSendId,
        });

        // Stop remaining follow-ups
        await supabaseAdmin
          .from("outbound_queue")
          .update({ status: "cancelled", last_error: "Lead replied" })
          .eq("lead_id", lead.id)
          .eq("status", "queued");

        // Apply AI-suggested stage; fall back to "replied"
        const nextStage = suggested_stage ?? "replied";
        await supabaseAdmin
          .from("leads")
          .update({
            status: nextStage,
            ai_stage_reason: stage_reason,
            stage_updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id);

        return Response.json({ status: "ok", classification, stage: nextStage });
      },
    },
  },
});
