import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getFirecrawl, extractDomain } from "./firecrawl.server";
import { getLovableGateway, CHAT_MODEL } from "./ai-gateway.server";
import { detectPlatform, detectPlatformDetailed } from "./platform-detect.server";
import { isJunkLead, buildPractitionerQueries } from "./lead-filters.server";
import type { PlatformName } from "./platforms";
import { PIPELINE_STAGES, isLeadStage, type LeadStage } from "./pipeline";

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
    const limit = Math.min(Math.max(data.limit ?? 15, 1), 100);

    // Quota gate — check workspace lead budget before spending Firecrawl calls.
    const { getActiveWorkspaceIdForUser, checkQuota, recordUsage } = await import("./quota.server");
    const workspaceId = await getActiveWorkspaceIdForUser(context.userId);
    if (workspaceId) {
      const q = await checkQuota(workspaceId, "leads_discovered", 1);
      if (!q.ok) throw new Error(q.message ?? "Lead quota exceeded");
    }


    const techStack: PlatformName[] = (cfg.tech_stack ?? []) as PlatformName[];
    const platformHint = techStack[0] ?? null;
    const queries = buildPractitionerQueries({
      niches: cfg.niches ?? [],
      locations: cfg.locations ?? [],
      keywords: cfg.keywords ?? [],
      platform: platformHint,
    });

    // Over-fetch: junk filter + platform verification will drop many.
    const perQuery = Math.max(10, Math.ceil((limit * 5) / Math.max(queries.length, 1)));
    const found: Array<{ url: string; title?: string; description?: string; niche: string }> = [];

    const searchResults = await Promise.all(
      queries.slice(0, 10).map(async (q) => {
        try {
          const res: any = await fc.search(q, { limit: perQuery });
          return res?.web ?? res?.data ?? [];
        } catch (e) {
          console.error("firecrawl search failed", q, e);
          return [];
        }
      }),
    );
    for (const results of searchResults) {
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
    }

    // Dedupe by domain + drop junk before verification.
    const seen = new Set<string>();
    const candidates: Array<{ url: string; title?: string; description?: string; niche: string; domain: string }> = [];
    const rejected: Array<{ url: string; reason: string }> = [];
    for (const f of found) {
      const domain = extractDomain(f.url);
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      const junk = isJunkLead({ url: f.url, title: f.title, description: f.description, domain });
      if (junk.junk) {
        rejected.push({ url: f.url, reason: junk.reason ?? "junk" });
        continue;
      }
      candidates.push({ ...f, domain });
    }

    // Verify platform in parallel batches to hit the requested limit quickly.
    const inserted: any[] = [];
    const BATCH = 6;
    for (let i = 0; i < candidates.length && inserted.length < limit; i += BATCH) {
      const batch = candidates.slice(i, i + BATCH);
      const verified = await Promise.all(
        batch.map(async (c) => {
          let detection = { platform: null as PlatformName | null, confidence: 0, matches: 0, alternatives: [] as any[] };
          if (techStack.length > 0) {
            try {
              const scrape: any = await fc.scrape(c.url, { formats: ["html"], onlyMainContent: false });
              const html = scrape?.html ?? scrape?.rawHtml ?? "";
              detection = detectPlatformDetailed(html);
              if (!detection.platform || !techStack.includes(detection.platform)) {
                rejected.push({ url: c.url, reason: `platform mismatch (${detection.platform ?? "unknown"})` });
                return null;
              }
            } catch {
              rejected.push({ url: c.url, reason: "scrape failed" });
              return null;
            }
          }
          return { c, detection };
        }),
      );
      for (const v of verified) {
        if (!v) continue;
        if (inserted.length >= limit) break;
        const { c, detection } = v;
        const { data: row, error } = await context.supabase
          .from("leads")
          .upsert(
            {
              user_id: context.userId,
              search_config_id: cfg.id,
              website: c.url,
              domain: c.domain,
              business_name: c.title,
              niche: c.niche,
              source: "firecrawl_search",
              status: "new",
              platform: detection.platform,
              platform_confidence: detection.confidence,
              platform_matches: detection.matches,
              platform_alternatives: detection.alternatives,
            },
            { onConflict: "user_id,domain", ignoreDuplicates: true },
          )
          .select()
          .maybeSingle();
        if (!error && row) inserted.push(row);
      }
    }
    if (workspaceId && inserted.length > 0) {
      await recordUsage(workspaceId, { leads: inserted.length });
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

    const { deepScrapeSite } = await import("./deep-scrape.server");
    let markdown = "";
    let html = "";
    let pagesScraped = 0;
    let pageUrls: string[] = [];
    try {
      const deep = await deepScrapeSite(lead.website);
      markdown = deep.aggregatedMarkdown;
      html = deep.aggregatedHtml;
      pagesScraped = deep.pagesScraped;
      pageUrls = deep.pages.map((p) => p.url);
    } catch (e) {
      console.error("deep scrape failed", e);
    }

    const detection = detectPlatformDetailed(html);
    const platform = detection.platform;

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
          .update({
            platform,
            platform_confidence: detection.confidence,
            platform_matches: detection.matches,
            platform_alternatives: detection.alternatives,
            status: "filtered_out",
          })
          .eq("id", lead.id);
        return { ok: true, filtered: true, platform };
      }
    }

    const { analyzeWebsite, summarizeSignalsForPrompt } = await import("./website-signals.server");
    const signals = await analyzeWebsite(lead.website, html);

    const { getActiveWorkspaceIdForUser, checkQuota, recordUsage, estimateAiCredits } = await import("./quota.server");
    const workspaceId = await getActiveWorkspaceIdForUser(context.userId);
    if (workspaceId) {
      const q = await checkQuota(workspaceId, "ai_credits", 5);
      if (!q.ok) throw new Error(q.message ?? "AI credit quota exceeded");
    }

    const gateway = getLovableGateway();
    let output: z.infer<typeof EnrichmentSchema>;
    let totalTokens = 0;
    const prompt = `Analyze this business website and extract structured intel. Find contact email if visible on the page. Return ONLY JSON matching the schema; use empty strings for unknown text fields, null for contact_email if not found, and [] for pain_points if none.

URL: ${lead.website}
Business name: ${lead.business_name ?? "unknown"}
Detected platform: ${platform ?? "unknown"}

Website signals (embedded 3rd-party tools, page metrics, perf, gaps):
${summarizeSignalsForPrompt(signals)}

Content:
${markdown.slice(0, 15000) || "(no content)"}
`;
    try {
      const res = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema: EnrichmentSchema }),
        prompt,
      });
      output = res.output;
      totalTokens = res.usage?.totalTokens ?? 0;
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
      const raw = (err as any).text ?? "";
      totalTokens = (err as any).usage?.totalTokens ?? 0;
      const cleaned = raw.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/im, "").trim();
      let parsed: unknown;
      try { parsed = JSON.parse(cleaned); } catch {
        throw new Error("AI returned malformed output; please retry.");
      }
      const p: any = parsed ?? {};
      output = {
        business_summary: String(p.business_summary ?? ""),
        offer: String(p.offer ?? ""),
        target_audience: String(p.target_audience ?? ""),
        pricing_signals: String(p.pricing_signals ?? ""),
        funnel_presence: String(p.funnel_presence ?? ""),
        contact_email: p.contact_email ? String(p.contact_email) : null,
        pain_points: Array.isArray(p.pain_points)
          ? p.pain_points
              .filter((x: any) => x && (x.title || x.description))
              .map((x: any) => ({ title: String(x.title ?? ""), description: String(x.description ?? "") }))
          : [],
      };
    }
    if (workspaceId) await recordUsage(workspaceId, { ai: estimateAiCredits(totalTokens) });


    const { error: upsertErr } = await context.supabase.from("lead_enrichments").upsert(
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
        website_signals: { ...(signals as any), pages_scraped: pagesScraped, page_urls: pageUrls },
      },
      { onConflict: "lead_id" },
    );
    if (upsertErr) {
      console.error("lead_enrichments upsert failed", upsertErr);
      throw new Error(`Failed to save enrichment: ${upsertErr.message}`);
    }

    const { error: updateErr } = await context.supabase
      .from("leads")
      .update({
        status: "enriched",
        email: output.contact_email ?? lead.email,
        platform,
        platform_confidence: detection.confidence,
        platform_matches: detection.matches,
        platform_alternatives: detection.alternatives,
      })
      .eq("id", lead.id);
    if (updateErr) {
      console.error("leads update after enrichment failed", updateErr);
      throw new Error(`Failed to update lead status: ${updateErr.message}`);
    }

    return { ok: true, platform, confidence: detection.confidence };
  });


export const updateLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lead_id: string; stage: LeadStage }) => {
    if (!isLeadStage(d.stage)) throw new Error(`Invalid stage: ${d.stage}`);
    return d;
  })
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("leads")
      .update({
        status: data.stage,
        stage_updated_at: new Date().toISOString(),
        ai_stage_reason: null, // manual moves clear the AI reason
      })
      .eq("id", data.lead_id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const listPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: leads, error }, { data: profile }] = await Promise.all([
      context.supabase
        .from("leads")
        .select("id, business_name, domain, website, status, platform, platform_confidence, niche, stage_updated_at, ai_stage_reason, email")
        .eq("user_id", context.userId)
        .in("status", PIPELINE_STAGES as unknown as string[])
        .order("stage_updated_at", { ascending: false })
        .limit(500),
      context.supabase
        .from("business_profiles")
        .select("avg_deal_value, avg_close_rate, currency")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (error) throw error;

    // Batch-fetch demo site info for the returned leads.
    const leadIds = (leads ?? []).map((l) => l.id);
    let demoByLead: Record<string, boolean> = {};
    if (leadIds.length) {
      const { data: sites } = await context.supabase
        .from("lead_platform_sites")
        .select("lead_id")
        .in("lead_id", leadIds);
      demoByLead = Object.fromEntries((sites ?? []).map((s) => [s.lead_id, true]));
    }

    return {
      leads: (leads ?? []).map((l) => ({ ...l, has_demo: !!demoByLead[l.id] })),
      avg_deal_value: Number(profile?.avg_deal_value ?? 0),
      avg_close_rate: Number(profile?.avg_close_rate ?? 0.1),
      currency: profile?.currency ?? "USD",
    };
  });


