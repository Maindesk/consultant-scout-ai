import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getLovableGateway, WRITE_MODEL } from "./ai-gateway.server";

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/[\[\{][\s\S]*[\]\}]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error("Could not parse AI response as JSON");
}

const DAY_OFFSETS = [0, 3, 7, 14];
const SequenceSchema = z.object({
  emails: z.array(
    z.object({
      step_number: z.number(),
      day_offset: z.number(),
      subject: z.string(),
      body: z.string(),
    }),
  ),
});

function normalizeEmails(parsed: unknown): unknown {
  const emails = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as any)?.emails)
      ? (parsed as any).emails
      : [];
  return {
    emails: emails.map((e: any, i: number) => ({
      step_number: typeof e?.step_number === "number" ? e.step_number : i + 1,
      day_offset: typeof e?.day_offset === "number" ? e.day_offset : (DAY_OFFSETS[i] ?? i * 3),
      subject: String(e?.subject ?? ""),
      body: String(e?.body ?? ""),
    })),
  };
}

export const listPendingDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_drafts")
      .select("*, leads(id, business_name, website, email, niche)")
      .eq("user_id", context.userId)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const draftEmailsForLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string; tone?: string; goal?: string }) => d)
  .handler(async ({ context, data }) => {
    const [{ data: lead }, { data: enrichment }, { data: bp }] = await Promise.all([
      context.supabase.from("leads").select("*").eq("id", data.lead_id).eq("user_id", context.userId).single(),
      context.supabase.from("lead_enrichments").select("*").eq("lead_id", data.lead_id).maybeSingle(),
      context.supabase.from("business_profiles").select("*").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (!lead) throw new Error("Lead not found");
    if (!bp) throw new Error("Complete your business profile first");

    const tone = data.tone ?? "professional";
    const goal = data.goal ?? (bp as any).default_email_goal ?? "book_meeting";
    const { goalFraming, EMAIL_GOAL_LABELS } = await import("./email-goals");
    const { getActiveWorkspaceIdForUser, checkQuota, recordUsage, estimateAiCredits } = await import("./quota.server");
    const workspaceId = await getActiveWorkspaceIdForUser(context.userId);
    if (workspaceId) {
      const q = await checkQuota(workspaceId, "ai_credits", 10);
      if (!q.ok) throw new Error(q.message ?? "AI credit quota exceeded");
    }

    const gateway = getLovableGateway();
    const tools = (enrichment as any)?.website_signals?.tools ?? [];
    const gaps = (enrichment as any)?.website_signals?.gaps ?? [];
    let output: z.infer<typeof SequenceSchema>;
    let usage: { totalTokens?: number } | undefined;
    try {
    const r = await generateText({
      model: gateway(WRITE_MODEL),
      output: Output.object({ schema: SequenceSchema }),
      prompt: `You are writing a highly personalized cold outreach sequence from ${bp.sender_name ?? "the sender"} to a ${lead.niche ?? "business owner"}.

The angle is NOT selling a single feature. The angle is: their current website platform (${lead.platform ?? "their current builder"}) forces them to duct-tape together many 3rd-party tools (calendar, email capture, chat, payments, memberships, funnels, etc.), which fragments their brand, hurts performance, and quietly costs them money every month in overlapping subscriptions. Our platform replaces that stack with one on-brand, all-in-one solution.

Sender platform:
- Summary: ${bp.ai_summary ?? bp.offer_description ?? ""}
- Value proposition: ${bp.value_proposition ?? ""}
- Ideal client: ${bp.ideal_client ?? ""}
- Native platform capabilities (things WE ship out of the box, so leads can drop the equivalent 3rd-party tools):
${(bp as any).product_capabilities ?? "(none provided)"}

Prospect:
- Name/business: ${lead.business_name ?? lead.domain}
- Website: ${lead.website}
- Current platform: ${lead.platform ?? "unknown"}
- Business summary: ${enrichment?.business_summary ?? ""}
- Their offer: ${enrichment?.offer ?? ""}
- Their audience: ${enrichment?.target_audience ?? ""}
- Pain points detected: ${JSON.stringify(enrichment?.pain_points ?? [])}
- Embedded 3rd-party tools stitched onto their site: ${JSON.stringify(tools)}
- Website gaps: ${JSON.stringify(gaps)}
- Page perf: ${JSON.stringify((enrichment as any)?.website_signals?.performance ?? {})}

Campaign goal: ${EMAIL_GOAL_LABELS[goal as keyof typeof EMAIL_GOAL_LABELS] ?? goal}
${goalFraming(goal)}

Write a 4-email sequence: initial + 3 follow-ups.
- Tone: ${tone}
- The pitch is a PLATFORM SWITCH, not a feature. Never sell one capability in isolation.
- Email 1: name 2-3 specific 3rd-party tools you detected on their site, add them up as "stack sprawl" (fragmented brand + monthly cost + slower site), and position our platform as the consolidated on-brand replacement. Reference the detected native capabilities to show the switch is a superset, not a downgrade.
- Email 2: quantify the drag — overlapping subscriptions, brand inconsistency across embedded widgets, perf hit; hint at what their site could look/feel like unified.
- Email 3: proof / short story of a similar business that moved off ${lead.platform ?? "a similar builder"} and consolidated, or address the obvious "switching is painful" objection (migration is handled). If a personalized demo edit link will be inserted, hint that a preview site tailored to their brand is ready to explore (do NOT invent a URL — the placeholder {{DEMO_LINK}} will be substituted at send time).
- Email 4: soft break-up matching the campaign goal.
- If no tools were detected, lead with the gap + platform-limitation angle instead of naming tools.
- Each email under 130 words. Day offsets: 0, 3, 7, 14. Subject under 60 chars. CTA in every email matches the campaign goal above.`,

    });
      output = r.output;
      usage = r.usage;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        const parsed = extractJson(err.text ?? "");
        output = SequenceSchema.parse(normalizeEmails(parsed));
        usage = err.usage as any;
      } else {
        throw err;
      }
    }
    if (workspaceId) await recordUsage(workspaceId, { ai: estimateAiCredits(usage?.totalTokens ?? 0) });




    // Delete previous pending drafts
    await context.supabase
      .from("email_drafts")
      .delete()
      .eq("lead_id", lead.id)
      .eq("user_id", context.userId)
      .in("status", ["pending_approval", "rejected"]);

    const rows = output.emails.map((e) => ({
      user_id: context.userId,
      lead_id: lead.id,
      step_number: e.step_number,
      day_offset: e.day_offset,
      subject: e.subject,
      body: e.body,
      tone,
      status: "pending_approval",
    }));

    const { error } = await context.supabase.from("email_drafts").insert(rows);
    if (error) throw error;

    await context.supabase.from("leads").update({ status: "drafted" }).eq("id", lead.id);
    return { count: rows.length };
  });

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; subject?: string; body?: string }) => d)
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("email_drafts")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setDraftStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "approved" | "rejected" | "pending_approval" }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("email_drafts")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const approveLeadSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string }) => d)
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("email_drafts")
      .update({ status: "approved" })
      .eq("lead_id", data.lead_id)
      .eq("user_id", context.userId);
    await context.supabase.from("leads").update({ status: "approved" }).eq("id", data.lead_id);

    // Schedule into outbound queue
    const { data: drafts } = await context.supabase
      .from("email_drafts")
      .select("*")
      .eq("lead_id", data.lead_id)
      .eq("user_id", context.userId)
      .order("step_number");

    const now = new Date();
    const rows = (drafts ?? []).map((d) => ({
      user_id: context.userId,
      draft_id: d.id,
      lead_id: data.lead_id,
      scheduled_at: new Date(now.getTime() + d.day_offset * 24 * 60 * 60 * 1000).toISOString(),
      status: "queued",
    }));
    if (rows.length) await context.supabase.from("outbound_queue").insert(rows);
    return { queued: rows.length };
  });
