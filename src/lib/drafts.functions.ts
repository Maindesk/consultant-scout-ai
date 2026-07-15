import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getLovableGateway, CHAT_MODEL } from "./ai-gateway.server";

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
    const gateway = getLovableGateway();
    const tools = (enrichment as any)?.website_signals?.tools ?? [];
    const gaps = (enrichment as any)?.website_signals?.gaps ?? [];
    const { output } = await generateText({
      model: gateway(CHAT_MODEL),
      output: Output.object({ schema: SequenceSchema }),
      prompt: `You are writing a highly personalized cold outreach sequence from ${bp.sender_name ?? "the sender"} to a ${lead.niche ?? "coach/consultant"}.

Sender business:
- Summary: ${bp.ai_summary ?? bp.offer_description ?? ""}
- Value proposition: ${bp.value_proposition ?? ""}
- Ideal client: ${bp.ideal_client ?? ""}
- Product capabilities (features WE offer natively — use these as alternatives to the prospect's embedded 3rd-party tools):
${(bp as any).product_capabilities ?? "(none provided)"}

Prospect:
- Name/business: ${lead.business_name ?? lead.domain}
- Website: ${lead.website}
- Business summary: ${enrichment?.business_summary ?? ""}
- Their offer: ${enrichment?.offer ?? ""}
- Their audience: ${enrichment?.target_audience ?? ""}
- Pain points detected: ${JSON.stringify(enrichment?.pain_points ?? [])}
- Embedded 3rd-party tools on their site: ${JSON.stringify(tools)}
- Website gaps: ${JSON.stringify(gaps)}
- Page perf: ${JSON.stringify((enrichment as any)?.website_signals?.performance ?? {})}

Campaign goal: ${EMAIL_GOAL_LABELS[goal as keyof typeof EMAIL_GOAL_LABELS] ?? goal}
${goalFraming(goal)}

Write a 4-email sequence: initial + 3 follow-ups.
- Tone: ${tone}
- The FIRST email MUST reference ONE specific detected tool on their site AND pitch our matching product capability as the native alternative. Example pattern: "I noticed you embed Calendly on your booking page — our platform ships booking & appointments right out of the box, which keeps your site fully on-brand and strengthens brand perception for new visitors."
- If no relevant tool matches a capability, reference a website gap instead.
- Tie their pain point to the sender's value prop.
- Each email under 120 words. Day offsets: 0, 3, 7, 14. Subject under 60 chars.
- CTA in every email must match the campaign goal above.`,
    });

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
