import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden — super-admin only");
}

export const getIsSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { is_super_admin: !!data };
  });

/**
 * Bootstrap helper: if the super_admins table is empty, the first caller
 * becomes the platform owner. After that this is a no-op. This exists so the
 * project owner can promote themselves without hand-editing the database.
 */
export const claimFirstSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("super_admins")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { claimed: false, reason: "already_claimed" };
    const { error } = await supabaseAdmin
      .from("super_admins")
      .insert({ user_id: context.userId });
    if (error) throw error;
    return { claimed: true };
  });

export const listAllTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: workspaces } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, slug, owner_id, created_at")
      .order("created_at", { ascending: false });
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("workspace_id, plan_code, status, current_period_end, trial_end");
    const { data: plans } = await supabaseAdmin.from("plans").select("code, price_usd_monthly");
    const priceByCode = new Map((plans ?? []).map((p) => [p.code, p.price_usd_monthly]));
    const subByWs = new Map((subs ?? []).map((s) => [s.workspace_id, s]));

    let totalMrr = 0;
    const rows = (workspaces ?? []).map((w) => {
      const s = subByWs.get(w.id);
      const price = s ? priceByCode.get(s.plan_code) ?? 0 : 0;
      if (s?.status === "active") totalMrr += price;
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        owner_id: w.owner_id,
        created_at: w.created_at,
        plan_code: s?.plan_code ?? null,
        status: (s?.status ?? "none") as string,
        price_usd_monthly: price,
        period_end: s?.current_period_end ?? null,
      };
    });
    return {
      workspaces: rows,
      total_mrr_usd: totalMrr,
      active_count: rows.filter((r) => r.status === "active").length,
      trialing_count: rows.filter((r) => r.status === "trialing").length,
    };
  });

export const listAllRevenue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("revenue_events")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const setPlanForWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspace_id: string; plan_code: string; status?: "active" | "trialing" | "canceled" }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_code: data.plan_code,
        status: data.status ?? "active",
        current_period_start: now.toISOString(),
        current_period_end: new Date(now.getTime() + 30 * 86400000).toISOString(),
        canceled_at: data.status === "canceled" ? now.toISOString() : null,
      })
      .eq("workspace_id", data.workspace_id);
    return { ok: true };
  });
