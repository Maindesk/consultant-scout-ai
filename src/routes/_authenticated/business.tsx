import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBusinessProfile,
  saveBusinessProfile,
  analyzeMyBusiness,
  listBusinessSources,
  addBusinessSource,
  deleteBusinessSource,
} from "@/lib/business.functions";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, Plus, Link2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business")({
  component: BusinessPage,
});

const SOURCE_TYPES = ["sales_page", "case_study", "testimonial", "about", "blog", "page"];

function BusinessPage() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getBusinessProfile);
  const save = useServerFn(saveBusinessProfile);
  const analyze = useServerFn(analyzeMyBusiness);
  const listSources = useServerFn(listBusinessSources);
  const addSource = useServerFn(addBusinessSource);
  const delSource = useServerFn(deleteBusinessSource);

  const { data: profile } = useQuery({ queryKey: ["business_profile"], queryFn: () => fetchProfile() });
  const { data: sources = [] } = useQuery({ queryKey: ["business_sources"], queryFn: () => listSources() });

  const [form, setForm] = useState({
    website_url: "",
    offer_description: "",
    sender_name: "",
    sender_email: "",
    daily_send_cap: 25,
    avg_deal_value: 0,
    avg_close_rate: 0.1,
    currency: "USD",
  });

  const [srcUrl, setSrcUrl] = useState("");
  const [srcLabel, setSrcLabel] = useState("");
  const [srcType, setSrcType] = useState("page");

  useEffect(() => {
    if (profile) {
      setForm({
        website_url: profile.website_url ?? "",
        offer_description: profile.offer_description ?? "",
        sender_name: profile.sender_name ?? "",
        sender_email: profile.sender_email ?? "",
        daily_send_cap: profile.daily_send_cap ?? 25,
        avg_deal_value: Number(profile.avg_deal_value ?? 0),
        avg_close_rate: Number(profile.avg_close_rate ?? 0.1),
        currency: profile.currency ?? "USD",
      });
    }
  }, [profile]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["business_profile"] }); toast.success("Saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const analyzeMut = useMutation({
    mutationFn: () => analyze(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["business_profile"] }); toast.success("AI retrained on all sources"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const addSourceMut = useMutation({
    mutationFn: () => addSource({ data: { url: srcUrl, label: srcLabel || undefined, source_type: srcType } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_sources"] });
      setSrcUrl(""); setSrcLabel(""); setSrcType("page");
      toast.success("Source added — click Retrain AI to include it");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delSourceMut = useMutation({
    mutationFn: (id: string) => delSource({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_sources"] }),
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Business</h1>
        <p className="text-sm text-muted-foreground">The AI uses this to personalize every message.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business info</CardTitle>
          <CardDescription>Website + a short description of your offer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Website URL</Label>
            <Input placeholder="https://yoursite.com" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} />
          </div>
          <div>
            <Label>Offer description</Label>
            <Textarea rows={4} placeholder="e.g. I help coaches book 10+ discovery calls per month with cold email…" value={form.offer_description} onChange={(e) => setForm({ ...form, offer_description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sender name</Label>
              <Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} />
            </div>
            <div>
              <Label>Sender email</Label>
              <Input type="email" value={form.sender_email} onChange={(e) => setForm({ ...form, sender_email: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Daily send cap</Label>
            <Input type="number" min={1} max={500} value={form.daily_send_cap} onChange={(e) => setForm({ ...form, daily_send_cap: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2 border-t">
            <div className="col-span-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pricing & pipeline</div>
              <p className="text-xs text-muted-foreground">Used to calculate expected pipeline value on the Board.</p>
            </div>
            <div>
              <Label>Avg deal value</Label>
              <Input type="number" min={0} step={100} value={form.avg_deal_value} onChange={(e) => setForm({ ...form, avg_deal_value: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Currency</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Avg close rate</Label>
              <Input type="number" min={0} max={1} step={0.05} value={form.avg_close_rate} onChange={(e) => setForm({ ...form, avg_close_rate: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground mt-1">0.10 = 10%</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge base</CardTitle>
          <CardDescription>
            Add multiple URLs (case studies, sales pages, testimonials, about). The AI reads all of them plus your main
            site to build a deep understanding used in every cold email and reply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_150px_auto] gap-2">
            <Input placeholder="https://yoursite.com/case-study/acme" value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} />
            <Input placeholder="Label (optional)" value={srcLabel} onChange={(e) => setSrcLabel(e.target.value)} />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={srcType}
              onChange={(e) => setSrcType(e.target.value)}
            >
              {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
            <Button onClick={() => addSourceMut.mutate()} disabled={!srcUrl || addSourceMut.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>

          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No extra sources yet. Add pages the AI should learn from.</p>
          ) : (
            <div className="space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm border rounded p-2">
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{s.label || s.url}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.url}</div>
                  </div>
                  <Badge variant="outline">{s.source_type}</Badge>
                  {s.last_scraped_at && <Badge variant="secondary" className="text-xs">learned</Badge>}
                  <Button size="icon" variant="ghost" onClick={() => delSourceMut.mutate(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending || !form.website_url}>
              {analyzeMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Retrain AI on all sources
            </Button>
            <span className="text-xs text-muted-foreground">Re-scrapes every source and rebuilds the AI understanding.</span>
          </div>
        </CardContent>
      </Card>

      {profile?.ai_summary && (
        <Card>
          <CardHeader><CardTitle className="text-base">AI understanding</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Summary" value={profile.ai_summary} />
            <Field label="Value proposition" value={profile.value_proposition} />
            <Field label="Ideal client" value={profile.ideal_client} />
            {Array.isArray(profile.services) && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Services</div>
                <div className="flex flex-wrap gap-1">
                  {(profile.services as string[]).map((s) => (
                    <span key={s} className="text-xs bg-secondary px-2 py-1 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <div>{value}</div>
    </div>
  );
}
