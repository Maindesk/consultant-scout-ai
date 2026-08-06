/**
 * Multi-page scrape: fetches the homepage, extracts same-domain links,
 * prioritizes high-signal pages (contact, newsletter, about, pricing, etc.)
 * and scrapes up to MAX_PAGES additional pages in parallel. Returns
 * aggregated markdown + HTML so downstream detectors + AI see the full site.
 */

import { getFirecrawl, extractDomain } from "./firecrawl.server";

const MAX_PAGES = 6; // homepage + 5 extras

const PRIORITY_PATTERNS: Array<{ re: RegExp; weight: number }> = [
  { re: /contact/i, weight: 10 },
  { re: /newsletter|subscribe|signup|sign-up/i, weight: 9 },
  { re: /pricing|plans/i, weight: 8 },
  { re: /about/i, weight: 6 },
  { re: /services|features|solutions|product/i, weight: 5 },
  { re: /book|schedule|demo|meeting|call/i, weight: 7 },
  { re: /testimonials|case-stud|clients/i, weight: 4 },
  { re: /blog|resources/i, weight: 2 },
];

function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const u = new URL(m[1], baseUrl);
      out.add(u.toString().split("#")[0]);
    } catch {}
  }
  return Array.from(out);
}

function scoreUrl(url: string): number {
  let s = 0;
  for (const p of PRIORITY_PATTERNS) if (p.re.test(url)) s += p.weight;
  // Penalize deep paths and pagination
  const path = (() => { try { return new URL(url).pathname; } catch { return url; } })();
  const depth = path.split("/").filter(Boolean).length;
  s -= Math.max(0, depth - 2);
  if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|webp)$/i.test(path)) s -= 100;
  if (/page=|\/page\//i.test(url)) s -= 5;
  return s;
}

export interface DeepScrapeResult {
  pages: Array<{ url: string; markdown: string; html: string; title?: string | null }>;
  aggregatedMarkdown: string;
  aggregatedHtml: string;
  pagesScraped: number;
}

export async function deepScrapeSite(website: string): Promise<DeepScrapeResult> {
  const fc = getFirecrawl();
  const base = website.startsWith("http") ? website : `https://${website}`;
  const domain = extractDomain(base);
  const pages: DeepScrapeResult["pages"] = [];

  // 1) Homepage
  let homeHtml = "";
  let homeMd = "";
  try {
    // rawHtml keeps <head>, scripts and third-party embeds — the cleaned `html`
    // format strips exactly the markup our tool/SEO detectors rely on.
    const res: any = await fc.scrape(base, { formats: ["markdown", "rawHtml", "html"], onlyMainContent: false });
    homeMd = res?.markdown ?? "";
    homeHtml = res?.rawHtml ?? res?.html ?? "";
    pages.push({ url: base, markdown: homeMd, html: homeHtml });
  } catch (e) {
    console.error("deepScrape homepage failed", e);
  }

  // 2) Discover candidate URLs: try firecrawl map first, fall back to links in HTML
  let candidates: string[] = [];
  try {
    const map: any = await (fc as any).map(base, { limit: 200, includeSubdomains: false });
    const links: string[] = map?.links ?? map?.data?.links ?? [];
    candidates = links;
  } catch {}
  if (candidates.length === 0 && homeHtml) {
    candidates = extractLinks(homeHtml, base);
  }

  // 3) Filter same-domain, dedupe, drop homepage, rank
  const seen = new Set<string>([base.replace(/\/$/, "")]);
  const ranked = candidates
    .filter((u) => {
      try {
        const d = extractDomain(u);
        if (!d || d !== domain) return false;
        const norm = u.replace(/\/$/, "");
        if (seen.has(norm)) return false;
        seen.add(norm);
        return true;
      } catch { return false; }
    })
    .map((u) => ({ u, score: scoreUrl(u) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PAGES - 1)
    .map((x) => x.u);

  // 4) Scrape extras in parallel
  const extras = await Promise.all(
    ranked.map(async (u) => {
      try {
        const res: any = await fc.scrape(u, { formats: ["markdown", "html"], onlyMainContent: true });
        return {
          url: u,
          markdown: (res?.markdown ?? "") as string,
          html: (res?.html ?? res?.rawHtml ?? "") as string,
        };
      } catch (e) {
        console.warn("deepScrape extra failed", u, (e as Error)?.message);
        return null;
      }
    }),
  );
  for (const p of extras) if (p) pages.push(p);

  const aggregatedMarkdown = pages
    .map((p) => `\n\n=== ${p.url} ===\n${p.markdown}`)
    .join("\n")
    .slice(0, 40_000);
  const aggregatedHtml = pages.map((p) => p.html).join("\n");

  return { pages, aggregatedMarkdown, aggregatedHtml, pagesScraped: pages.length };
}
