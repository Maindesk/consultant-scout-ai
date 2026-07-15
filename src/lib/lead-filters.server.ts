/**
 * Filters out low-quality search results before they become leads:
 *  - Platform vendor domains (squarespace.com, wix.com, ...)
 *  - Blog/listicle/directory sites that write ABOUT the platform
 *  - URLs that look like articles ("/blog/", "20-best-...", "how-to-...")
 *  - Social/marketplace/wiki domains
 *
 * Also builds smarter search queries that surface real practitioners
 * (coaches/consultants with their own site) instead of articles about them.
 */
import type { PlatformName } from "./platforms";

// Own-brand + support/help subdomains of platforms — never a lead.
const PLATFORM_VENDOR_DOMAINS = [
  "squarespace.com",
  "wix.com",
  "webflow.com",
  "webflow.io",
  "wordpress.com",
  "wordpress.org",
  "shopify.com",
  "kajabi.com",
  "teachable.com",
  "podia.com",
  "kartra.com",
  "clickfunnels.com",
  "framer.com",
  "framer.website",
  "ghost.org",
  "ghost.io",
  "hubspot.com",
  "carrd.co",
];

// Content/directory/marketplace domains that dominate SERPs for "<niche> <platform>".
const CONTENT_DENY_DOMAINS = [
  "medium.com",
  "substack.com",
  "quora.com",
  "reddit.com",
  "wikipedia.org",
  "wikihow.com",
  "youtube.com",
  "vimeo.com",
  "pinterest.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "yelp.com",
  "trustpilot.com",
  "g2.com",
  "capterra.com",
  "producthunt.com",
  "getapp.com",
  "sitebuilderreport.com",
  "websitebuilderexpert.com",
  "cybernews.com",
  "forbes.com",
  "entrepreneur.com",
  "inc.com",
  "hubspot.com",
  "neilpatel.com",
  "smallbiztrends.com",
  "themeforest.net",
  "envato.com",
  "fiverr.com",
  "upwork.com",
  "clutch.co",
  "yelp.com",
];

// URL path fragments that indicate an article, not a business homepage.
const ARTICLE_PATH_RX = /\/(blog|articles?|guides?|resources?|news|magazine|learn|tutorials?|posts?|category|tag)\//i;

// Title/description phrases that mean "article about X" not "practitioner using X".
const ARTICLE_TITLE_RX = /\b(best|top\s*\d*|inspiring|examples?|guide|guides|how\s*to|tutorial|review|comparison|vs\.?|template|templates|checklist|tips|listicle|roundup|showcase|ultimate|complete\s+guide|beginner'?s|for\s+beginners)\b/i;

// Signals a site sells Squarespace/Wix/etc. services (agency), not uses them for coaching.
const AGENCY_TITLE_RX = /\b(squarespace|wix|webflow|shopify|wordpress|kajabi)\s+(web\s*design|designer|developer|expert|agency|template|specialist|consultant|studio|seo|circle)\b/i;

function domainMatches(host: string, list: string[]): boolean {
  return list.some((d) => host === d || host.endsWith("." + d));
}

export function isJunkLead(input: {
  url: string;
  title?: string;
  description?: string;
  domain: string;
}): { junk: boolean; reason?: string } {
  const host = input.domain;
  if (domainMatches(host, PLATFORM_VENDOR_DOMAINS)) return { junk: true, reason: "platform vendor" };
  if (domainMatches(host, CONTENT_DENY_DOMAINS)) return { junk: true, reason: "content/directory site" };

  try {
    const u = new URL(input.url.startsWith("http") ? input.url : `https://${input.url}`);
    if (ARTICLE_PATH_RX.test(u.pathname)) return { junk: true, reason: "article URL" };
  } catch {
    // ignore
  }

  const title = input.title ?? "";
  if (ARTICLE_TITLE_RX.test(title)) return { junk: true, reason: "listicle/article title" };
  if (AGENCY_TITLE_RX.test(title)) return { junk: true, reason: "platform agency, not user" };

  return { junk: false };
}

/**
 * Build queries that target actual practitioners, not articles.
 * If a platform is selected, use Firecrawl/Google operators to find sites
 * BUILT on that platform (via known asset host `site:*` isn't allowed, so we
 * use intitle/inurl practitioner phrasing plus negative operators).
 */
export function buildPractitionerQueries(opts: {
  niches: string[];
  locations: string[];
  keywords: string[];
  platform?: PlatformName | null;
}): string[] {
  const niches = opts.niches.length ? opts.niches : [""];
  const locs = opts.locations.length ? opts.locations : [""];
  const kw = opts.keywords.join(" ").trim();
  const platform = opts.platform ?? null;

  const ecommerce: PlatformName[] = ["Shopify"];
  const isEcom = !!platform && ecommerce.includes(platform);

  const intents = isEcom
    ? ['"add to cart"', '"shop now"', '"free shipping"', '"our collection"', '"shop all"']
    : ['"work with me"', '"book a call"', '"schedule a consultation"', '"1:1 coaching"', '"my services"'];

  const platformHints: Partial<Record<PlatformName, string>> = {
    Shopify: '"cdn.shopify.com"',
    Squarespace: '"static.squarespace.com"',
    Wix: '"wixstatic.com"',
    Webflow: '"website-files.com"',
    WordPress: '"wp-content"',
    Kajabi: '"kajabi-cdn"',
    Framer: '"framerusercontent.com"',
    Ghost: '"ghost.io"',
  };
  const platformOp = platform ? platformHints[platform] ?? "" : "";

  const neg = [
    "-best", "-top", "-guide", "-examples", "-template", "-templates",
    '-"how to"', "-blog", "-tutorial", "-review",
    "-site:squarespace.com", "-site:wix.com", "-site:webflow.com",
    "-site:wordpress.com", "-site:kajabi.com", "-site:shopify.com",
    "-site:medium.com", "-site:reddit.com", "-site:youtube.com", "-site:linkedin.com",
  ].join(" ");

  const queries: string[] = [];
  for (const n of niches) {
    for (const l of locs) {
      const base = [n, l, kw].filter(Boolean).join(" ");
      queries.push(`${base} ${platformOp} ${intents[0]} ${neg}`.replace(/\s+/g, " ").trim());
      queries.push(`${base} ${platformOp} (${intents[1]} OR ${intents[2]}) ${neg}`.replace(/\s+/g, " ").trim());
      if (isEcom) {
        queries.push(`${base} ${platformOp} ${intents[3]} ${neg}`.replace(/\s+/g, " ").trim());
      }
    }
  }
  return queries;
}
