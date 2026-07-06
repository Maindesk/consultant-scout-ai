import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("inbound_messages")
      .select("*, leads(id, business_name, website, email, niche)")
      .eq("user_id", context.userId)
      .order("received_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const updateSuggestedReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; suggested_reply: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("inbound_messages")
      .update({ suggested_reply: data.suggested_reply })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const ignoreInbound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("inbound_messages")
      .update({ reply_status: "ignored" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const regenerateSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: msg } = await context.supabase
      .from("inbound_messages")
      .select("*, leads(business_name, website)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (!msg) throw new Error("Not found");

    const { classifyAndSuggest } = await import("./reply-ai.server");
    const out = await classifyAndSuggest({
      userId: context.userId,
      leadBusiness: (msg as any).leads?.business_name ?? (msg as any).leads?.website ?? "the prospect",
      replyText: msg.body ?? "",
      replySubject: msg.subject ?? "",
    });

    await context.supabase
      .from("inbound_messages")
      .update({ classification: out.classification, suggested_reply: out.suggested_reply })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return out;
  });

export const approveAndSendReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; body?: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: msg } = await context.supabase
      .from("inbound_messages")
      .select("*, leads(id, email, business_name)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (!msg) throw new Error("Not found");
    const lead = (msg as any).leads;
    if (!lead?.email) throw new Error("Lead has no email address");

    const { data: bp } = await context.supabase
      .from("business_profiles")
      .select("sender_name, sender_email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!bp?.sender_email) throw new Error("Set your sender email in Business profile first");

    const bodyText = (data.body ?? msg.suggested_reply ?? "").trim();
    if (!bodyText) throw new Error("Reply body is empty");

    const subject = msg.subject?.toLowerCase().startsWith("re:")
      ? msg.subject
      : `Re: ${msg.subject ?? ""}`.trim();

    const { sendTransactionalEmail, textToHtml } = await import("./send-email.server");
    const { message_id } = await sendTransactionalEmail({
      to: lead.email,
      from: `${bp.sender_name ?? "Outreach"} <${bp.sender_email}>`,
      subject,
      html: textToHtml(bodyText),
      text: bodyText,
      template_name: "reply",
      reply_to: bp.sender_email,
    });

    await context.supabase.from("email_sends").insert({
      user_id: context.userId,
      lead_id: lead.id,
      subject,
      body: bodyText,
      provider_message_id: message_id,
      status: "sent",
    });

    await context.supabase
      .from("inbound_messages")
      .update({
        reply_status: "sent",
        reply_sent_at: new Date().toISOString(),
        suggested_reply: bodyText,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    return { ok: true };
  });
