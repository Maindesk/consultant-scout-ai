import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActiveWorkspaceIdForUser, getWorkspaceSubscription } = await import("./quota.server");
    const workspaceId = await getActiveWorkspaceIdForUser(context.userId);
    if (!workspaceId) return null;
    const sub = await getWorkspaceSubscription(workspaceId);
    if (!sub) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: counter } = await supabaseAdmin
      .from("usage_counters")
      .select("ai_credits_used, emails_used, leads_discovered_used, overage_leads_used")
      .eq("workspace_id", workspaceId)
      .eq("period_start", sub.current_period_start)
      .maybeSingle();
    const overageLeads = counter?.overage_leads_used ?? 0;
    return {
      workspace_id: workspaceId,
      subscription: sub,
      usage: {
        ai_credits_used: counter?.ai_credits_used ?? 0,
        emails_used: counter?.emails_used ?? 0,
        leads_discovered_used: counter?.leads_discovered_used ?? 0,
        overage_leads_used: overageLeads,
        overage_cents: overageLeads * (sub.plan.overage_price_cents_per_lead ?? 0),
      },
    };
  });

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("plans")
      .select("id, code, name, price_usd_monthly, leads_monthly, ai_credits_monthly, emails_monthly, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    return data ?? [];
  });

/**
 * Immediately switches the active workspace's plan.
 * Payment provider is NOT yet connected — once Stripe/Paddle is wired, this
 * fn should route through a checkout session and the actual switch should
 * happen in the provider's webhook handler.
 */
export const changeMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_code: string }) => d)
  .handler(async ({ context, data }) => {
    const { getActiveWorkspaceIdForUser } = await import("./quota.server");
    const workspaceId = await getActiveWorkspaceIdForUser(context.userId);
    if (!workspaceId) throw new Error("No workspace");

    const { data: mem } = await context.supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!mem || !["owner", "admin"].includes(mem.role)) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("code")
      .eq("code", data.plan_code)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) throw new Error("Unknown plan");

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86400000);
    await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_code: data.plan_code,
        status: data.plan_code === "trial" ? "trialing" : "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        canceled_at: null,
      })
      .eq("workspace_id", workspaceId);
    return { ok: true };
  });

export const cancelMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getActiveWorkspaceIdForUser } = await import("./quota.server");
    const workspaceId = await getActiveWorkspaceIdForUser(context.userId);
    if (!workspaceId) throw new Error("No workspace");
    const { data: mem } = await context.supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!mem || !["owner", "admin"].includes(mem.role)) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId);
    return { ok: true };
  });
