import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBusinessProfile, saveBusinessProfile, analyzeMyBusiness } from "@/lib/business.functions";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business")({
  component: BusinessPage,
});

function BusinessPage() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getBusinessProfile);
  const save = useServerFn(saveBusinessProfile);
  const analyze = useServerFn(analyzeMyBusiness);

  const { data: profile } = useQuery({ queryKey: ["business_profile"], queryFn: () => fetchProfile() });

  const [form, setForm] = useState({
    website_url: "",
    offer_description: "",
    sender_name: "",
    sender_email: "",
    daily_send_cap: 25,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        website_url: profile.website_url ?? "",
        offer_description: profile.offer_description ?? "",
        sender_name: profile.sender_name ?? "",
        sender_email: profile.sender_email ?? "",
        daily_send_cap: profile.daily_send_cap ?? 25,
      });
    }
  }, [profile]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_profile"] });
      toast.success("Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const analyzeMut = useMutation({
    mutationFn: () => analyze(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_profile"] });
      toast.success("AI analysis complete");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
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
          <div className="flex gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Save</Button>
            <Button variant="outline" onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending || !form.website_url}>
              {analyzeMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Analyze with AI
            </Button>
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
