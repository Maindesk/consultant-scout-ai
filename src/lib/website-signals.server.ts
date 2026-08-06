/**
 * Detect embedded 3rd-party tech + measure basic page performance.
 * Runs on raw HTML from Firecrawl scrape plus one lightweight fetch for timing.
 * Output is meant to feed the AI so cold emails can reference concrete signals
 * ("I noticed you use Calendly but no lead magnet…").
 */

export type SignalCategory =
  | "scheduling"
  | "chat"
  | "email_capture"
  | "analytics"
  | "ads_pixel"
  | "payments"
  | "video"
  | "forms"
  | "membership"
  | "reviews"
  | "crm"
  | "popup"
  | "ecommerce";

export interface DetectedTool {
  name: string;
  category: SignalCategory;
}

const TOOL_PATTERNS: Array<{ name: string; category: SignalCategory; patterns: RegExp[] }> = [
  // Scheduling / calendar
  { name: "Calendly", category: "scheduling", patterns: [/calendly\.com/i, /assets\.calendly\.com/i] },
  { name: "Cal.com", category: "scheduling", patterns: [/\bcal\.com\/embed/i, /app\.cal\.com/i] },
  { name: "Acuity", category: "scheduling", patterns: [/acuityscheduling\.com/i, /squarespacescheduling\.com/i] },
  { name: "SavvyCal", category: "scheduling", patterns: [/savvycal\.com/i] },
  { name: "TidyCal", category: "scheduling", patterns: [/tidycal\.com/i] },
  { name: "HubSpot Meetings", category: "scheduling", patterns: [/meetings\.hubspot\.com/i] },

  // Chat widgets
  { name: "Intercom", category: "chat", patterns: [/widget\.intercom\.io/i, /intercomcdn/i] },
  { name: "Drift", category: "chat", patterns: [/js\.driftt\.com/i, /drift\.com/i] },
  { name: "Crisp", category: "chat", patterns: [/client\.crisp\.chat/i] },
  { name: "Tawk.to", category: "chat", patterns: [/embed\.tawk\.to/i] },
  { name: "Zendesk Chat", category: "chat", patterns: [/zdassets\.com/i, /static\.zdassets/i] },
  { name: "ManyChat", category: "chat", patterns: [/manychat\.com/i] },

  // Email capture / ESP
  { name: "ConvertKit", category: "email_capture", patterns: [/convertkit\.com/i, /ck\.page/i] },
  { name: "Mailchimp", category: "email_capture", patterns: [/list-manage\.com/i, /chimpstatic\.com/i] },
  { name: "ActiveCampaign", category: "email_capture", patterns: [/activehosted\.com/i, /activecampaign\.com/i] },
  { name: "MailerLite", category: "email_capture", patterns: [/mailerlite\.com/i] },
  { name: "Klaviyo", category: "email_capture", patterns: [/klaviyo\.com/i, /static\.klaviyo/i] },
  { name: "Beehiiv", category: "email_capture", patterns: [/beehiiv\.com/i] },
  { name: "Substack", category: "email_capture", patterns: [/substack\.com/i] },

  // Analytics
  { name: "Google Analytics", category: "analytics", patterns: [/googletagmanager\.com\/gtag/i, /google-analytics\.com/i, /gtag\('config'/i] },
  { name: "Google Tag Manager", category: "analytics", patterns: [/googletagmanager\.com\/gtm\.js/i] },
  { name: "Plausible", category: "analytics", patterns: [/plausible\.io/i] },
  { name: "Fathom", category: "analytics", patterns: [/usefathom\.com/i] },
  { name: "Mixpanel", category: "analytics", patterns: [/cdn\.mxpnl\.com/i, /mixpanel/i] },
  { name: "Hotjar", category: "analytics", patterns: [/static\.hotjar\.com/i] },
  { name: "PostHog", category: "analytics", patterns: [/posthog\.com/i] },

  // Ad pixels
  { name: "Meta Pixel", category: "ads_pixel", patterns: [/connect\.facebook\.net.*fbevents/i, /fbq\('init'/i] },
  { name: "TikTok Pixel", category: "ads_pixel", patterns: [/analytics\.tiktok\.com/i] },
  { name: "LinkedIn Insight", category: "ads_pixel", patterns: [/snap\.licdn\.com/i] },
  { name: "Google Ads", category: "ads_pixel", patterns: [/googleadservices\.com/i, /aw-\d+/i] },
  { name: "Pinterest Tag", category: "ads_pixel", patterns: [/ct\.pinterest\.com/i] },

  // Payments
  { name: "Stripe", category: "payments", patterns: [/js\.stripe\.com/i, /checkout\.stripe\.com/i] },
  { name: "PayPal", category: "payments", patterns: [/paypal\.com\/sdk/i, /paypalobjects\.com/i] },
  { name: "ThriveCart", category: "payments", patterns: [/thrivecart\.com/i] },
  { name: "Gumroad", category: "payments", patterns: [/gumroad\.com/i] },

  // Video
  { name: "YouTube embed", category: "video", patterns: [/youtube\.com\/embed/i, /youtu\.be/i] },
  { name: "Vimeo", category: "video", patterns: [/player\.vimeo\.com/i] },
  { name: "Wistia", category: "video", patterns: [/fast\.wistia\.com/i, /wistia\.net/i] },
  { name: "Loom", category: "video", patterns: [/loom\.com\/embed/i] },

  // Forms
  { name: "Typeform", category: "forms", patterns: [/embed\.typeform\.com/i, /typeform\.com/i] },
  { name: "Jotform", category: "forms", patterns: [/jotform\.com/i] },
  { name: "Google Forms", category: "forms", patterns: [/docs\.google\.com\/forms/i] },
  { name: "Tally", category: "forms", patterns: [/tally\.so/i] },

  // Membership / community
  { name: "MemberSpace", category: "membership", patterns: [/memberspace\.com/i] },
  { name: "Circle", category: "membership", patterns: [/circle\.so/i] },
  { name: "Mighty Networks", category: "membership", patterns: [/mightynetworks\.com/i] },
  { name: "Skool", category: "membership", patterns: [/skool\.com/i] },

  // Reviews / social proof
  { name: "Trustpilot", category: "reviews", patterns: [/widget\.trustpilot\.com/i] },
  { name: "Senja", category: "reviews", patterns: [/senja\.io/i] },
  { name: "Testimonial.to", category: "reviews", patterns: [/testimonial\.to/i] },

  // CRM
  { name: "HubSpot", category: "crm", patterns: [/hs-scripts\.com/i, /hubspot\.com\/hubfs/i] },
  { name: "Salesforce Web-to-Lead", category: "crm", patterns: [/salesforce\.com.*servlet/i] },

  // Popups
  { name: "OptinMonster", category: "popup", patterns: [/optinmonster\.com/i, /a\.opmnstr\.com/i] },
  { name: "Sumo", category: "popup", patterns: [/sumo\.com/i, /load\.sumo\.com/i] },
  { name: "Privy", category: "popup", patterns: [/privy\.com/i] },

  // Ecommerce add-ons
  { name: "Shopify Checkout", category: "ecommerce", patterns: [/checkout\.shopify\.com/i] },
];

export interface WebsiteSignals {
  tools: DetectedTool[];
  categories: SignalCategory[];
  page: {
    title: string | null;
    description: string | null;
    word_count: number;
    has_h1: boolean;
    has_viewport: boolean;
    has_og_image: boolean;
    outbound_link_count: number;
    image_count: number;
    responsive: boolean;
    responsive_signals: { viewport: boolean; media_queries: boolean; responsive_framework: boolean; srcset: boolean; fluid_container: boolean };
  };
  performance: {
    status: number | null;
    ttfb_ms: number | null;
    total_ms: number | null;
    bytes: number | null;
    https: boolean;
  } | null;
  gaps: string[]; // human-readable observations useful for cold emails
  /** Per-feature verdict with evidence. Only `absent` entries are real gaps. */
  capabilities: Record<CapabilityKey, Capability>;
  /** False when the scrape returned too little markup to judge anything. */
  html_usable: boolean;
}

export type CapabilityKey =
  | "booking"
  | "email_capture"
  | "forms"
  | "popup"
  | "chat"
  | "payments"
  | "membership"
  | "reviews"
  | "crm"
  | "analytics"
  | "ads_pixel"
  | "responsive"
  | "seo";

export interface Capability {
  state: "present" | "absent" | "unknown";
  /** Third-party product providing it (i.e. a consolidation opportunity). */
  via: string | null;
  /** Why we decided that — shown in the UI and fed to the AI. */
  evidence: string | null;
}

const CAPABILITY_LABEL: Record<CapabilityKey, string> = {
  booking: "booking/appointments",
  email_capture: "email capture / newsletter",
  forms: "contact forms / lead intake",
  popup: "popups & exit-intent",
  chat: "live chat",
  payments: "payments & checkout",
  membership: "memberships & courses",
  reviews: "testimonials & reviews",
  crm: "CRM & pipeline",
  analytics: "analytics",
  ads_pixel: "retargeting pixel",
  responsive: "mobile-responsive layout",
  seo: "SEO basics (H1 + OG image)",
};

/**
 * Native (platform built-in) evidence — a site can absolutely have booking or
 * a newsletter without any third-party script, so tool detection alone
 * produces false "Missing" verdicts. These patterns look for the feature
 * itself in the markup.
 */
const NATIVE_EVIDENCE: Partial<Record<CapabilityKey, Array<{ re: RegExp; note: string }>>> = {
  booking: [
    { re: /href=["'][^"']*\/(book|booking|bookings|appointments?|schedule|reserve)\b/i, note: "booking page link" },
    { re: /\b(book (?:a|your) (?:call|appointment|session|table)|schedule (?:a|your) (?:call|appointment|consultation)|request an appointment)\b/i, note: "booking CTA copy" },
    { re: /(setmore|simplybook|square\.site\/book|opentable|resy|mindbody|vagaro|booksy|fresha|schedulicity|appointlet|youcanbook\.me|10to8)/i, note: "booking provider" },
  ],
  email_capture: [
    { re: /<input[^>]+type=["']email["']/i, note: "email input field" },
    { re: /(mc4wp|sqs-block-newsletter|newsletter-form|klaviyo-form|kl_?newsletter|omnisend|form[^>]*newsletter)/i, note: "newsletter form block" },
    { re: /\b(subscribe to (?:our|the) (?:newsletter|list)|join (?:our|the) (?:newsletter|mailing list)|get (?:the )?free (?:guide|checklist|ebook))\b/i, note: "newsletter/lead-magnet copy" },
  ],
  forms: [
    { re: /<form[\s>][\s\S]{0,4000}?<textarea/i, note: "form with message field" },
    { re: /<form[\s>][\s\S]{0,2000}?<input[^>]+(name|id)=["'][^"']*(name|phone|message|subject)/i, note: "contact form fields" },
    { re: /(wpcf7|gravity_?form|wpforms|ninja_?forms|sqs-block-form|w-form|hs-form)/i, note: "form plugin markup" },
  ],
  payments: [
    { re: /(\/cart\/add|add-to-cart|data-product-id|woocommerce|snipcart|shopify-payment-button|\/checkout\b)/i, note: "cart / checkout markup" },
    { re: /(sqs-money|product-price|itemprop=["']price["']|"priceCurrency")/i, note: "priced product markup" },
  ],
  membership: [
    { re: /href=["'][^"']*\/(members?|member-area|my-account|account\/login|portal|student|courses?\/login)\b/i, note: "member/login area link" },
    { re: /(memberpress|learndash|lifterlms|tutor-lms|wp-login\.php|thinkific|teachable|kajabi)/i, note: "membership platform markup" },
  ],
  reviews: [
    { re: /("@type"\s*:\s*"(Review|AggregateRating)"|itemprop=["']aggregateRating["'])/i, note: "review schema markup" },
    { re: /(testimonial|what (?:our )?clients say|success stories|5-star|five star)/i, note: "testimonial section copy" },
  ],
  popup: [
    { re: /(exit-intent|data-popup|class=["'][^"']*\b(popup|modal-newsletter|lightbox-newsletter)\b)/i, note: "popup markup" },
  ],
  chat: [
    { re: /(href=["']https:\/\/(wa\.me|api\.whatsapp\.com)|class=["'][^"']*live-?chat)/i, note: "chat/WhatsApp widget" },
  ],
};

/** Categories only ever detectable through scripts in <head>/<body>. */
const SCRIPT_ONLY: CapabilityKey[] = ["analytics", "ads_pixel", "crm"];

const CAP_TOOL_CATEGORIES: Partial<Record<CapabilityKey, SignalCategory[]>> = {
  booking: ["scheduling"],
  email_capture: ["email_capture"],
  forms: ["forms"],
  popup: ["popup"],
  chat: ["chat"],
  payments: ["payments", "ecommerce"],
  membership: ["membership"],
  reviews: ["reviews"],
  crm: ["crm"],
  analytics: ["analytics"],
  ads_pixel: ["ads_pixel"],
};

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  return html.match(re)?.[1] ?? null;
}


export function detectSignals(html?: string | null): Omit<WebsiteSignals, "performance"> {
  const src = html ?? "";
  const tools: DetectedTool[] = [];
  const seen = new Set<string>();
  for (const t of TOOL_PATTERNS) {
    if (t.patterns.some((p) => p.test(src))) {
      if (!seen.has(t.name)) {
        tools.push({ name: t.name, category: t.category });
        seen.add(t.name);
      }
    }
  }
  const categories = Array.from(new Set(tools.map((t) => t.category))) as SignalCategory[];

  const title = src.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  const description = extractMeta(src, "description") ?? extractMeta(src, "og:description");
  const text = src.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const word_count = text.split(/\s+/).filter(Boolean).length;
  const has_h1 = /<h1[\s>]/i.test(src);
  const has_viewport = /<meta[^>]+name=["']viewport["'][^>]*content=["'][^"']*width=/i.test(src);
  const has_og_image = /<meta[^>]+property=["']og:image["']/i.test(src);
  const outbound_link_count = (src.match(/<a\s[^>]*href=["']https?:\/\//gi) ?? []).length;
  const image_count = (src.match(/<img\s/gi) ?? []).length;
  const media_queries = /@media[^{]*\(([^)]*max-width|[^)]*min-width)/i.test(src);
  const responsive_framework = /(tailwind|bootstrap|foundation|bulma|chakra|mui|material-ui|framework7)/i.test(src) || /\bclass=["'][^"']*\b(sm:|md:|lg:|xl:|col-(?:xs|sm|md|lg)-\d+)/i.test(src);
  const srcset = /<img[^>]+srcset=/i.test(src) || /<source[^>]+srcset=/i.test(src);
  const fluid_container = /max-width\s*:\s*100%/i.test(src) || /width\s*:\s*100%/i.test(src);
  const responsive_signals = { viewport: has_viewport, media_queries, responsive_framework, srcset, fluid_container };
  const responsive = has_viewport && (media_queries || responsive_framework || srcset || fluid_container);

  // Did we actually get real markup? If the scrape returned a stub we must not
  // claim anything is "missing" — that produces false gaps in cold emails.
  const has_head = /<head[\s>]/i.test(src) || /<meta\s/i.test(src);
  const html_usable = src.length > 1500 && has_head;

  const capabilities = {} as Record<CapabilityKey, Capability>;
  const setCap = (k: CapabilityKey, c: Capability) => (capabilities[k] = c);

  for (const key of Object.keys(CAP_TOOL_CATEGORIES) as CapabilityKey[]) {
    const cats = CAP_TOOL_CATEGORIES[key]!;
    const tool = tools.find((t) => cats.includes(t.category));
    if (tool) {
      setCap(key, { state: "present", via: tool.name, evidence: `${tool.name} script found on the site` });
      continue;
    }
    if (!html_usable) {
      setCap(key, { state: "unknown", via: null, evidence: "page markup could not be read" });
      continue;
    }
    const native = (NATIVE_EVIDENCE[key] ?? []).find((n) => n.re.test(src));
    if (native) {
      setCap(key, { state: "present", via: null, evidence: `built into their site — ${native.note}` });
      continue;
    }
    if (SCRIPT_ONLY.includes(key)) {
      setCap(key, { state: "absent", via: null, evidence: "no tracking/CRM script in page source" });
    } else if (NATIVE_EVIDENCE[key]) {
      setCap(key, { state: "absent", via: null, evidence: "no widget, markup or on-page copy for it" });
    } else {
      setCap(key, { state: "unknown", via: null, evidence: "not verifiable from page source" });
    }
  }

  setCap("responsive", html_usable
    ? { state: responsive ? "present" : "absent", via: null, evidence: `viewport=${has_viewport}, media queries=${media_queries}, srcset=${srcset}` }
    : { state: "unknown", via: null, evidence: "page markup could not be read" });
  setCap("seo", html_usable
    ? { state: has_h1 && has_og_image ? "present" : "absent", via: null, evidence: `H1=${has_h1}, OG image=${has_og_image}` }
    : { state: "unknown", via: null, evidence: "page markup could not be read" });

  // Gaps = only confirmed absences, with evidence. Never guesses.
  const gaps: string[] = [];
  for (const key of Object.keys(capabilities) as CapabilityKey[]) {
    const c = capabilities[key];
    if (c.state === "absent") gaps.push(`no ${CAPABILITY_LABEL[key]} (${c.evidence})`);
  }
  if (html_usable && word_count < 250) gaps.push("thin page copy (<250 words)");

  return {
    tools,
    categories,
    page: { title, description, word_count, has_h1, has_viewport, has_og_image, outbound_link_count, image_count, responsive, responsive_signals },
    gaps,
    capabilities,
    html_usable,
  };
}


export async function measurePerformance(url: string): Promise<WebsiteSignals["performance"]> {
  const target = url.startsWith("http") ? url : `https://${url}`;
  const start = Date.now();
  let ttfb: number | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadScoutBot/1.0)" },
    });
    ttfb = Date.now() - start;
    const buf = await res.arrayBuffer();
    clearTimeout(timeout);
    return {
      status: res.status,
      ttfb_ms: ttfb,
      total_ms: Date.now() - start,
      bytes: buf.byteLength,
      https: target.startsWith("https://"),
    };
  } catch {
    return { status: null, ttfb_ms: ttfb, total_ms: Date.now() - start, bytes: null, https: target.startsWith("https://") };
  }
}

export async function analyzeWebsite(url: string, html?: string | null): Promise<WebsiteSignals> {
  const base = detectSignals(html);
  const performance = await measurePerformance(url);
  return { ...base, performance };
}

export function summarizeSignalsForPrompt(s?: WebsiteSignals | null): string {
  if (!s) return "(no website signals)";
  const toolLine = s.tools.length ? s.tools.map((t) => `${t.name} (${t.category})`).join(", ") : "none detected";
  const perf = s.performance
    ? `HTTP ${s.performance.status ?? "n/a"}, TTFB ${s.performance.ttfb_ms ?? "?"}ms, total ${s.performance.total_ms ?? "?"}ms, ${s.performance.bytes ? Math.round(s.performance.bytes / 1024) + "KB" : "size unknown"}`
    : "n/a";
  const caps = s.capabilities
    ? (Object.keys(s.capabilities) as CapabilityKey[])
        .map((k) => `${CAPABILITY_LABEL[k]}: ${s.capabilities[k].state}${s.capabilities[k].via ? ` (via ${s.capabilities[k].via})` : ""} — ${s.capabilities[k].evidence ?? ""}`)
        .join("\n")
    : "(not computed)";
  return [
    `Tools detected: ${toolLine}`,
    `Page: title="${s.page.title ?? ""}", ${s.page.word_count} words, H1=${s.page.has_h1}, OG image=${s.page.has_og_image}`,
    `Performance: ${perf}`,
    `Feature verdicts (present = they already have it, absent = verified gap, unknown = DO NOT mention):\n${caps}`,
    `Confirmed gaps: ${s.gaps.join("; ") || "none"}`,
    s.html_usable === false
      ? "WARNING: page markup was unreadable — do not claim anything is missing on their site."
      : "",
  ].filter(Boolean).join("\n");
}

