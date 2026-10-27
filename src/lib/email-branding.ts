/** Workspace email design: signature block + demo-site button. Browser-safe. */
export interface EmailBranding {
  sig_name?: string;
  sig_title?: string;
  logo_url?: string;
  logo_width?: number;
  website?: string;
  email?: string;
  phone?: string;
  button_label?: string;
  button_color?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeColor = (c?: string) => (c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#FF5100");
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : "");
const withProto = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const stripProto = (u: string) => u.replace(/^https?:\/\//i, "").replace(/\/$/, "");

function paragraphs(text: string) {
  return esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export function demoButtonHtml(url: string, b: EmailBranding | null) {
  const href = esc(url);
  const label = esc(b?.button_label?.trim() || "View your demo site");
  const color = safeColor(b?.button_color);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px"><tr><td style="background:${color};border-radius:6px"><a href="${href}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:600;text-decoration:none;font-size:15px">${label}</a></td></tr></table>`;
}

export function signatureHtml(b: EmailBranding | null): string {
  if (!b) return "";
  const parts: string[] = [];
  if (b.sig_name) parts.push(`<div style="font-size:17px;font-weight:700;color:#111">${esc(b.sig_name)}</div>`);
  if (b.sig_title) parts.push(`<div style="font-size:14px;color:#333">${esc(b.sig_title)}</div>`);
  const logo = safeUrl(b.logo_url);
  if (logo) {
    const w = Math.min(Math.max(Number(b.logo_width) || 140, 40), 300);
    parts.push(`<div style="margin:14px 0"><img src="${esc(logo)}" width="${w}" alt="" style="display:block;width:${w}px;height:auto;border:0"/></div>`);
  }
  const lines: string[] = [];
  if (b.website) {
    const u = withProto(b.website.trim());
    lines.push(`<b>Website :</b> <a href="${esc(u)}" style="color:#1a0dab">${esc(stripProto(u))}</a>`);
  }
  if (b.email) lines.push(`<b>Email :</b> <a href="mailto:${esc(b.email.trim())}" style="color:#1a0dab">${esc(b.email.trim())}</a>`);
  if (b.phone) lines.push(`<b>Phone :</b> ${esc(b.phone.trim())}`);
  if (lines.length) parts.push(`<div style="font-size:14px;color:#111;line-height:1.5">${lines.join("<br/>")}</div>`);
  if (!parts.length) return "";
  return `<div style="margin-top:20px;font-family:Arial,Helvetica,sans-serif">${parts.join("")}</div>`;
}

export function signatureText(b: EmailBranding | null): string {
  if (!b) return "";
  return [b.sig_name, b.sig_title, b.website && `Website: ${stripProto(b.website)}`, b.email && `Email: ${b.email}`, b.phone && `Phone: ${b.phone}`]
    .filter(Boolean)
    .join("\n");
}

/**
 * Builds the branded HTML + text email. `{{DEMO_LINK}}` in the body becomes a
 * button when `demoUrl` is given; otherwise the button is appended if a demoUrl exists.
 */
export function renderBrandedEmail(body: string, b: EmailBranding | null, demoUrl?: string | null) {
  const token = "{{DEMO_LINK}}";
  let html: string;
  let text = body;
  if (demoUrl) {
    const chunks = body.split(token);
    html = chunks.map(paragraphs).join(demoButtonHtml(demoUrl, b));
    if (chunks.length === 1) html += demoButtonHtml(demoUrl, b);
    text = body.includes(token) ? body.replaceAll(token, demoUrl) : `${body}\n\n${demoUrl}`;
  } else {
    const clean = body.replaceAll(token, "").trim();
    html = paragraphs(clean);
    text = clean;
  }
  const sigT = signatureText(b);
  if (sigT) text += `\n\n${sigT}`;
  return {
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111">${html}${signatureHtml(b)}</div>`,
    text,
  };
}
