import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [leads, sends, replies, drafts] = await Promise.all([
      context.supabase.from("leads").select("id, status", { count: "exact" }).eq("user_id", context.userId),
      context.supabase.from("email_sends").select("id", { count: "exact", head: true }).eq("user_id", context.userId),
      context.supabase.from("inbound_messages").select("id, classification", { count: "exact" }).eq("user_id", context.userId),
      context.supabase.from("email_drafts").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("status", "pending_approval"),
    ]);

    const totalLeads = leads.count ?? 0;
    const sent = sends.count ?? 0;
    const replied = replies.count ?? 0;
    const positive = (replies.data ?? []).filter((r) => r.classification === "interested").length;
    const pending = drafts.count ?? 0;

    return {
      totalLeads,
      sent,
      replied,
      positive,
      pending,
      replyRate: sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0,
      positiveRate: sent > 0 ? Math.round((positive / sent) * 1000) / 10 : 0,
      byStatus: (leads.data ?? []).reduce<Record<string, number>>((acc, l) => {
        acc[l.status] = (acc[l.status] ?? 0) + 1;
        return acc;
      }, {}),
    };
  });
