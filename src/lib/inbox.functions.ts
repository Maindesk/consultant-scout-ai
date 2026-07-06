import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Groups all conversations by lead: shows pending-review count and the
 * latest activity per lead. The inbox UI drills into a lead for the full
 * interleaved thread of sent + received messages.
 */
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Get every lead that has either an inbound message or a sent email
    const [{ data: inbox }, { data: sends }] = await Promise.all([
      context.supabase
        .from("inbound_messages")
        .select("id, lead_id, received_at, reply_status, classification, subject, body, from_email")
        .eq("user_id", context.userId)
        .order("received_at", { ascending: false }),
      context.supabase
        .from("email_sends")
        .select("id, lead_id, sent_at, subject")
        .eq("user_id", context.userId)
        .order("sent_at", { ascending: false }),
    ]);

    const leadIds = new Set<string>();
    for (const m of inbox ?? []) if (m.lead_id) leadIds.add(m.lead_id);
    for (const s of sends ?? []) if (s.lead_id) leadIds.add(s.lead_id);
    if (leadIds.size === 0) return [];

    const { data: leads } = await context.supabase
      .from("leads")
      .select("id, business_name, website, email, niche, status")
      .in("id", Array.from(leadIds));

    const leadMap = new Map((leads ?? []).map((l) => [l.id, l]));

    const conversations = Array.from(leadIds).map((lid) => {
      const lead = leadMap.get(lid);
      const leadInbox = (inbox ?? []).filter((m) => m.lead_id === lid);
      const leadSends = (sends ?? []).filter((s) => s.lead_id === lid);
      const pending = leadInbox.filter((m) => m.reply_status === "pending_review").length;
      const lastInbound = leadInbox[0];
      const lastSend = leadSends[0];
      const lastActivity =
        (lastInbound?.received_at ?? "") > (lastSend?.sent_at ?? "")
          ? lastInbound?.received_at
          : lastSend?.sent_at;
      return {
        lead_id: lid,
        lead,
        pending_replies: pending,
        classification: lastInbound?.classification ?? null,
        last_activity: lastActivity,
        last_inbound_preview: lastInbound?.body?.slice(0, 140) ?? null,
        last_from: lastInbound?.from_email ?? null,
        inbound_count: leadInbox.length,
        sent_count: leadSends.length,
      };
    });

    conversations.sort((a, b) => {
      if (a.pending_replies !== b.pending_replies) return b.pending_replies - a.pending_replies;
      return (b.last_activity ?? "").localeCompare(a.last_activity ?? "");
    });

    return conversations;
  });

export const getLeadConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string }) => d)
  .handler(async ({ context, data }) => {
    const [{ data: lead }, { data: inbound }, { data: sends }] = await Promise.all([
      context.supabase
        .from("leads")
        .select("*")
        .eq("id", data.lead_id)
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("inbound_messages")
        .select("*")
        .eq("lead_id", data.lead_id)
        .eq("user_id", context.userId)
        .order("received_at", { ascending: true }),
      context.supabase
        .from("email_sends")
        .select("*")
        .eq("lead_id", data.lead_id)
        .eq("user_id", context.userId)
        .order("sent_at", { ascending: true }),
    ]);

    if (!lead) throw new Error("Lead not found");

    type ThreadItem =
      | { kind: "sent"; id: string; at: string; subject?: string | null; body?: string | null }
      | {
          kind: "inbound";
          id: string;
          at: string;
          subject?: string | null;
          body?: string | null;
          from_email?: string | null;
          classification?: string | null;
          suggested_reply?: string | null;
          reply_status: string;
        };

    const thread: ThreadItem[] = [
      ...(sends ?? []).map((s): ThreadItem => ({
        kind: "sent",
        id: s.id,
        at: s.sent_at,
        subject: s.subject,
        body: s.body,
      })),
      ...(inbound ?? []).map((m): ThreadItem => ({
        kind: "inbound",
        id: m.id,
        at: m.received_at,
        subject: m.subject,
        body: m.body,
        from_email: m.from_email,
        classification: m.classification,
        suggested_reply: m.suggested_reply,
        reply_status: m.reply_status,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    return { lead, thread };
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
