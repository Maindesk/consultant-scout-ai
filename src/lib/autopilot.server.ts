/**
 * Shared autopilot runner. Called by manual "Run now" server fn and the daily cron.
 * Runs, per user with autopilot enabled:
 *   1. Discover N new leads via Firecrawl using their active search_config
 *   2. Enrich each (scrape + AI + platform detect + tech_stack filter)
 *   3. Draft the 4-email sequence for each remaining lead
 *
 * All heavy work goes through admin client since cron has no user session.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getFirecrawl, extractDomain } from "./firecrawl.server";
import { getLovableGateway, CHAT_MODEL } from "./ai-gateway.server";
import { detectPlatform, detectPlatformDetailed } from "./platform-detect.server";
import { isJunkLead, buildPractitionerQueries } from "./lead-filters.server";
import type { PlatformName } from "./platforms";

const EnrichmentSchema = z.object({
  business_summary: z.string(),
  offer: z.string(),
  target_audience: z.string(),
  pricing_signals: z.string(),
  funnel_presence: z.string(),
  contact_email: z.string().nullable(),
  pain_points: z.array(z.object({ title: z.string(), description: z.string() })),
});

const SequenceSchema = z.object({
  emails: z.array(
    z.object({
      step_number: z.number(),
      day_offset: z.number(),
      subject: z.string(),
      body: z.string(),
    }),
  ),
});

const SKIP_DOMAINS = /^(?:facebook|instagram|linkedin|twitter|x|youtube|tiktok|yelp|reddit|medium|wikipedia|amazon|apple|google)\./;

export interface AutopilotResult {
  user_id: string;
  discovered: number;
  enriched: number;
  drafted: number;
  filtered_out: number;
  errors: string[];
}

export async function runAutopilotForUser(userId: string): Promise<AutopilotResult> {
  const result: AutopilotResult = {
    user_id: userId,
    discovered: 0,
    enriched: 0,
    drafted: 0,
    filtered_out: 0,
    errors: [],
  };

  const { data: settings } = await supabaseAdmin
    .from("automation_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settings?.enabled) return result;
  if (!settings.active_search_config_id) {
    result.errors.push("No active search config");
    return result;
  }

  const { data: cfg } = await supabaseAdmin
    .from("search_configs")
    .select("*")
    .eq("id", settings.active_search_config_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!cfg) {
    result.errors.push("Search config not found");
    return result;
  }

  const { data: bp } = await supabaseAdmin
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { getActiveWorkspaceIdForUser, checkQuota, recordUsage, estimateAiCredits } = await import("./quota.server");
  const workspaceId = await getActiveWorkspaceIdForUser(userId);

  const target = Math.min(settings.daily_lead_target ?? 10, 50);
  const fc = getFirecrawl();
  const gateway = getLovableGateway();

  if (workspaceId) {
    const leadQuota = await checkQuota(workspaceId, "leads_discovered", target);
    if (!leadQuota.ok) {
      result.errors.push(leadQuota.message ?? "Lead quota exceeded");
      return result;
    }
  }


  // 1. Discover — practitioner-focused queries + junk/platform filtering
  const techStack: PlatformName[] = (cfg.tech_stack ?? []) as PlatformName[];
  const queries = buildPractitionerQueries({
    niches: cfg.niches ?? [],
    locations: cfg.locations ?? [],
    keywords: cfg.keywords ?? [],
    platform: techStack[0] ?? null,
  });

  const perQuery = Math.max(5, Math.ceil((target * 4) / Math.max(queries.length, 1)));
  const found: Array<{ url: string; title?: string; description?: string; niche: string }> = [];
  for (const q of queries.slice(0, 6)) {
    try {
      const res: any = await fc.search(q, { limit: perQuery });
      const results = res?.web ?? res?.data ?? [];
      for (const r of results) {
        if (r?.url) found.push({ url: r.url, title: r.title, description: r.description, niche: (cfg.niches ?? [])[0] ?? "" });
      }
    } catch (e) {
      result.errors.push(`search failed: ${String(e)}`);
    }
  }

  const seen = new Set<string>();
  const newLeads: any[] = [];
  for (const f of found) {
    if (newLeads.length >= target) break;
    const domain = extractDomain(f.url);
    if (!domain || seen.has(domain) || SKIP_DOMAINS.test(domain)) continue;
    seen.add(domain);

    const junk = isJunkLead({ url: f.url, title: f.title, description: f.description, domain });
    if (junk.junk) {
      result.filtered_out += 1;
      continue;
    }

    // If a platform is required, verify BEFORE saving.
    let detection = { platform: null as PlatformName | null, confidence: 0, matches: 0, alternatives: [] as any[] };
    if (techStack.length > 0) {
      try {
        const scrape: any = await fc.scrape(f.url, { formats: ["html"], onlyMainContent: false });
        const html = scrape?.html ?? scrape?.rawHtml ?? "";
        detection = detectPlatformDetailed(html);
        if (!detection.platform || !techStack.includes(detection.platform)) {
          result.filtered_out += 1;
          continue;
        }
      } catch {
        result.filtered_out += 1;
        continue;
      }
    }

    const { data: row } = await supabaseAdmin
      .from("leads")
      .upsert(
        {
          user_id: userId,
          search_config_id: cfg.id,
          website: f.url,
          domain,
          business_name: f.title,
          niche: f.niche,
          source: "autopilot",
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
    if (row) newLeads.push(row);
  }
  result.discovered = newLeads.length;
  if (workspaceId && newLeads.length > 0) {
    await recordUsage(workspaceId, { leads: newLeads.length });
  }


  // 2. Enrich
  const techFilter: string[] = cfg.tech_stack ?? [];
  const enrichedLeads: any[] = [];
  for (const lead of newLeads) {
    try {
      let md = "";
      let html = "";
      try {
        const r: any = await fc.scrape(lead.website, { formats: ["markdown", "html"], onlyMainContent: false });
        md = r?.markdown ?? "";
        html = r?.html ?? r?.rawHtml ?? "";
      } catch (e) {
        result.errors.push(`scrape ${lead.website}: ${String(e)}`);
      }
      const platform = detectPlatform(html);

      if (techFilter.length > 0 && (!platform || !techFilter.includes(platform))) {
        await supabaseAdmin.from("leads").update({ platform, status: "filtered_out" }).eq("id", lead.id);
        result.filtered_out += 1;
        continue;
      }

      const { output, usage: enrichUsage } = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema: EnrichmentSchema }),
        prompt: `Analyze this business's website and extract structured intel.

URL: ${lead.website}
Business: ${lead.business_name ?? "unknown"}
Platform: ${platform ?? "unknown"}

Content:
${md.slice(0, 15000) || "(no content)"}`,
      });
      if (workspaceId) await recordUsage(workspaceId, { ai: estimateAiCredits(enrichUsage?.totalTokens ?? 0) });


      const { analyzeWebsite } = await import("./website-signals.server");
      const signals = await analyzeWebsite(lead.website, html);

      await supabaseAdmin.from("lead_enrichments").upsert(
        {
          lead_id: lead.id,
          user_id: userId,
          business_summary: output.business_summary,
          offer: output.offer,
          target_audience: output.target_audience,
          pricing_signals: output.pricing_signals,
          funnel_presence: output.funnel_presence,
          pain_points: output.pain_points,
          raw_markdown: md.slice(0, 20000),
          website_signals: signals as any,
        },
        { onConflict: "lead_id" },
      );


      await supabaseAdmin
        .from("leads")
        .update({ status: "enriched", platform, email: output.contact_email ?? lead.email })
        .eq("id", lead.id);

      enrichedLeads.push({ ...lead, platform, enrichment: output, signals });
      result.enriched += 1;
    } catch (e) {
      result.errors.push(`enrich ${lead.website}: ${String(e)}`);
    }
  }

  // 3. Draft
  if (!bp || !settings.auto_draft) return result;

  const { goalFraming, EMAIL_GOAL_LABELS } = await import("./email-goals");
  const goal = (bp as any).default_email_goal ?? "book_meeting";

  for (const lead of enrichedLeads) {
    try {
      const { output, usage: draftUsage } = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema: SequenceSchema }),
        prompt: `Personalized cold outreach sequence from ${bp.sender_name ?? "the sender"} to a ${lead.niche ?? "business owner"}.

The angle is NOT one feature. The angle is: their current website platform (${lead.platform ?? "their current builder"}) forces them to duct-tape 3rd-party tools together — fragmenting brand, hurting perf, and stacking monthly subscriptions. Our platform replaces that stack with one on-brand, all-in-one solution.

Sender platform:
- Summary: ${bp.ai_summary ?? bp.offer_description ?? ""}
- Value prop: ${bp.value_proposition ?? ""}
- Ideal client: ${bp.ideal_client ?? ""}
- Native platform capabilities (things WE ship out of the box):
${(bp as any).product_capabilities ?? "(none provided)"}

Prospect:
- Business: ${lead.business_name ?? lead.domain}
- Website: ${lead.website}
- Current platform: ${lead.platform ?? "unknown"}
- Summary: ${lead.enrichment.business_summary}
- Their offer: ${lead.enrichment.offer}
- Audience: ${lead.enrichment.target_audience}
- Pain points: ${JSON.stringify(lead.enrichment.pain_points)}
- Embedded 3rd-party tools stitched onto their site: ${JSON.stringify(lead.signals?.tools ?? [])}
- Site gaps: ${JSON.stringify(lead.signals?.gaps ?? [])}
- Perf: ${JSON.stringify(lead.signals?.performance ?? {})}

Campaign goal: ${EMAIL_GOAL_LABELS[goal as keyof typeof EMAIL_GOAL_LABELS] ?? goal}
${goalFraming(goal)}

4-email sequence: initial + 3 follow-ups. Tone: professional.
- Pitch is a PLATFORM SWITCH, never one feature.
- Email 1: name 2-3 detected 3rd-party tools, frame the stack sprawl (fragmented brand + monthly cost + slower site), position our platform as the consolidated on-brand replacement, and reference native capabilities to prove the switch is a superset.
- Email 2: quantify drag (overlapping subs, brand inconsistency, perf hit).
- Email 3: proof / migration-is-handled objection killer. If a personalized demo edit link will be inserted, hint that a preview tailored to their brand is ready to explore (use {{DEMO_LINK}} placeholder — do NOT invent a URL).
- Email 4: soft break-up matching goal.
- If no tools detected, use gaps + platform limitations instead.
- Under 130 words each. Day offsets 0, 3, 7, 14. Subject under 60 chars. CTA matches campaign goal.`,

      });
      if (workspaceId) await recordUsage(workspaceId, { ai: estimateAiCredits(draftUsage?.totalTokens ?? 0) });


      await supabaseAdmin
        .from("email_drafts")
        .delete()
        .eq("lead_id", lead.id)
        .eq("user_id", userId)
        .in("status", ["pending_approval", "rejected"]);

      const rows = output.emails.map((e) => ({
        user_id: userId,
        lead_id: lead.id,
        step_number: e.step_number,
        day_offset: e.day_offset,
        subject: e.subject,
        body: e.body,
        tone: "professional",
        status: "pending_approval",
      }));
      await supabaseAdmin.from("email_drafts").insert(rows);
      await supabaseAdmin.from("leads").update({ status: "drafted" }).eq("id", lead.id);
      result.drafted += 1;
    } catch (e) {
      result.errors.push(`draft ${lead.website}: ${String(e)}`);
    }
  }

  const summary = `discovered ${result.discovered}, enriched ${result.enriched}, drafted ${result.drafted}, filtered ${result.filtered_out}`;
  await supabaseAdmin
    .from("automation_settings")
    .update({ last_run_at: new Date().toISOString(), last_run_summary: summary })
    .eq("user_id", userId);

  return result;
}
