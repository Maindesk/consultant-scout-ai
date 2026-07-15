/**
 * Detect the website platform from raw HTML fingerprints and score confidence.
 * Confidence = fraction of that platform's signature patterns that matched.
 * Alternatives = other platforms that also had at least one match, sorted by score.
 */
import { KNOWN_PLATFORMS, type PlatformName } from "./platforms";

export { KNOWN_PLATFORMS, type PlatformName };

const SIGNATURES: Array<{ name: PlatformName; patterns: RegExp[] }> = [
  { name: "Squarespace", patterns: [/static\.squarespace\.com/i, /squarespace-cdn/i, /Squarespace\.SQUARESPACE_CONTEXT/i] },
  { name: "Wix", patterns: [/static\.wixstatic\.com/i, /X-Wix-/i, /wix-code/i, /_wixCIDX/i] },
  { name: "Webflow", patterns: [/assets\.website-files\.com/i, /webflow\.js/i, /data-wf-page/i] },
  { name: "WordPress", patterns: [/wp-content\//i, /wp-includes\//i, /<meta name=\"generator\" content=\"WordPress/i] },
  { name: "Shopify", patterns: [/cdn\.shopify\.com/i, /Shopify\.theme/i, /shopify-section/i] },
  { name: "Kajabi", patterns: [/kajabi-cdn/i, /assets\.kajabi-cdn\.com/i, /kajabi\.com/i] },
  { name: "Teachable", patterns: [/teachable\.com/i, /teachablecdn/i] },
  { name: "Podia", patterns: [/podia\.com/i, /podia-cdn/i] },
  { name: "Kartra", patterns: [/kartra\.com/i] },
  { name: "ClickFunnels", patterns: [/clickfunnels\.com/i, /cf-cdn/i] },
  { name: "Framer", patterns: [/framerusercontent\.com/i, /framer-motion/i, /<meta name=\"generator\" content=\"Framer/i] },
  { name: "Ghost", patterns: [/<meta name=\"generator\" content=\"Ghost/i, /ghost\.io/i] },
  { name: "HubSpot", patterns: [/hs-scripts\.com/i, /hubspot\.com\/hubfs/i, /hs-analytics/i] },
  { name: "Carrd", patterns: [/carrd\.co/i] },
];

export type PlatformMatch = { platform: PlatformName; matches: number; total: number; confidence: number };

export interface PlatformDetection {
  platform: PlatformName | null;
  confidence: number; // 0-1
  matches: number;
  alternatives: PlatformMatch[]; // other platforms that also had signals
}

export function detectPlatformDetailed(html?: string | null): PlatformDetection {
  if (!html) return { platform: null, confidence: 0, matches: 0, alternatives: [] };

  const scored: PlatformMatch[] = [];
  for (const sig of SIGNATURES) {
    const matches = sig.patterns.reduce((n, p) => (p.test(html) ? n + 1 : n), 0);
    if (matches > 0) {
      scored.push({
        platform: sig.name,
        matches,
        total: sig.patterns.length,
        confidence: matches / sig.patterns.length,
      });
    }
  }
  scored.sort((a, b) => b.confidence - a.confidence || b.matches - a.matches);

  if (scored.length === 0) return { platform: null, confidence: 0, matches: 0, alternatives: [] };
  const top = scored[0];
  return {
    platform: top.platform,
    confidence: top.confidence,
    matches: top.matches,
    alternatives: scored.slice(1),
  };
}

/** Back-compat convenience. */
export function detectPlatform(html?: string | null): PlatformName | null {
  return detectPlatformDetailed(html).platform;
}
