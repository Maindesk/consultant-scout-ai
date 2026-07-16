import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getLovableGateway, CHAT_MODEL } from "./ai-gateway.server";

export const listSearchConfigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("search_configs")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createSearchConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string;
    niches: string[];
    locations: string[];
    keywords: string[];
    tech_stack?: string[];
    audience_description?: string;
    search_intents?: string[];
  }) => d)
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("search_configs")
      .insert({
        name: data.name,
        niches: data.niches,
        locations: data.locations,
        keywords: data.keywords,
        tech_stack: data.tech_stack ?? [],
        audience_description: data.audience_description ?? null,
        search_intents: data.search_intents ?? [],
        user_id: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteSearchConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("search_configs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

const AudienceSchema = z.object({
  suggested_name: z.string(),
  niches: z.array(z.string()),
  locations: z.array(z.string()),
  keywords: z.array(z.string()),
  search_intents: z.array(z.string()),
});

export const expandAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { description: string }) => {
    if (!d.description || d.description.trim().length < 10) {
      throw new Error("Describe your audience in at least a sentence.");
    }
    return d;
  })
  .handler(async ({ data }) => {
    const gateway = getLovableGateway();
    const prompt = `You turn a plain-English description of an ideal outbound prospect into a structured search config used to Google their websites.

Description:
"""${data.description.trim()}"""

Return JSON with:
- suggested_name: short label for this audience (max 60 chars)
- niches: 2-5 short niche/job/industry terms someone would call themselves (e.g. "yoga studio", "dental clinic", "SaaS founder")
- locations: locations only if the description names them, else []
- keywords: 2-6 extra descriptive terms (audience, size, offer). Skip generic words.
- search_intents: 4-8 SHORT phrases that would literally appear on this audience's own website, used as Google exact-match snippets. Prefer verbs, CTAs, and page copy patterns real practitioners write. Examples: "book a call", "our services", "get a quote", "menu", "add to cart", "class schedule", "patient portal", "free consultation". No hashtags, no long sentences, 2-5 words each.

Only return JSON matching the schema.`;

    try {
      const { output } = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema: AudienceSchema }),
        prompt,
      });
      return output;
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
      const raw = (err as any).text ?? "";
      const cleaned = raw.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/im, "").trim();
      try {
        const p: any = JSON.parse(cleaned);
        return {
          suggested_name: String(p.suggested_name ?? ""),
          niches: Array.isArray(p.niches) ? p.niches.map(String) : [],
          locations: Array.isArray(p.locations) ? p.locations.map(String) : [],
          keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
          search_intents: Array.isArray(p.search_intents) ? p.search_intents.map(String) : [],
        };
      } catch {
        throw new Error("AI returned malformed output; please retry.");
      }
    }
  });
