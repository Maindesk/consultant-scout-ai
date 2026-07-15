import { generateText, Output } from "ai";
import { z } from "zod";
import { getLovableGateway, CHAT_MODEL } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LeadStage } from "./pipeline";

const ReplySchema = z.object({
  classification: z.enum(["interested", "question", "objection", "not_interested", "out_of_office", "other"]),
  suggested_reply: z.string(),
  suggested_stage: z.enum(["in_progress", "won", "lost", "replied"]),
  stage_reason: z.string(),
});

export interface ClassificationResult {
  classification: string;
  suggested_reply: string;
  suggested_stage: LeadStage;
  stage_reason: string;
}

export async function classifyAndSuggest(input: {
  userId: string;
  leadBusiness: string;
  replyText: string;
  replySubject?: string;
}): Promise<ClassificationResult> {
  const { data: bp } = await supabaseAdmin
    .from("business_profiles")
    .select("sender_name, ai_summary, offer_description, value_proposition")
    .eq("user_id", input.userId)
    .maybeSingle();

  const gateway = getLovableGateway();
  const { output } = await generateText({
    model: gateway(CHAT_MODEL),
    output: Output.object({ schema: ReplySchema }),
    prompt: `Classify a cold outreach reply, draft a response, AND decide what pipeline stage the lead should move to.

Sender business:
- Name: ${bp?.sender_name ?? "(unknown)"}
- Summary: ${bp?.ai_summary ?? bp?.offer_description ?? ""}
- Value prop: ${bp?.value_proposition ?? ""}

Prospect: ${input.leadBusiness}
Reply subject: ${input.replySubject ?? ""}
Reply body:
"""
${input.replyText.slice(0, 4000)}
"""

Rules:
- classification: interested | question | objection | not_interested | out_of_office | other
- suggested_stage: pick the CRM stage this lead should move to based on this reply:
    * "in_progress" — they are engaged, asking questions, want to talk, booking a call, negotiating
    * "won" — they explicitly agreed to buy, signed, paid, or confirmed the deal
    * "lost" — they said no, unsubscribed, not interested, wrong person / not a fit
    * "replied" — they replied but it's ambiguous (out of office, just an acknowledgement)
- stage_reason: one short sentence explaining the stage decision, quoting the prospect if helpful.
- suggested_reply: a warm, concise response under 100 words that moves the conversation forward. Gracious if not_interested. Brief if out_of_office. Sign off with ${bp?.sender_name ?? "the sender's first name"}. No subject line, plain text only.`,
  });

  return output as ClassificationResult;
}
