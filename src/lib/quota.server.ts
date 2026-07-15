/**
 * Server-only subscription + usage helpers. `.server.ts` filename keeps this
 * out of every client bundle, so a direct import of `client.server` is safe.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type UsageKind = "ai_credits" | "emails" | "leads_discovered";

export interface WorkspaceSub {
  workspace_id: string;
  plan_code: string;
  status: "trialing" | "active" | "past_due" | "canceled";
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  plan: {
    code: string;
    name: string;
    price_usd_monthly: number;
    leads_monthly: number;
    ai_credits_monthly: number;
    emails_monthly: number;
  };
}

/** Resolves the workspace a user is currently operating in. */
export async function getActiveWorkspaceIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("business_profiles")
    .select("active_workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.active_workspace_id) return data.active_workspace_id;
  const { data: m } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return m?.workspace_id ?? null;
}

export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSub | null> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "workspace_id, plan_code, status, current_period_start, current_period_end, trial_end, plans(code, name, price_usd_monthly, leads_monthly, ai_credits_monthly, emails_monthly)",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data || !(data as any).plans) return null;
  return { ...(data as any), plan: (data as any).plans } as WorkspaceSub;
}

export interface QuotaCheck {
  ok: boolean;
  used: number;
  limit: number;
  remaining: number;
  message?: string;
}

const LIMIT_COL: Record<UsageKind, "leads_monthly" | "ai_credits_monthly" | "emails_monthly"> = {
  leads_discovered: "leads_monthly",
  ai_credits: "ai_credits_monthly",
  emails: "emails_monthly",
};

const USED_COL: Record<UsageKind, "leads_discovered_used" | "ai_credits_used" | "emails_used"> = {
  leads_discovered: "leads_discovered_used",
  ai_credits: "ai_credits_used",
  emails: "emails_used",
};

const LABEL: Record<UsageKind, string> = {
  leads_discovered: "monthly lead",
  ai_credits: "AI credit",
  emails: "email send",
};

/** Non-mutating check. Callers decide whether to abort or degrade. */
export async function checkQuota(workspaceId: string, kind: UsageKind, amount = 1): Promise<QuotaCheck> {
  const sub = await getWorkspaceSubscription(workspaceId);
  if (!sub) return { ok: false, used: 0, limit: 0, remaining: 0, message: "No active subscription" };
  if (sub.status === "canceled") return { ok: false, used: 0, limit: 0, remaining: 0, message: "Subscription canceled" };
  if (sub.status === "past_due")
    return { ok: false, used: 0, limit: 0, remaining: 0, message: "Subscription past due — update billing to continue." };

  const limit = sub.plan[LIMIT_COL[kind]];
  const { data: counter } = await supabaseAdmin
    .from("usage_counters")
    .select("ai_credits_used, emails_used, leads_discovered_used")
    .eq("workspace_id", workspaceId)
    .eq("period_start", sub.current_period_start)
    .maybeSingle();
  const used = (counter?.[USED_COL[kind]] ?? 0) as number;
  const remaining = Math.max(0, limit - used);
  if (used + amount > limit) {
    return {
      ok: false,
      used,
      limit,
      remaining,
      message: `${LABEL[kind]} limit reached (${used}/${limit}). Upgrade your plan to continue.`,
    };
  }
  return { ok: true, used, limit, remaining };
}

export async function recordUsage(
  workspaceId: string,
  patch: { ai?: number; emails?: number; leads?: number },
) {
  const sub = await getWorkspaceSubscription(workspaceId);
  if (!sub) return;
  await supabaseAdmin.rpc("increment_usage", {
    _workspace_id: workspaceId,
    _period_start: sub.current_period_start,
    _period_end: sub.current_period_end,
    _ai: patch.ai ?? 0,
    _emails: patch.emails ?? 0,
    _leads: patch.leads ?? 0,
  });
}

/** 1 AI credit ≈ 100 tokens (rough). Used to convert generateText usage → billed credits. */
export function estimateAiCredits(tokens: number): number {
  return Math.max(1, Math.ceil(tokens / 100));
}
