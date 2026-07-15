import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeads, enrichLead, getLead } from "@/lib/leads.functions";
import { draftEmailsForLead } from "@/lib/drafts.functions";
import {
  provisionDemoSiteForLead,
  getFreshEditLink,
  getDemoSiteForLead,
  listAvailableTemplates,
} from "@/lib/platform.functions";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Sparkles, Mail, ExternalLink, Globe, KeyRound } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600",
  enriched: "bg-purple-500/10 text-purple-600",
  drafted: "bg-amber-500/10 text-amber-600",
  contacted: "bg-cyan-500/10 text-cyan-600",
  approved: "bg-green-500/10 text-green-600",
  sent: "bg-emerald-500/10 text-emerald-600",
  replied: "bg-pink-500/10 text-pink-600",
  in_progress: "bg-indigo-500/10 text-indigo-600",
  won: "bg-green-500/10 text-green-700",
  lost: "bg-gray-500/10 text-gray-600",
  rejected: "bg-gray-500/10 text-gray-600",
};

function ConfidenceBadge({ platform, confidence }: { platform?: string | null; confidence?: number | null }) {
  if (!platform) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(((confidence ?? 0) as number) * 100);
  const tone =
    pct >= 66 ? "bg-green-500/10 text-green-700 border-green-500/30"
    : pct >= 33 ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
    : "bg-gray-500/10 text-gray-600 border-gray-500/30";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${tone}`}>
      <span className="font-medium">{platform}</span>
      <span className="opacity-70">·</span>
      <span>{pct}%</span>
    </span>
  );
}

function LeadsPage() {
  const qc = useQueryClient();
  const fetchLeads = useServerFn(listLeads);
  const enrich = useServerFn(enrichLead);
  const draft = useServerFn(draftEmailsForLead);

  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => fetchLeads() });
  const [openId, setOpenId] = useState<string | null>(null);

  const enrichMut = useMutation({
    mutationFn: (id: string) => enrich({ data: { lead_id: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Enriched"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const draftMut = useMutation({
    mutationFn: (id: string) => draft({ data: { lead_id: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["drafts"] }); toast.success("Drafts ready — go review"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">{leads.length} leads discovered.</p>
      </div>

      {leads.length === 0 && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">No leads yet. Run discovery from the Targeting page.</CardContent></Card>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Domain</th>
              <th className="px-3 py-2 font-medium">Platform</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-3 py-2">
                  <button className="text-left hover:underline" onClick={() => setOpenId(l.id)}>
                    {l.business_name || l.domain}
                  </button>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{l.domain}</td>
                <td className="px-3 py-2"><ConfidenceBadge platform={l.platform} confidence={(l as any).platform_confidence} /></td>
                <td className="px-3 py-2"><Badge className={STATUS_COLORS[l.status] ?? ""} variant="secondary">{l.status}</Badge></td>
                <td className="px-3 py-2 text-right space-x-2">
                  {l.status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => enrichMut.mutate(l.id)} disabled={enrichMut.isPending}>
                      {enrichMut.isPending && enrichMut.variables === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                      Enrich
                    </Button>
                  )}
                  {l.status === "enriched" && (
                    <Button size="sm" onClick={() => draftMut.mutate(l.id)} disabled={draftMut.isPending}>
                      {draftMut.isPending && draftMut.variables === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
                      Draft
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeadDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function LeadDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const getLeadFn = useServerFn(getLead);
  const { data } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => getLeadFn({ data: { id: id! } }),
    enabled: !!id,
  });

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {data?.lead && (
          <>
            <SheetHeader>
              <SheetTitle>{data.lead.business_name || data.lead.domain}</SheetTitle>
              <a href={data.lead.website ?? "#"} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                {data.lead.website} <ExternalLink className="w-3 h-3" />
              </a>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              {data.lead.email && <div><span className="text-muted-foreground">Email:</span> {data.lead.email}</div>}
              {data.lead.platform && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Detected platform</div>
                  <div className="flex flex-wrap gap-1">
                    <ConfidenceBadge platform={data.lead.platform} confidence={(data.lead as any).platform_confidence} />
                    {Array.isArray((data.lead as any).platform_alternatives) &&
                      (data.lead as any).platform_alternatives.slice(0, 4).map((a: any) => (
                        <ConfidenceBadge key={a.platform} platform={a.platform} confidence={a.confidence} />
                      ))}
                  </div>
                  {(data.lead as any).platform_matches != null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {(data.lead as any).platform_matches} signature match{(data.lead as any).platform_matches === 1 ? "" : "es"} found in HTML
                    </div>
                  )}
                </div>
              )}
              {(data.lead as any).ai_stage_reason && (
                <div className="border-l-2 border-indigo-500 pl-3">
                  <div className="text-xs font-medium text-muted-foreground">AI stage decision</div>
                  <div className="text-xs">{(data.lead as any).ai_stage_reason}</div>
                </div>
              )}
              {data.enrichment && (
                <>
                  <Section title="Summary" body={data.enrichment.business_summary} />
                  <Section title="Offer" body={data.enrichment.offer} />
                  <Section title="Target audience" body={data.enrichment.target_audience} />
                  <Section title="Funnel presence" body={data.enrichment.funnel_presence} />
                  {Array.isArray(data.enrichment.pain_points) && data.enrichment.pain_points.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">Detected pain points</div>
                      <ul className="space-y-2">
                        {(data.enrichment.pain_points as Array<{ title: string; description: string }>).map((p, i) => (
                          <li key={i} className="border-l-2 border-amber-500 pl-3">
                            <div className="font-medium">{p.title}</div>
                            <div className="text-muted-foreground text-xs">{p.description}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(data.enrichment as any).website_signals && (
                    <WebsiteSignalsPanel signals={(data.enrichment as any).website_signals} />
                  )}
                </>
              )}

              <DemoSitePanel leadId={data.lead.id} />

              {data.drafts.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Drafted emails</div>
                  <div className="space-y-2">
                    {data.drafts.map((d) => (
                      <div key={d.id} className="border rounded p-3">
                        <div className="text-xs text-muted-foreground">Day {d.day_offset} · Step {d.step_number} · {d.status}</div>
                        <div className="font-medium mt-1">{d.subject}</div>
                        <div className="text-xs mt-1 whitespace-pre-wrap">{d.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DemoSitePanel({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const getSite = useServerFn(getDemoSiteForLead);
  const listTpls = useServerFn(listAvailableTemplates);
  const provision = useServerFn(provisionDemoSiteForLead);
  const editLink = useServerFn(getFreshEditLink);
  const [tpl, setTpl] = useState<string | undefined>(undefined);

  const { data: site } = useQuery({
    queryKey: ["demo-site", leadId],
    queryFn: () => getSite({ data: { lead_id: leadId } }),
  });
  const { data: templates } = useQuery({
    queryKey: ["demo-templates"],
    queryFn: () => listTpls(),
    staleTime: 5 * 60 * 1000,
  });

  const provMut = useMutation({
    mutationFn: () => provision({ data: { lead_id: leadId, template_id: tpl } }),
    onSuccess: () => {
      toast.success("Demo site provisioned");
      qc.invalidateQueries({ queryKey: ["demo-site", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const linkMut = useMutation({
    mutationFn: () => editLink({ data: { lead_id: leadId } }),
    onSuccess: (r: { url: string | null }) => {
      if (r.url) window.open(r.url, "_blank");
      qc.invalidateQueries({ queryKey: ["demo-site", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Globe className="w-3.5 h-3.5" /> Auto-provision a white-label demo site for this lead
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Spin up a pre-built site on your white-label platform tailored to this prospect's business, then drop a one-click edit link into the outreach email so they can log in, tweak it, and see exactly what switching to your white-label looks like — no signup friction.
      </p>
      {site ? (
        <div className="space-y-2">
          <div className="text-xs">
            Project <code>{site.project_id}</code>
            {site.subdomain && <> · {site.subdomain}</>}
          </div>
          <Button size="sm" variant="outline" onClick={() => linkMut.mutate()} disabled={linkMut.isPending}>
            {linkMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <KeyRound className="w-3 h-3 mr-1" />}
            Open one-click edit link
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {Array.isArray(templates) && templates.length > 0 && (
            <Select value={tpl} onValueChange={setTpl}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose template (optional)" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => provMut.mutate()} disabled={provMut.isPending}>
            {provMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
            Provision demo site
          </Button>
        </div>
      )}
    </div>
  );
}


function Section({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{title}</div>
      <div>{body}</div>
    </div>
  );
}

function WebsiteSignalsPanel({ signals }: { signals: any }) {
  const tools: Array<{ name: string; category: string }> = signals?.tools ?? [];
  const gaps: string[] = signals?.gaps ?? [];
  const perf = signals?.performance ?? null;
  const page = signals?.page ?? null;
  const perfBadge = (ms: number | null | undefined) => {
    if (ms == null) return "text-muted-foreground";
    if (ms < 800) return "text-green-600";
    if (ms < 2000) return "text-amber-600";
    return "text-red-600";
  };
  const pagesScraped: number | undefined = signals?.pages_scraped;
  const pageUrls: string[] = signals?.page_urls ?? [];
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">Website analysis</div>
        {pagesScraped ? (
          <span className="text-[10px] text-muted-foreground" title={pageUrls.join("\n")}>
            {pagesScraped} page{pagesScraped === 1 ? "" : "s"} scanned
          </span>
        ) : null}
      </div>
      {perf && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><div className="text-muted-foreground">TTFB</div><div className={perfBadge(perf.ttfb_ms)}>{perf.ttfb_ms ?? "?"} ms</div></div>
          <div><div className="text-muted-foreground">Total</div><div className={perfBadge(perf.total_ms)}>{perf.total_ms ?? "?"} ms</div></div>
          <div><div className="text-muted-foreground">Size</div><div>{perf.bytes ? Math.round(perf.bytes / 1024) + " KB" : "?"}</div></div>
        </div>
      )}
      {page && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            {page.word_count} words · H1: {page.has_h1 ? "yes" : "no"} · OG image: {page.has_og_image ? "yes" : "no"}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 border ${page.responsive ? "bg-green-500/10 text-green-700 border-green-500/30" : "bg-red-500/10 text-red-700 border-red-500/30"}`}
              title={page.responsive_signals ? `viewport meta: ${page.responsive_signals.viewport ? "✓" : "✗"} · media queries: ${page.responsive_signals.media_queries ? "✓" : "✗"} · responsive framework: ${page.responsive_signals.responsive_framework ? "✓" : "✗"} · srcset images: ${page.responsive_signals.srcset ? "✓" : "✗"} · fluid container: ${page.responsive_signals.fluid_container ? "✓" : "✗"}` : ""}>
              {page.responsive ? "Mobile-responsive" : "Not mobile-responsive"}
            </span>
          </div>
        </div>
      )}
      {tools.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Embedded tools ({tools.length})</div>
          <div className="flex flex-wrap gap-1">
            {tools.map((t) => (
              <span key={t.name} className="text-xs border rounded px-2 py-0.5 bg-muted/50" title={t.category}>
                {t.name} <span className="text-muted-foreground">· {t.category}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {gaps.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Gaps / opportunities</div>
          <ul className="text-xs list-disc pl-4 space-y-0.5">
            {gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

