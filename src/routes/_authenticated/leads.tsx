import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeads, enrichLead, getLead, pushLeadTagToMainSite } from "@/lib/leads.functions";
import { draftEmailsForLead } from "@/lib/drafts.functions";
import {
  provisionDemoSiteForLead,
  getFreshEditLink,
  getDemoSiteForLead,
  listAvailableTemplates,
  setDemoSiteApproval,
} from "@/lib/platform.functions";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Mail, ExternalLink, Globe, KeyRound, Tag, Plus } from "lucide-react";
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

  const [hideUncontactable, setHideUncontactable] = useState(true);
  const visibleLeads = hideUncontactable
    ? leads.filter((l) => !!l.email || l.status === "new")
    : leads;
  const hiddenCount = leads.length - visibleLeads.length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {visibleLeads.length} shown{hiddenCount > 0 ? ` · ${hiddenCount} hidden (no email found)` : ""}.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setHideUncontactable((v) => !v)}>
          {hideUncontactable ? "Show uncontactable" : "Hide uncontactable"}
        </Button>
      </div>

      {leads.length === 0 && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">No leads yet. Run discovery from the Targeting page.</CardContent></Card>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Platform</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleLeads.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-3 py-2">
                  <button className="text-left hover:underline" onClick={() => setOpenId(l.id)}>
                    {l.business_name || l.domain}
                  </button>
                  <div className="text-xs text-muted-foreground">{l.domain}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {l.email || <span className="text-xs text-amber-600">none found</span>}
                </td>
                <td className="px-3 py-2"><ConfidenceBadge platform={l.platform} confidence={(l as any).platform_confidence} /></td>
                <td className="px-3 py-2"><Badge className={STATUS_COLORS[l.status] ?? ""} variant="secondary">{l.status}</Badge></td>
                <td className="px-3 py-2 text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => enrichMut.mutate(l.id)} disabled={enrichMut.isPending}>
                    {enrichMut.isPending && enrichMut.variables === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    {l.status === "new" ? "Enrich" : "Re-enrich"}
                  </Button>
                  {l.status !== "new" && (
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
  const enrichFn = useServerFn(enrichLead);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => getLeadFn({ data: { id: id! } }),
    enabled: !!id,
  });
  const reEnrich = useMutation({
    mutationFn: () => enrichFn({ data: { lead_id: id! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Re-enriched");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
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
              <Button size="sm" variant="outline" className="w-full" onClick={() => reEnrich.mutate()} disabled={reEnrich.isPending}>
                {reEnrich.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Re-run enrichment (find name & email)
              </Button>
              <ContactPanel
                name={(data.lead as any).name}
                email={data.lead.email}
                contacts={(data.enrichment as any)?.website_signals?.contacts}
                enriched={!!data.enrichment}
              />


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
                    <>
                      <FeatureComparisonTable signals={(data.enrichment as any).website_signals} />
                      <WebsiteSignalsPanel signals={(data.enrichment as any).website_signals} />
                    </>
                  )}
                </>
              )}

              <DemoSitePanel leadId={data.lead.id} />

              <MainSiteTagPanel
                leadId={data.lead.id}
                email={data.lead.email}
                tags={((data.lead as any).main_site_tags as string[] | null) ?? []}
              />

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
  const approve = useServerFn(setDemoSiteApproval);
  const [tpl, setTpl] = useState<string | undefined>(undefined);
  const [showPreview, setShowPreview] = useState(true);

  const { data: site } = useQuery({
    queryKey: ["demo-site", leadId],
    queryFn: () => getSite({ data: { lead_id: leadId } }),
  });
  const { data: tplRes } = useQuery({
    queryKey: ["demo-templates"],
    queryFn: () => listTpls(),
    staleTime: 5 * 60 * 1000,
  });
  const templates = tplRes?.templates ?? [];
  const selected = templates.find((t) => t.id === tpl);

  const provMut = useMutation({
    mutationFn: () =>
      provision({
        data: {
          lead_id: leadId,
          ...(selected?.type === "FUNNEL" ? { funnel_template_id: tpl } : { template_id: tpl }),
        },
      }),
    onSuccess: (r: any) => {
      toast.success(r?.created ? "Demo site created — review the preview below" : "Demo site already exists");
      qc.invalidateQueries({ queryKey: ["demo-site", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const approveMut = useMutation({
    mutationFn: (approved: boolean) => approve({ data: { lead_id: leadId, approved } }),
    onSuccess: (_r, approved) => {
      toast.success(approved ? "Approved — the demo link can now go out in emails" : "Approval revoked");
      qc.invalidateQueries({ queryKey: ["demo-site", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const linkMut = useMutation({
    mutationFn: () => editLink({ data: { lead_id: leadId } }),
    onSuccess: (r: { url: string | null }) => {
      if (r.url) {
        window.open(r.url, "_blank");
        toast.success("One-click edit link opened (valid 15 min)");
      } else {
        toast.error("Platform returned no access URL");
      }
      qc.invalidateQueries({ queryKey: ["demo-site", leadId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tags = (site?.personalization_tags ?? {}) as Record<string, string>;
  const injected = Object.entries(tags).filter(([, v]) => v);

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Globe className="w-3.5 h-3.5" /> Auto-provision a white-label demo site for this lead
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Spin up a pre-built site on your white-label platform tailored to this prospect's business — their name,
        contact details, industry and brand colour are injected into the template. Preview it, approve it, then a
        one-click edit link goes out in the outreach email so they can log in and tweak it with no signup friction.
      </p>

      {site ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className={site.approved ? "bg-green-500/10 text-green-700" : "bg-amber-500/10 text-amber-700"}>
              {site.approved ? "Approved for outreach" : "Pending your approval"}
            </Badge>
            <span className="text-muted-foreground">
              Project <code>{site.project_id}</code>
              {site.subdomain && <> · {site.subdomain}</>}
            </span>
          </div>

          {site.preview_url && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Live preview</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setShowPreview((v) => !v)}>
                    {showPreview ? "Hide" : "Show"}
                  </Button>
                  <a href={site.preview_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]">
                      <ExternalLink className="w-3 h-3 mr-1" /> Open
                    </Button>
                  </a>
                </div>
              </div>
              {showPreview && (
                <div className="rounded-lg border overflow-hidden bg-muted/30">
                  <iframe
                    src={site.preview_url}
                    title="Demo site preview"
                    className="w-full h-[340px] bg-white"
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          )}

          {injected.length > 0 && (
            <div className="rounded-md border bg-muted/20 p-2">
              <div className="text-[11px] font-medium text-muted-foreground mb-1">Injected into the template</div>
              <div className="flex flex-wrap gap-1">
                {injected.slice(0, 10).map(([k, v]) => (
                  <span key={k} className="text-[10px] rounded bg-background border px-1.5 py-0.5">
                    <span className="text-muted-foreground">{k}:</span> {String(v).slice(0, 40)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!site.approved ? (
              <Button size="sm" onClick={() => approveMut.mutate(true)} disabled={approveMut.isPending}>
                {approveMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Approve for outreach
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => approveMut.mutate(false)} disabled={approveMut.isPending}>
                Revoke approval
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => linkMut.mutate()} disabled={linkMut.isPending}>
              {linkMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <KeyRound className="w-3 h-3 mr-1" />}
              Open one-click edit link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.length > 0 ? (
            <>
              <Select value={tpl} onValueChange={setTpl}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choose a template (optional)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {templates.map((t) => (
                    <SelectItem key={`${t.type}-${t.id}`} value={t.id}>
                      {t.name}
                      {t.primaryCategories ? ` · ${t.primaryCategories}` : ""}
                      {t.type === "FUNNEL" ? " (funnel)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (selected.thumb || selected.previewUrl) && (
                <div className="flex items-center gap-2 rounded-md border p-2">
                  {selected.thumb && (
                    <img src={selected.thumb} alt={`${selected.name} template thumbnail`} className="w-20 h-14 object-cover rounded" />
                  )}
                  {selected.previewUrl && (
                    <a href={selected.previewUrl} target="_blank" rel="noreferrer" className="text-[11px] underline text-muted-foreground">
                      Preview this template
                    </a>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-amber-600">
              {tplRes?.error
                ? `Couldn't load templates: ${tplRes.error}`
                : "No templates available — the prospect will pick one on first login."}
            </p>
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

function MainSiteTagPanel({
  leadId,
  email,
  tags,
}: {
  leadId: string;
  email: string | null;
  tags: string[];
}) {
  const qc = useQueryClient();
  const pushTag = useServerFn(pushLeadTagToMainSite);
  const [value, setValue] = useState("");

  const mut = useMutation({
    mutationFn: (tag: string) => pushTag({ data: { lead_id: leadId, tag } }),
    onSuccess: (res: any) => {
      toast.success(`Contact synced. Tags: ${res.tags.join(", ")}`);
      setValue("");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to push tag"),
  });

  const quickTags = ["Hot Lead", "Follow-up", "Nurture", "Not a fit"];

  return (
    <div className="rounded-lg border p-3 bg-muted/20 space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-primary" />
        <div className="text-xs font-semibold">Main site contact tag</div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Push a tag to this lead's contact on your main marketing site. If the contact doesn't
        exist yet, it will be created (email + name). Use these tags in your main-site
        automations — nurture sequences, segments, or CRM stages.
      </p>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
        </div>
      )}

      {!email ? (
        <div className="text-xs text-amber-600">Enrich this lead first to capture an email.</div>
      ) : (
        <>
          <div className="flex gap-1">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Interested — Q1"
              className="h-8 text-xs"
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim()) mut.mutate(value.trim());
              }}
            />
            <Button
              size="sm"
              onClick={() => value.trim() && mut.mutate(value.trim())}
              disabled={!value.trim() || mut.isPending}
            >
              {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {quickTags.map((t) => (
              <button
                key={t}
                type="button"
                disabled={mut.isPending || tags.includes(t)}
                onClick={() => mut.mutate(t)}
                className="text-[10px] px-2 py-0.5 rounded border hover:bg-primary/10 disabled:opacity-40"
              >
                + {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}




function ContactPanel({
  name,
  email,
  contacts,
  enriched,
}: {
  name?: string | null;
  email?: string | null;
  contacts?: { emails?: string[]; phones?: string[]; socials?: string[]; email_source?: string | null };
  enriched: boolean;
}) {
  const alternates = (contacts?.emails ?? []).filter((e) => e !== email);
  return (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">Contact details</div>
      <div>
        <span className="text-muted-foreground">Name:</span>{" "}
        {name || <span className="text-muted-foreground italic">not found</span>}
      </div>
      <div>
        <span className="text-muted-foreground">Email:</span>{" "}
        {email ? (
          <a href={`mailto:${email}`} className="hover:underline">{email}</a>
        ) : (
          <span className="text-muted-foreground italic">
            {enriched ? "no public email found on their site" : "run enrichment to find it"}
          </span>
        )}
      </div>
      {alternates.length > 0 && (
        <div className="text-xs text-muted-foreground">Other emails: {alternates.join(", ")}</div>
      )}
      {contacts?.phones && contacts.phones.length > 0 && (
        <div className="text-xs text-muted-foreground">Phone: {contacts.phones.join(", ")}</div>
      )}
      {contacts?.socials && contacts.socials.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {contacts.socials.map((s) => (
            <a key={s} href={s} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
              {new URL(s).hostname.replace(/^www\./, "")}
            </a>
          ))}
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

// Features every white-label platform (Simvoly/Maindesk-based) includes out of the box.
// Compared against what we detected on the prospect's live site so the user can see —
// at a glance — which paid third-party tools become redundant after switching.
const PLATFORM_FEATURES: Array<{
  label: string;
  check: (s: any) => { has: boolean; via?: string | null };
}> = [
  {
    label: "Booking & appointments",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "scheduling");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Email capture & newsletter",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "email_capture");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Forms & lead intake",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "forms");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Popups & exit-intent",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "popup");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Live chat",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "chat");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Payments & checkout",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "payments" || x.category === "ecommerce");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Memberships & courses",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "membership");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Testimonials & reviews",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "reviews");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "CRM & pipeline",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "crm");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Analytics",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "analytics");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Retargeting pixels",
    check: (s) => {
      const t = (s.tools ?? []).find((x: any) => x.category === "ads_pixel");
      return { has: !!t, via: t?.name };
    },
  },
  {
    label: "Mobile-responsive",
    check: (s) => ({ has: !!s?.page?.responsive, via: null }),
  },
  {
    label: "SEO basics (H1 + OG image)",
    check: (s) => ({ has: !!s?.page?.has_h1 && !!s?.page?.has_og_image, via: null }),
  },
];

function FeatureComparisonTable({ signals }: { signals: any }) {
  const rows = PLATFORM_FEATURES.map((f) => ({ label: f.label, ...f.check(signals) }));
  const missing = rows.filter((r) => !r.has).length;
  const stacked = rows.filter((r) => r.has && r.via).length;
  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">Feature comparison</div>
        <div className="text-[10px] text-muted-foreground">
          {missing} gap{missing === 1 ? "" : "s"} · {stacked} tool{stacked === 1 ? "" : "s"} to consolidate
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Feature</th>
              <th className="px-3 py-2 font-medium">Their site</th>
              <th className="px-3 py-2 font-medium">Your white-label</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2">
                  {r.has ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-amber-600">●</span>
                      <span>{r.via ? `via ${r.via}` : "Yes"}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <span>✕</span>
                      <span>Missing</span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <span>✓</span>
                    <span>Built-in</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        <span className="text-red-600">✕ Missing</span> = gap on their site · <span className="text-amber-600">●</span> = using a paid 3rd-party tool your platform replaces · <span className="text-green-700">✓</span> = included in your white-label.
      </p>
    </div>
  );
}

