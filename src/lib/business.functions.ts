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

    let scraped = "";
    try {
      const fc = getFirecrawl();
      const res = await fc.scrape(profile.website_url, {
        formats: ["markdown"],
        onlyMainContent: true,
      });
      scraped = (res as { markdown?: string }).markdown ?? "";
    } catch (e) {
      console.error("firecrawl scrape failed", e);
    }

    const gateway = getLovableGateway();
    const prompt = `Analyze this coaching/consulting business and extract key details.

Website URL: ${profile.website_url}
Owner-provided offer: ${profile.offer_description ?? "(none)"}

Website content (markdown):
${scraped.slice(0, 12000) || "(no content scraped)"}
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
