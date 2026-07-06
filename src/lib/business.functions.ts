import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getLovableGateway, CHAT_MODEL } from "./ai-gateway.server";
import { getFirecrawl } from "./firecrawl.server";

export const getBusinessProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const saveBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    website_url?: string;
    offer_description?: string;
    sender_name?: string;
    sender_email?: string;
    daily_send_cap?: number;
  }) => d)
  .handler(async ({ context, data }) => {
    const { data: existing } = await context.supabase
      .from("business_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await context.supabase
        .from("business_profiles")
        .update(data)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    }
    const { data: created, error } = await context.supabase
      .from("business_profiles")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw error;
    return created;
  });

// --- Business knowledge sources (multiple URLs) ---

export const listBusinessSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("business_sources")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const addBusinessSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; label?: string; source_type?: string }) => d)
  .handler(async ({ context, data }) => {
    const url = data.url.trim();
    if (!url) throw new Error("URL required");
    const { data: row, error } = await context.supabase
      .from("business_sources")
      .upsert(
        {
          user_id: context.userId,
          url,
          label: data.label ?? null,
          source_type: data.source_type ?? "page",
        },
        { onConflict: "user_id,url" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteBusinessSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("business_sources")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

async function scrapeMarkdown(url: string): Promise<string> {
  try {
    const fc = getFirecrawl();
    const res: any = await fc.scrape(url, { formats: ["markdown"], onlyMainContent: true });
    return res?.markdown ?? "";
  } catch (e) {
    console.error("scrape failed", url, e);
    return "";
  }
}

/**
 * Full retrain: scrapes the main site + all business_sources, then rebuilds
 * the AI understanding stored on business_profiles.
 */
export const analyzeMyBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile?.website_url) throw new Error("Add your website URL first");

    // Scrape main site
    const mainMd = await scrapeMarkdown(profile.website_url);

    // Scrape all extra sources (and store per-source markdown)
    const { data: sources } = await context.supabase
      .from("business_sources")
      .select("*")
      .eq("user_id", context.userId);

    const perSource: Array<{ url: string; label: string; markdown: string }> = [];
    for (const s of sources ?? []) {
      const md = await scrapeMarkdown(s.url);
      await context.supabase
        .from("business_sources")
        .update({ scraped_markdown: md.slice(0, 20000), last_scraped_at: new Date().toISOString() })
        .eq("id", s.id);
      perSource.push({ url: s.url, label: s.label ?? s.source_type ?? "page", markdown: md });
    }

    const combined = [
      `# Main site (${profile.website_url})\n${mainMd.slice(0, 10000)}`,
      ...perSource.map((s) => `# ${s.label} (${s.url})\n${s.markdown.slice(0, 6000)}`),
    ].join("\n\n---\n\n");

    const gateway = getLovableGateway();
    const prompt = `You are analyzing a coaching/consulting business to build a knowledge base used to personalize cold outreach.

Owner-provided offer: ${profile.offer_description ?? "(none)"}

All source content (main site + supporting pages):
${combined.slice(0, 30000) || "(no content)"}
`;

    try {
      const { output } = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({
          schema: z.object({
            ai_summary: z.string(),
            value_proposition: z.string(),
            ideal_client: z.string(),
            services: z.array(z.string()),
          }),
        }),
        prompt,
      });

      const { data: updated, error } = await context.supabase
        .from("business_profiles")
        .update({
          ai_summary: output.ai_summary,
          value_proposition: output.value_proposition,
          ideal_client: output.ideal_client,
          services: output.services,
        })
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } catch (e) {
      console.error("AI analyze failed", e);
      throw new Error("AI analysis failed. Please try again.");
    }
  });
