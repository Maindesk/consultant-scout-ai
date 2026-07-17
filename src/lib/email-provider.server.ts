/**
 * Workspace-scoped outbound email sender + DNS health scoring.
 * Each workspace connects its own provider (Resend, SendGrid, Postmark) and
 * verified sending domain. The internal email infrastructure is never exposed.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EmailProvider = "resend" | "sendgrid" | "postmark";

export interface WorkspaceSenderConfig {
  provider: EmailProvider;
  api_key: string;
  from_email: string;
  from_name: string | null;
}

export async function loadWorkspaceSender(
  workspaceId: string,
): Promise<WorkspaceSenderConfig | null> {
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("email_provider, email_api_key_ciphertext, email_from_email, email_from_name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws?.email_provider || !ws.email_api_key_ciphertext || !ws.email_from_email) {
    return null;
  }
  const { decryptSecret } = await import("./workspace-crypto.server");
  return {
    provider: ws.email_provider as EmailProvider,
    api_key: decryptSecret(ws.email_api_key_ciphertext),
    from_email: ws.email_from_email,
    from_name: ws.email_from_name ?? null,
  };
}

export interface SendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  message_id: string;
}

export async function sendWithWorkspaceProvider(
  workspaceId: string,
  input: SendInput,
): Promise<SendResult> {
  const cfg = await loadWorkspaceSender(workspaceId);
  if (!cfg) {
    throw new Error(
      "This workspace has no email sender connected. Go to Settings → Email Sender and connect your provider.",
    );
  }
  const fromHeader = cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email;
  switch (cfg.provider) {
    case "resend":
      return sendViaResend(cfg.api_key, fromHeader, input);
    case "sendgrid":
      return sendViaSendgrid(cfg.api_key, fromHeader, cfg.from_email, cfg.from_name, input);
    case "postmark":
      return sendViaPostmark(cfg.api_key, fromHeader, input);
  }
}

async function sendViaResend(apiKey: string, from: string, input: SendInput): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.reply_to,
      headers: input.headers,
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${json?.message ?? res.statusText}`);
  }
  return { message_id: json?.id ?? crypto.randomUUID() };
}

async function sendViaSendgrid(
  apiKey: string,
  _from: string,
  fromEmail: string,
  fromName: string | null,
  input: SendInput,
): Promise<SendResult> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: fromEmail, name: fromName ?? undefined },
      reply_to: input.reply_to ? { email: input.reply_to } : undefined,
      subject: input.subject,
      content: [
        ...(input.text ? [{ type: "text/plain", value: input.text }] : []),
        { type: "text/html", value: input.html },
      ],
      headers: input.headers,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`SendGrid ${res.status}: ${txt.slice(0, 240)}`);
  }
  return { message_id: res.headers.get("x-message-id") ?? crypto.randomUUID() };
}

async function sendViaPostmark(apiKey: string, from: string, input: SendInput): Promise<SendResult> {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: from,
      To: input.to,
      Subject: input.subject,
      HtmlBody: input.html,
      TextBody: input.text,
      ReplyTo: input.reply_to,
      Headers: input.headers
        ? Object.entries(input.headers).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
      MessageStream: "outbound",
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Postmark ${res.status}: ${json?.Message ?? res.statusText}`);
  }
  return { message_id: json?.MessageID ?? crypto.randomUUID() };
}

/* ----------------------------- Test / probe ----------------------------- */

export async function testProviderCredentials(
  provider: EmailProvider,
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (provider === "resend") {
      const r = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Invalid API key" };
      if (!r.ok) return { ok: false, message: `Resend ${r.status}` };
      return { ok: true, message: "Resend key verified" };
    }
    if (provider === "sendgrid") {
      const r = await fetch("https://api.sendgrid.com/v3/scopes", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Invalid API key" };
      if (!r.ok) return { ok: false, message: `SendGrid ${r.status}` };
      return { ok: true, message: "SendGrid key verified" };
    }
    if (provider === "postmark") {
      const r = await fetch("https://api.postmarkapp.com/server", {
        headers: { "X-Postmark-Server-Token": apiKey, Accept: "application/json" },
      });
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Invalid server token" };
      if (!r.ok) return { ok: false, message: `Postmark ${r.status}` };
      return { ok: true, message: "Postmark token verified" };
    }
    return { ok: false, message: "Unknown provider" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/* --------------------------- Domain health check --------------------------- */

export interface DomainHealthCheck {
  domain: string;
  score: number; // 0..100
  grade: "A" | "B" | "C" | "D" | "F";
  checked_at: string;
  records: {
    mx: { ok: boolean; values: string[]; note?: string };
    spf: { ok: boolean; value: string | null; note?: string };
    dkim: { ok: boolean; found: string[]; note?: string };
    dmarc: { ok: boolean; value: string | null; policy?: string; note?: string };
  };
  recommendations: string[];
}

interface DoHAnswer {
  name: string;
  type: number;
  TTL?: number;
  data: string;
}

async function dohQuery(name: string, type: string): Promise<DoHAnswer[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
  if (!res.ok) return [];
  const json: any = await res.json().catch(() => ({}));
  return (json?.Answer ?? []) as DoHAnswer[];
}

function stripQuotes(v: string): string {
  return v.replace(/^"|"$/g, "").replace(/"\s*"/g, "");
}

export async function checkDomainHealth(
  domain: string,
  provider: EmailProvider | null,
): Promise<DomainHealthCheck> {
  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];

  // MX
  const mxAns = await dohQuery(d, "MX");
  const mxValues = mxAns.map((a) => a.data);
  const mxOk = mxValues.length > 0;

  // SPF (TXT starting with v=spf1)
  const txtAns = await dohQuery(d, "TXT");
  const txts = txtAns.map((a) => stripQuotes(a.data));
  const spfRecord = txts.find((t) => /^v=spf1/i.test(t)) ?? null;

  // Which providers should be authorized in SPF given the provider choice
  const expectedSpfIncludes: Record<EmailProvider, string[]> = {
    resend: ["_spf.resend.com", "amazonses.com"],
    sendgrid: ["sendgrid.net"],
    postmark: ["spf.mtasv.net"],
  };
  const spfIncludesOk = provider
    ? expectedSpfIncludes[provider].some((inc) =>
        (spfRecord ?? "").toLowerCase().includes(inc.toLowerCase()),
      )
    : true;

  // DKIM: probe common selectors per provider
  const dkimSelectors: Record<EmailProvider, string[]> = {
    resend: ["resend"],
    sendgrid: ["s1", "s2"],
    postmark: ["20240101pm", "pm"],
  };
  const selectors = provider ? dkimSelectors[provider] : ["default", "google", "selector1", "selector2"];
  const dkimFound: string[] = [];
  for (const sel of selectors) {
    const rec = await dohQuery(`${sel}._domainkey.${d}`, "TXT");
    if (rec.length > 0) dkimFound.push(sel);
  }
  const dkimOk = dkimFound.length > 0;

  // DMARC
  const dmarcAns = await dohQuery(`_dmarc.${d}`, "TXT");
  const dmarcRecord = dmarcAns.map((a) => stripQuotes(a.data)).find((t) => /^v=DMARC1/i.test(t)) ?? null;
  const dmarcOk = !!dmarcRecord;
  const dmarcPolicyMatch = dmarcRecord?.match(/\bp=(none|quarantine|reject)/i);
  const dmarcPolicy = dmarcPolicyMatch?.[1]?.toLowerCase();

  // Score
  let score = 0;
  if (mxOk) score += 15;
  if (spfRecord) score += 20;
  if (spfIncludesOk && spfRecord) score += 15;
  if (dkimOk) score += 30;
  if (dmarcOk) score += 10;
  if (dmarcPolicy === "quarantine" || dmarcPolicy === "reject") score += 10;
  score = Math.min(100, score);

  const grade: DomainHealthCheck["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  const recommendations: string[] = [];
  if (!mxOk) recommendations.push("No MX records found — add MX records so bounces and replies can be received.");
  if (!spfRecord) recommendations.push("Add an SPF TXT record starting with 'v=spf1' authorizing your sending provider.");
  else if (!spfIncludesOk && provider)
    recommendations.push(
      `SPF exists but doesn't include your chosen provider (${provider}). Add: include:${expectedSpfIncludes[provider][0]}`,
    );
  if (!dkimOk)
    recommendations.push(
      provider
        ? `No DKIM record found for common ${provider} selectors. Verify your domain inside ${provider} and publish the DKIM records they show.`
        : "Publish a DKIM record from your email provider.",
    );
  if (!dmarcOk)
    recommendations.push("Publish a _dmarc TXT record (start with 'v=DMARC1; p=none; rua=mailto:you@yourdomain.com').");
  else if (dmarcPolicy === "none")
    recommendations.push("DMARC policy is 'none' — after monitoring, tighten to 'quarantine' or 'reject' to improve deliverability.");

  return {
    domain: d,
    score,
    grade,
    checked_at: new Date().toISOString(),
    records: {
      mx: { ok: mxOk, values: mxValues },
      spf: {
        ok: !!spfRecord && spfIncludesOk,
        value: spfRecord,
        note: spfRecord && !spfIncludesOk && provider ? `Missing include for ${provider}` : undefined,
      },
      dkim: {
        ok: dkimOk,
        found: dkimFound,
        note: provider ? `Probed selectors: ${selectors.join(", ")}` : undefined,
      },
      dmarc: {
        ok: dmarcOk,
        value: dmarcRecord,
        policy: dmarcPolicy,
      },
    },
    recommendations,
  };
}
