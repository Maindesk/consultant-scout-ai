import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeads, enrichLead, getLead } from "@/lib/leads.functions";
import { draftEmailsForLead } from "@/lib/drafts.functions";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Sparkles, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600",
  enriched: "bg-purple-500/10 text-purple-600",
  drafted: "bg-amber-500/10 text-amber-600",
  approved: "bg-green-500/10 text-green-600",
  sent: "bg-emerald-500/10 text-emerald-600",
  replied: "bg-pink-500/10 text-pink-600",
  rejected: "bg-gray-500/10 text-gray-600",
};

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
              <a href={data.lead.website} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                {data.lead.website} <ExternalLink className="w-3 h-3" />
              </a>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              {data.lead.email && <div><span className="text-muted-foreground">Email:</span> {data.lead.email}</div>}
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
                </>
              )}
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

function Section({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{title}</div>
      <div>{body}</div>
    </div>
  );
}
