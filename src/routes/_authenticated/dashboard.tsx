import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalytics } from "@/lib/analytics.functions";
import {
  getAutomationSettings,
  saveAutomationSettings,
  runAutopilotNow,
} from "@/lib/automation.functions";
import { listSearchConfigs } from "@/lib/targeting.functions";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const fetchAnalytics = useServerFn(getAnalytics);
  const fetchAuto = useServerFn(getAutomationSettings);
  const saveAuto = useServerFn(saveAutomationSettings);
  const runNow = useServerFn(runAutopilotNow);
  const listCfgs = useServerFn(listSearchConfigs);

  const { data: analytics } = useQuery({ queryKey: ["analytics"], queryFn: () => fetchAnalytics() });
  const { data: auto } = useQuery({ queryKey: ["automation"], queryFn: () => fetchAuto() });
  const { data: configs = [] } = useQuery({ queryKey: ["search_configs"], queryFn: () => listCfgs() });

  const [form, setForm] = useState({
    enabled: false,
    daily_lead_target: 10,
    auto_enrich: true,
    auto_draft: true,
    active_search_config_id: null as string | null,
  });

  useEffect(() => {
    if (auto) {
      setForm({
        enabled: auto.enabled,
        daily_lead_target: auto.daily_lead_target,
        auto_enrich: auto.auto_enrich,
        auto_draft: auto.auto_draft,
        active_search_config_id: auto.active_search_config_id,
      });
    }
  }, [auto]);

  const saveMut = useMutation({
    mutationFn: (patch: typeof form) => saveAuto({ data: patch }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automation"] }); toast.success("Autopilot saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const runMut = useMutation({
    mutationFn: () => runNow(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["automation"] });
      toast.success(`Ran: ${r.discovered} discovered, ${r.enriched} enriched, ${r.drafted} drafted`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const stats = [
    { label: "Total leads", value: analytics?.totalLeads ?? 0 },
    { label: "Emails sent", value: analytics?.sent ?? 0 },
    { label: "Replies", value: analytics?.replied ?? 0 },
    { label: "Pending approval", value: analytics?.pending ?? 0 },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your outbound at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/targeting"><Button variant="outline">Targeting</Button></Link>
          <Link to="/approval"><Button>Review drafts</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">{s.label}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Daily Autopilot
              {form.enabled && <Badge className="bg-green-100 text-green-800 border border-green-300">ON</Badge>}
            </CardTitle>
            <CardDescription>
              Every day, discover new leads matching your active config, enrich them, and draft a personalized email
              sequence — all waiting for your approval each morning.
            </CardDescription>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => {
              const next = { ...form, enabled: v };
              setForm(next);
              saveMut.mutate(next);
            }}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Active search config</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm mt-1"
                value={form.active_search_config_id ?? ""}
                onChange={(e) => setForm({ ...form, active_search_config_id: e.target.value || null })}
              >
                <option value="">— pick a config —</option>
                {configs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Daily lead target</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.daily_lead_target}
                onChange={(e) => setForm({ ...form, daily_lead_target: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>Save</Button>
              <Button
                variant="outline"
                onClick={() => runMut.mutate()}
                disabled={runMut.isPending || !form.active_search_config_id}
              >
                {runMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Run now
              </Button>
            </div>
          </div>
          {auto?.last_run_at && (
            <div className="text-xs text-muted-foreground">
              Last run: {new Date(auto.last_run_at).toLocaleString()} — {auto.last_run_summary}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Get started</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>1. <Link to="/business" className="underline">Set up your business profile</Link> and add knowledge sources so the AI learns your offer deeply.</div>
          <div>2. <Link to="/targeting" className="underline">Create a targeting config</Link> — pick niches and (optionally) website platform like Squarespace.</div>
          <div>3. Enable <b>Daily Autopilot</b> above, or run discovery manually from Targeting.</div>
          <div>4. <Link to="/approval" className="underline">Approve drafts</Link>, then handle replies in <Link to="/inbox" className="underline">Inbox</Link>.</div>
        </CardContent>
      </Card>
    </div>
  );
}
