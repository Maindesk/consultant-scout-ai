/**
 * Detect the website platform from raw HTML fingerprints.
 * Runs server-side inside enrichment / autopilot.
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

export function detectPlatform(html?: string | null): PlatformName | null {
  if (!html) return null;
  for (const sig of SIGNATURES) {
    if (sig.patterns.some((p) => p.test(html))) return sig.name;
  }
  return null;
}
