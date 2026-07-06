export const KNOWN_PLATFORMS = [
  "Squarespace",
  "Wix",
  "Webflow",
  "WordPress",
  "Shopify",
  "Kajabi",
  "Teachable",
  "Podia",
  "Kartra",
  "ClickFunnels",
  "Framer",
  "Ghost",
  "HubSpot",
  "Carrd",
] as const;

export type PlatformName = (typeof KNOWN_PLATFORMS)[number];
