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
  };
  performance: {
    status: number | null;
    ttfb_ms: number | null;
    total_ms: number | null;
    bytes: number | null;
    https: boolean;
  } | null;
  gaps: string[]; // human-readable observations useful for cold emails
}

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
  const has_viewport = /<meta[^>]+name=["']viewport["']/i.test(src);
  const has_og_image = /<meta[^>]+property=["']og:image["']/i.test(src);
  const outbound_link_count = (src.match(/<a\s[^>]*href=["']https?:\/\//gi) ?? []).length;
  const image_count = (src.match(/<img\s/gi) ?? []).length;

  const gaps: string[] = [];
  if (!categories.includes("scheduling")) gaps.push("no calendar/booking tool detected");
  if (!categories.includes("email_capture")) gaps.push("no email capture / newsletter tool detected");
  if (!categories.includes("analytics")) gaps.push("no analytics installed");
  if (!categories.includes("ads_pixel")) gaps.push("no retargeting pixel detected");
  if (!categories.includes("video")) gaps.push("no video content detected");
  if (!categories.includes("reviews")) gaps.push("no testimonial/review widget detected");
  if (!has_og_image) gaps.push("no Open Graph image (poor social shares)");
  if (!has_h1) gaps.push("no H1 heading (SEO)");
  if (word_count < 250) gaps.push("thin page copy (<250 words)");

  return {
    tools,
    categories,
    page: { title, description, word_count, has_h1, has_viewport, has_og_image, outbound_link_count, image_count },
    gaps,
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
  return [
    `Tools detected: ${toolLine}`,
    `Page: title="${s.page.title ?? ""}", ${s.page.word_count} words, H1=${s.page.has_h1}, OG image=${s.page.has_og_image}`,
    `Performance: ${perf}`,
    `Gaps: ${s.gaps.join("; ") || "none"}`,
  ].join("\n");
}
