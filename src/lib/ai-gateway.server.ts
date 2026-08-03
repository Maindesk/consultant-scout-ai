import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function getLovableGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/**
 * Model split by job — extraction runs on the cheap flash-lite tier, anything
 * the prospect actually reads runs on the stronger flash tier.
 */
/** Structured extraction from scraped pages, classification. High volume, low cost. */
export const EXTRACT_MODEL = "google/gemini-3.1-flash-lite";
/** Copy the prospect reads, plus audience/business reasoning. Quality matters. */
export const WRITE_MODEL = "google/gemini-3.6-flash";

/** @deprecated use EXTRACT_MODEL or WRITE_MODEL */
export const CHAT_MODEL = WRITE_MODEL;
