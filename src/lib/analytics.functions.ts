import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [leads, sends, replies, drafts] = await Promise.all([
      context.supabase
        .from("leads")
        .select("id, status, won_mrr_cents", { count: "exact" })
        .eq("user_id", context.userId),
      context.supabase
        .from("email_sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId),
      context.supabase
        .from("inbound_messages")
        .select("id, classification", { count: "exact" })
        .eq("user_id", context.userId),
      context.supabase
        .from("email_drafts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("status", "pending_approval"),
    ]);

    const totalLeads = leads.count ?? 0;
    const sent = sends.count ?? 0;
    const replied = replies.count ?? 0;
    const positive = (replies.data ?? []).filter((r) => r.classification === "interested").length;
    const pending = drafts.count ?? 0;
    const wonLeads = (leads.data ?? []).filter((l) => l.status === "won");
    const closedMrrCents = wonLeads.reduce((s, l) => s + (l.won_mrr_cents ?? 0), 0);

    // Real MRR / LTV from Platform webhook events for the active workspace
    const { getActiveWorkspaceIdForUser } = await import("./quota.server");
    const wsId = await getActiveWorkspaceIdForUser(context.userId);
    let mrrCents = 0;
    let ltvCents = 0;
    if (wsId) {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: rev } = await context.supabase
        .from("revenue_events")
        .select("type, amount_cents, occurred_at")
        .eq("workspace_id", wsId)
        .gte("occurred_at", since);
      const activations = (rev ?? []).filter((r) => r.type === "activation");
      const renewals = (rev ?? []).filter((r) => r.type === "renewal");
      mrrCents = activations.reduce((s, r) => s + r.amount_cents, 0);
      ltvCents =
        activations.reduce((s, r) => s + r.amount_cents, 0) +
        renewals.reduce((s, r) => s + r.amount_cents, 0);
    }

    return {
      totalLeads,
      sent,
      replied,
      positive,
      pending,
      wonCount: wonLeads.length,
      mrrUsd: Math.round(mrrCents / 100),
      closedMrrUsd: Math.round(closedMrrCents / 100),
      ltvUsd: Math.round(ltvCents / 100),
      replyRate: sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0,
      positiveRate: sent > 0 ? Math.round((positive / sent) * 1000) / 10 : 0,
      conversionRate: totalLeads > 0 ? Math.round((wonLeads.length / totalLeads) * 1000) / 10 : 0,
      byStatus: (leads.data ?? []).reduce<Record<string, number>>((acc, l) => {
        acc[l.status] = (acc[l.status] ?? 0) + 1;
        return acc;
      }, {}),
    };
  });
