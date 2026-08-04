/**
 * Pre-overage usage alerts.
 *
 * After usage is recorded we compare the workspace's lead consumption against
 * its plan allowance. When it crosses the configured threshold (default 80%)
 * — and again at 100%, the moment overage billing starts — we notify the
 * workspace once per threshold per billing period.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { WorkspaceSub } from "./quota.server";

export interface UsageAlertPrefs {
  enabled: boolean;
  threshold_pct: number;
  email: string | null;
  last_pct: number;
  period_start: string | null;
}

export async function loadUsageAlertPrefs(workspaceId: string): Promise<UsageAlertPrefs | null> {
  const { data } = await supabaseAdmin
    .from("workspaces")
    .select(
      "usage_alert_enabled, usage_alert_threshold_pct, usage_alert_email, usage_alert_last_pct, usage_alert_period_start",
    )
    .eq("id", workspaceId)
    .maybeSingle();
  if (!data) return null;
  return {
    enabled: data.usage_alert_enabled,
    threshold_pct: data.usage_alert_threshold_pct,
    email: data.usage_alert_email,
    last_pct: data.usage_alert_last_pct,
    period_start: data.usage_alert_period_start,
  };
}

function body(pct: number, used: number, limit: number, sub: WorkspaceSub) {
  const overageRate = ((sub.plan.overage_price_cents_per_lead ?? 0) / 100).toFixed(2);
  if (pct >= 100) {
    return {
      subject: `You've used your full ${sub.plan.name} lead allowance`,
      text: sub.overage_enabled
        ? `You've used ${used} of ${limit} leads on the ${sub.plan.name} plan for this billing period.\n\nDiscovery keeps running — extra leads now bill at $${overageRate} each. Upgrade your plan any time to bring the per-lead cost down.`
        : `You've used ${used} of ${limit} leads on the ${sub.plan.name} plan for this billing period.\n\nDiscovery is paused until your period resets. Upgrade your plan or enable pay-as-you-go overage to keep going.`,
    };
  }
  return {
    subject: `You're at ${pct}% of your ${sub.plan.name} lead allowance`,
    text: `You've used ${used} of ${limit} leads (${pct}%) on the ${sub.plan.name} plan for this billing period.\n\nOnce you pass ${limit} leads, extra leads bill at $${overageRate} each. Upgrade now if you'd rather keep everything inside your plan.`,
  };
}

/** Fire-and-forget: never let an alert failure break the calling pipeline. */
export async function maybeSendUsageAlert(workspaceId: string, sub: WorkspaceSub): Promise<void> {
  try {
    const prefs = await loadUsageAlertPrefs(workspaceId);
    if (!prefs?.enabled) return;

    const limit = sub.plan.leads_monthly;
    if (!limit) return;

    const { data: counter } = await supabaseAdmin
      .from("usage_counters")
      .select("leads_discovered_used")
      .eq("workspace_id", workspaceId)
      .eq("period_start", sub.current_period_start)
      .maybeSingle();
    const used = counter?.leads_discovered_used ?? 0;
    const pct = Math.floor((used / limit) * 100);

    // Reset the ledger when a new billing period started.
    const samePeriod = prefs.period_start === sub.current_period_start;
    const lastPct = samePeriod ? prefs.last_pct : 0;

    const threshold = Math.min(99, Math.max(1, prefs.threshold_pct));
    const stage = pct >= 100 ? 100 : pct >= threshold ? threshold : 0;
    if (stage === 0 || stage <= lastPct) {
      if (!samePeriod) {
        await supabaseAdmin
          .from("workspaces")
          .update({ usage_alert_last_pct: 0, usage_alert_period_start: sub.current_period_start })
          .eq("id", workspaceId);
      }
      return;
    }

    const to = prefs.email ?? (await fallbackEmail(workspaceId));
    if (to) {
      const { subject, text } = body(pct, used, limit, sub);
      const { sendWithWorkspaceProvider } = await import("./email-provider.server");
      const { textToHtml } = await import("./send-email.server");
      await sendWithWorkspaceProvider(workspaceId, {
        to,
        subject,
        text,
        html: textToHtml(text),
      });
    }

    await supabaseAdmin
      .from("workspaces")
      .update({ usage_alert_last_pct: stage, usage_alert_period_start: sub.current_period_start })
      .eq("id", workspaceId);
  } catch {
    // alerts are best-effort
  }
}

async function fallbackEmail(workspaceId: string): Promise<string | null> {
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("owner_id, email_from_email")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) return null;
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(ws.owner_id);
  return user?.user?.email ?? ws.email_from_email ?? null;
}
