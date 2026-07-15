import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getFirecrawl, extractDomain } from "./firecrawl.server";
import { getLovableGateway, CHAT_MODEL } from "./ai-gateway.server";
import { detectPlatform } from "./platform-detect.server";
import { isJunkLead, buildPractitionerQueries } from "./lead-filters.server";
import type { PlatformName } from "./platforms";

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const [{ data: lead }, { data: enrichment }, { data: drafts }] = await Promise.all([
      context.supabase.from("leads").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("lead_enrichments").select("*").eq("lead_id", data.id).maybeSingle(),
      context.supabase
        .from("email_drafts")
        .select("*")
        .eq("lead_id", data.id)
        .eq("user_id", context.userId)
        .order("step_number"),
    ]);
    return { lead, enrichment, drafts: drafts ?? [] };
  });

export const discoverLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search_config_id: string; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const { data: cfg, error: cErr } = await context.supabase
      .from("search_configs")
      .select("*")
      .eq("id", data.search_config_id)
      .eq("user_id", context.userId)
      .single();
    if (cErr || !cfg) throw new Error("Search config not found");

    const fc = getFirecrawl();
    const limit = Math.min(data.limit ?? 15, 30);

    const techStack: PlatformName[] = (cfg.tech_stack ?? []) as PlatformName[];
    const platformHint = techStack[0] ?? null;
    const queries = buildPractitionerQueries({
      niches: cfg.niches ?? [],
      locations: cfg.locations ?? [],
      keywords: cfg.keywords ?? [],
      platform: platformHint,
    });

    // Over-fetch: junk filter + platform verification will drop many.
    const perQuery = Math.max(5, Math.ceil((limit * 4) / Math.max(queries.length, 1)));
    const found: Array<{ url: string; title?: string; description?: string; niche: string }> = [];

    for (const q of queries.slice(0, 6)) {
      try {
        const res: any = await fc.search(q, { limit: perQuery });
        const results = res?.web ?? res?.data ?? [];
        for (const r of results) {
          if (r?.url) {
            found.push({
              url: r.url,
              title: r.title,
              description: r.description,
              niche: (cfg.niches ?? [])[0] ?? "",
            });
          }
        }
      } catch (e) {
        console.error("firecrawl search failed", q, e);
      }
    }

    const seen = new Set<string>();
    const inserted: any[] = [];
    const rejected: Array<{ url: string; reason: string }> = [];

    for (const f of found) {
      if (inserted.length >= limit) break;
      const domain = extractDomain(f.url);
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);

      const junk = isJunkLead({ url: f.url, title: f.title, description: f.description, domain });
      if (junk.junk) {
        rejected.push({ url: f.url, reason: junk.reason ?? "junk" });
        continue;
      }

      // If user requires a specific platform, verify BEFORE saving as a lead.
      let verifiedPlatform: PlatformName | null = null;
      if (techStack.length > 0) {
        try {
          const scrape: any = await fc.scrape(f.url, { formats: ["html"], onlyMainContent: false });
          const html = scrape?.html ?? scrape?.rawHtml ?? "";
          verifiedPlatform = detectPlatform(html);
          if (!verifiedPlatform || !techStack.includes(verifiedPlatform)) {
            rejected.push({ url: f.url, reason: `platform mismatch (${verifiedPlatform ?? "unknown"})` });
            continue;
          }
        } catch (e) {
          rejected.push({ url: f.url, reason: "scrape failed" });
          continue;
        }
      }

      const { data: row, error } = await context.supabase
        .from("leads")
        .upsert(
          {
            user_id: context.userId,
            search_config_id: cfg.id,
            website: f.url,
            domain,
            business_name: f.title,
            niche: f.niche,
            source: "firecrawl_search",
            status: "new",
            platform: verifiedPlatform,
          },
          { onConflict: "user_id,domain", ignoreDuplicates: true },
        )
        .select()
        .maybeSingle();
      if (!error && row) inserted.push(row);
    }
    return { discovered: inserted.length, rejected: rejected.length, sample_rejected: rejected.slice(0, 5) };
  });

const EnrichmentSchema = z.object({
  business_summary: z.string(),
  offer: z.string(),
  target_audience: z.string(),
  pricing_signals: z.string(),
  funnel_presence: z.string(),
  contact_email: z.string().nullable(),
  pain_points: z.array(z.object({ title: z.string(), description: z.string() })),
});

export const enrichLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: lead, error } = await context.supabase
      .from("leads")
      .select("*")
      .eq("id", data.lead_id)
      .eq("user_id", context.userId)
      .single();
    if (error || !lead) throw new Error("Lead not found");
    if (!lead.website) throw new Error("Lead has no website");

    const fc = getFirecrawl();
    let markdown = "";
    let html = "";
    try {
      const res: any = await fc.scrape(lead.website, {
        formats: ["markdown", "html"],
        onlyMainContent: false,
      });
      markdown = res?.markdown ?? "";
      html = res?.html ?? res?.rawHtml ?? "";
    } catch (e) {
      console.error("scrape failed", e);
    }

    const platform = detectPlatform(html);

    // If search config had a tech_stack filter and platform doesn't match, discard
    if (lead.search_config_id) {
      const { data: cfg } = await context.supabase
        .from("search_configs")
        .select("tech_stack")
        .eq("id", lead.search_config_id)
        .maybeSingle();
      const filter: string[] = cfg?.tech_stack ?? [];
      if (filter.length > 0 && (!platform || !filter.includes(platform))) {
        await context.supabase
          .from("leads")
          .update({ platform, status: "filtered_out" })
          .eq("id", lead.id);
        return { ok: true, filtered: true, platform };
      }
    }

    const gateway = getLovableGateway();
    const { output } = await generateText({
      model: gateway(CHAT_MODEL),
      output: Output.object({ schema: EnrichmentSchema }),
      prompt: `Analyze this coach/consultant business site and extract structured intel. Find contact email if visible on the page.

URL: ${lead.website}
Business name: ${lead.business_name ?? "unknown"}
Detected platform: ${platform ?? "unknown"}

Content:
${markdown.slice(0, 15000) || "(no content)"}
`,
    });

    await context.supabase.from("lead_enrichments").upsert(
      {
        lead_id: lead.id,
        user_id: context.userId,
        business_summary: output.business_summary,
        offer: output.offer,
        target_audience: output.target_audience,
        pricing_signals: output.pricing_signals,
        funnel_presence: output.funnel_presence,
        pain_points: output.pain_points,
        raw_markdown: markdown.slice(0, 20000),
      },
      { onConflict: "lead_id" },
    );

    await context.supabase
      .from("leads")
      .update({
        status: "enriched",
        email: output.contact_email ?? lead.email,
        platform,
      })
      .eq("id", lead.id);

    return { ok: true, platform };
  });
