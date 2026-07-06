import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Enqueues a transactional email via Lovable Emails.
 * Requires the email domain + infrastructure to be set up
 * (email_domain--setup_email_infra). Until then, this throws a clear error.
 */
export async function sendTransactionalEmail(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  template_name: string;
  reply_to?: string;
  headers?: Record<string, string>;
}): Promise<{ message_id: string }> {
  const message_id = `${input.template_name}-${crypto.randomUUID()}`;

  const { error } = await supabaseAdmin.rpc("enqueue_email" as never, {
    queue_name: "transactional_emails",
    payload: {
      message_id,
      template_name: input.template_name,
      recipient_email: input.to,
      from: input.from,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
      reply_to: input.reply_to,
      headers: input.headers ?? {},
    } as never,
  } as never);

  if (error) {
    throw new Error(
      `Email send failed: ${error.message}. If this says the function does not exist, the email domain still needs to be set up.`,
    );
  }
  return { message_id };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111">${escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("")}</div>`;
}
