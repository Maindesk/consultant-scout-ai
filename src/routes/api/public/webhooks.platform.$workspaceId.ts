import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Simvoly / Maindesk Platform webhook receiver.
 *
 * URL configured in the WL admin panel:
 *   https://<domain>/api/public/webhooks/platform/<workspace_id>
 *
 * Signature: `X-Webhook-Signature` = HMAC-SHA512(raw_body, workspace.webhook_secret), hex.
 * Payload matched to a lead via `lead_platform_sites.project_id`.
 */
export const Route = createFileRoute("/api/public/webhooks/platform/$workspaceId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const workspaceId = params.workspaceId;
        const signature =
          request.headers.get("x-webhook-signature") ??
          request.headers.get("x-simvoly-signature") ??
          "";
        const bodyText = await request.text();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { decryptSecret } = await import("@/lib/workspace-crypto.server");

        const { data: ws } = await supabaseAdmin
          .from("workspaces")
          .select("id, webhook_secret_ciphertext")
          .eq("id", workspaceId)
          .maybeSingle();

        if (!ws?.webhook_secret_ciphertext) {
          return new Response("Webhook secret not configured", { status: 401 });
        }

        const secret = decryptSecret(ws.webhook_secret_ciphertext);
        const expected = createHmac("sha512", secret).update(bodyText).digest("hex");

        let good = false;
        try {
          const sigBuf = Buffer.from(signature, "hex");
          const expBuf = Buffer.from(expected, "hex");
          good = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
        } catch {
          good = false;
        }
        if (!good) {
          await supabaseAdmin.from("platform_events").insert({
            workspace_id: ws.id,
            topic: "invalid_signature",
            payload: { raw: bodyText.slice(0, 500) },
            handled: false,
            error: "bad signature",
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any = {};
        try {
          payload = JSON.parse(bodyText);
        } catch {
          payload = { raw: bodyText.slice(0, 500) };
        }

        const topic: string = payload.topic ?? payload.event ?? payload.type ?? "unknown";
        await supabaseAdmin.from("platform_events").insert({
          workspace_id: ws.id,
          topic,
          payload,
          handled: false,
        });

        const projectId =
          payload?.data?.project?.id ??
          payload?.data?.projectId ??
          payload?.projectId ??
          null;

        let leadId: string | null = null;
        if (projectId) {
          const { data: site } = await supabaseAdmin
            .from("lead_platform_sites")
            .select("lead_id")
            .eq("project_id", String(projectId))
            .maybeSingle();
          leadId = site?.lead_id ?? null;
        }

        const amountCents = Math.round(
          Number(
            payload?.data?.amount ??
              payload?.data?.subscription?.amount ??
              payload?.amount ??
              0,
          ) * 100,
        );
        const currency: string = payload?.data?.currency ?? payload?.currency ?? "USD";
        const planName: string | null = payload?.data?.plan?.name ?? payload?.data?.planName ?? null;
        const planId: string | null = payload?.data?.plan?.id ?? payload?.data?.planId ?? null;
        const period: string | null = payload?.data?.plan?.period ?? payload?.data?.period ?? null;
        const externalSubId: string | null =
          payload?.data?.subscription?.id ?? payload?.data?.subscriptionId ?? null;

        try {
          if (topic === "subscription_activated" || topic === "subscription.activated") {
            if (leadId) {
              await supabaseAdmin
                .from("leads")
                .update({
                  status: "won",
                  stage_updated_at: new Date().toISOString(),
                  won_mrr_cents: amountCents,
                  won_period: period,
                  won_at: new Date().toISOString(),
                  ai_stage_reason: "Subscription activated (Platform webhook)",
                })
                .eq("id", leadId);
            }
            await supabaseAdmin.from("revenue_events").insert({
              workspace_id: ws.id,
              lead_id: leadId,
              type: "activation",
              amount_cents: amountCents,
              currency,
              plan_id: planId,
              plan_name: planName,
              period,
              external_subscription_id: externalSubId,
            });
          } else if (topic === "subscription_renewed" || topic === "subscription.renewed") {
            await supabaseAdmin.from("revenue_events").insert({
              workspace_id: ws.id,
              lead_id: leadId,
              type: "renewal",
              amount_cents: amountCents,
              currency,
              plan_id: planId,
              plan_name: planName,
              period,
              external_subscription_id: externalSubId,
            });
          } else if (
            topic === "subscription_expired" ||
            topic === "subscription.canceled" ||
            topic === "trial_expired"
          ) {
            if (leadId) {
              await supabaseAdmin
                .from("leads")
                .update({
                  status: "lost",
                  stage_updated_at: new Date().toISOString(),
                  ai_stage_reason: `${topic} (Platform webhook)`,
                })
                .eq("id", leadId);
            }
            await supabaseAdmin.from("revenue_events").insert({
              workspace_id: ws.id,
              lead_id: leadId,
              type: "expired",
              amount_cents: 0,
              currency,
              plan_name: planName,
              period,
              external_subscription_id: externalSubId,
            });
          }

          await supabaseAdmin
            .from("platform_events")
            .update({ handled: true })
            .eq("workspace_id", ws.id)
            .eq("topic", topic)
            .order("received_at", { ascending: false })
            .limit(1);
        } catch (e) {
          await supabaseAdmin.from("platform_events").insert({
            workspace_id: ws.id,
            topic: `${topic}:error`,
            payload,
            handled: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
