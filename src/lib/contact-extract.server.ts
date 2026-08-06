/**
 * Deterministic contact extraction from scraped site HTML + markdown.
 *
 * The AI pass alone was missing emails constantly: markdown is truncated to
 * ~15k chars and most sites expose their address only as a `mailto:` in the
 * footer or on a contact page. This module mines the *raw aggregated HTML*
 * (all deep-scraped pages) for emails, phones and social profiles, scores the
 * candidates, and returns the best one plus all alternates.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAILTO_RE = /mailto:([^"'?>\s]+)/gi;
const TEL_RE = /tel:([+0-9().\-\s]{7,})/gi;

/** Emails that are never a real business contact. */
const JUNK_LOCAL = /^(no-?reply|do-?not-?reply|postmaster|abuse|webmaster@?sentry|wordpress|user|example|email|your(name|email)|name|test|sample)$/i;
const JUNK_DOMAIN =
  /(sentry\.io|wixpress\.com|example\.(com|org|net)|domain\.com|yourdomain|squarespace\.com|godaddy\.com|sentry-cdn|w3\.org|schema\.org|googlemail\.test|email\.com|company\.com|placeholder)/i;
const IMAGE_TAIL = /\.(png|jpe?g|gif|svg|webp|css|js|ico|woff2?)$/i;

/** Preferred inbox prefixes, higher = better. */
const LOCAL_WEIGHT: Array<{ re: RegExp; w: number }> = [
  { re: /^(hello|hi|hey)$/i, w: 10 },
  { re: /^(contact|enquiries|enquiry|inquiries|info)$/i, w: 9 },
  { re: /^(support|help|team|office|admin)$/i, w: 6 },
  { re: /^(sales|bookings?|booking|schedule)$/i, w: 7 },
  { re: /^(press|media|careers|jobs|billing|legal|privacy|dmca)$/i, w: -4 },
];

const SOCIAL_RE =
  /https?:\/\/(?:www\.)?(linkedin\.com\/(?:in|company)\/[A-Za-z0-9._%-]+|instagram\.com\/[A-Za-z0-9._]+|facebook\.com\/[A-Za-z0-9._-]+|twitter\.com\/[A-Za-z0-9_]+|x\.com\/[A-Za-z0-9_]+)/gi;

export interface ContactExtraction {
  /** Best guess business email, or null. */
  email: string | null;
  /** All plausible emails found, best-first. */
  emails: string[];
  phones: string[];
  socials: string[];
  /** Where the winning email came from. */
  email_source: "mailto" | "text" | null;
}

function cleanEmail(raw: string): string | null {
  const e = raw.trim().replace(/^[<("']+|[>)"'.,;]+$/g, "").toLowerCase();
  if (!e.includes("@")) return null;
  if (IMAGE_TAIL.test(e)) return null;
  const [local, domain] = e.split("@");
  if (!local || !domain) return null;
  if (JUNK_LOCAL.test(local)) return null;
  if (JUNK_DOMAIN.test(domain)) return null;
  if (/^[0-9a-f]{16,}$/.test(local)) return null; // tracking hashes
  return e;
}

function scoreEmail(email: string, siteDomain: string | null, fromMailto: boolean): number {
  const [local, domain] = email.split("@");
  let s = fromMailto ? 12 : 0;
  for (const { re, w } of LOCAL_WEIGHT) if (re.test(local)) s += w;
  if (siteDomain) {
    const root = siteDomain.replace(/^www\./, "");
    if (domain === root || domain.endsWith(`.${root}`)) s += 15;
    else if (/(gmail|outlook|hotmail|yahoo|icloud|proton)\./.test(domain)) s += 2;
    else s -= 3; // third-party domain (vendor, plugin author, etc.)
  }
  if (/^[a-z]+\.[a-z]+$/.test(local)) s += 4; // firstname.lastname
  return s;
}

export function extractContacts(input: {
  html: string;
  markdown?: string;
  siteDomain?: string | null;
}): ContactExtraction {
  const { html, markdown = "", siteDomain = null } = input;
  const scored = new Map<string, { score: number; source: "mailto" | "text" }>();

  const consider = (raw: string, source: "mailto" | "text") => {
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {}
    const e = cleanEmail(decoded);
    if (!e) return;
    const score = scoreEmail(e, siteDomain, source === "mailto");
    const prev = scored.get(e);
    if (!prev || score > prev.score) scored.set(e, { score, source });
  };

  for (const m of html.matchAll(MAILTO_RE)) consider(m[1], "mailto");
  for (const m of markdown.matchAll(MAILTO_RE)) consider(m[1], "mailto");
  for (const m of `${html}\n${markdown}`.matchAll(EMAIL_RE)) consider(m[0], "text");

  const ranked = [...scored.entries()].sort((a, b) => b[1].score - a[1].score);
  const best = ranked[0] ?? null;

  const phones = [
    ...new Set(
      [...html.matchAll(TEL_RE)]
        .map((m) => m[1].replace(/\s+/g, " ").trim())
        .filter((p) => p.replace(/\D/g, "").length >= 7),
    ),
  ].slice(0, 3);

  const socials = [...new Set([...`${html}\n${markdown}`.matchAll(SOCIAL_RE)].map((m) => m[0]))].slice(0, 6);

  return {
    email: best ? best[0] : null,
    emails: ranked.map(([e]) => e).slice(0, 8),
    phones,
    socials,
    email_source: best ? best[1].source : null,
  };
}
