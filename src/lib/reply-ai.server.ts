import { generateText, Output } from "ai";
import { z } from "zod";
import { getLovableGateway, CHAT_MODEL } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ReplySchema = z.object({
  classification: z.enum(["interested", "question", "objection", "not_interested", "out_of_office", "other"]),
  suggested_reply: z.string(),
});

export async function classifyAndSuggest(input: {
  userId: string;
  leadBusiness: string;
  replyText: string;
  replySubject?: string;
}): Promise<{ classification: string; suggested_reply: string }> {
  const { data: bp } = await supabaseAdmin
    .from("business_profiles")
    .select("sender_name, ai_summary, offer_description, value_proposition")
    .eq("user_id", input.userId)
    .maybeSingle();

  const gateway = getLovableGateway();
  const { output } = await generateText({
    model: gateway(CHAT_MODEL),
    output: Output.object({ schema: ReplySchema }),
    prompt: `Classify a cold outreach reply and draft a suggested response.

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
- classification: one of interested | question | objection | not_interested | out_of_office | other
- suggested_reply: a warm, concise response under 100 words that moves the conversation forward. If not_interested, be gracious and short. If out_of_office, keep it brief and mention you'll follow up. Sign off with ${bp?.sender_name ?? "the sender's first name"}. No subject line, plain text only.`,
  });

  return output;
}
