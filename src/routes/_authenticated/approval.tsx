import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPendingDrafts, updateDraft, setDraftStatus, approveLeadSequence, draftEmailsForLead } from "@/lib/drafts.functions";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, RefreshCcw, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/approval")({
  component: ApprovalPage,
});

function ApprovalPage() {
  const qc = useQueryClient();
  const list = useServerFn(listPendingDrafts);
  const update = useServerFn(updateDraft);
  const setStatus = useServerFn(setDraftStatus);
  const approveLead = useServerFn(approveLeadSequence);
  const regen = useServerFn(draftEmailsForLead);

  const { data: drafts = [] } = useQuery({ queryKey: ["drafts"], queryFn: () => list() });

  const grouped = useMemo(() => {
    const byLead = new Map<string, typeof drafts>();
    for (const d of drafts) {
      const arr = byLead.get(d.lead_id) ?? [];
      arr.push(d);
      byLead.set(d.lead_id, arr);
    }
    return Array.from(byLead.entries());
  }, [drafts]);

  const updateMut = useMutation({
    mutationFn: (v: { id: string; subject: string; body: string }) => update({ data: v }),
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) => setStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drafts"] }),
  });
  const approveMut = useMutation({
    mutationFn: (lead_id: string) => approveLead({ data: { lead_id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["drafts"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Queued ${r.queued} emails`);
    },
  });
  const regenMut = useMutation({
    mutationFn: (lead_id: string) => regen({ data: { lead_id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["drafts"] }); toast.success("Regenerated"); },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approval queue</h1>
        <p className="text-sm text-muted-foreground">{drafts.length} drafts awaiting your review.</p>
      </div>

      {grouped.length === 0 && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Nothing to review. Draft emails from the Leads page.</CardContent></Card>
      )}

      {grouped.map(([leadId, items]) => {
        const lead = (items[0] as any).leads;
        const sorted = [...items].sort((a, b) => a.step_number - b.step_number);
        return (
          <Card key={leadId}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <div className="font-medium">{lead?.business_name || lead?.website}</div>
                <div className="text-xs text-muted-foreground">{lead?.email ?? "(no email detected)"} · {lead?.niche}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => regenMut.mutate(leadId)} disabled={regenMut.isPending}>
                  <RefreshCcw className="w-3 h-3 mr-1" /> Regenerate
                </Button>
                <Button size="sm" onClick={() => approveMut.mutate(leadId)} disabled={approveMut.isPending || !lead?.email}>
                  <Send className="w-3 h-3 mr-1" /> Approve all & queue
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {sorted.map((d) => (
                <DraftEditor
                  key={d.id}
                  draft={d}
                  onSave={(subject, body) => updateMut.mutate({ id: d.id, subject, body })}
                  onReject={() => statusMut.mutate({ id: d.id, status: "rejected" })}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DraftEditor({ draft, onSave, onReject }: { draft: any; onSave: (s: string, b: string) => void; onReject: () => void }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const dirty = subject !== draft.subject || body !== draft.body;

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Step {draft.step_number} · Day {draft.day_offset}</Badge>
        <span className="text-xs text-muted-foreground ml-auto">{draft.tone}</span>
      </div>
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!dirty} onClick={() => onSave(subject, body)}>
          <Check className="w-3 h-3 mr-1" /> Save edits
        </Button>
        <Button size="sm" variant="ghost" onClick={onReject}>
          <X className="w-3 h-3 mr-1" /> Reject
        </Button>
      </div>
    </div>
  );
}
