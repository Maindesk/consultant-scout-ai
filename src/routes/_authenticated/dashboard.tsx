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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Zap,
  Users,
  Send,
  MessageSquare,
  Inbox as InboxIcon,
  ArrowUpRight,
  Sparkles,
  Building2,
  Target,
  CheckCircle2,
} from "lucide-react";

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
    auto_provision_demo: false,
    auto_insert_sso_in_email3: false,
  });

  useEffect(() => {
    if (auto) {
      setForm({
        enabled: auto.enabled,
        daily_lead_target: auto.daily_lead_target,
        auto_enrich: auto.auto_enrich,
        auto_draft: auto.auto_draft,
        active_search_config_id: auto.active_search_config_id,
        auto_provision_demo: (auto as any).auto_provision_demo ?? false,
        auto_insert_sso_in_email3: (auto as any).auto_insert_sso_in_email3 ?? false,
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
    { label: "Total leads", value: analytics?.totalLeads ?? 0, icon: Users, hint: "in pipeline" },
    { label: "Emails sent", value: analytics?.sent ?? 0, icon: Send, hint: "lifetime" },
    { label: "Replies", value: analytics?.replied ?? 0, icon: MessageSquare, hint: "awaiting you" },
    { label: "Pending approval", value: analytics?.pending ?? 0, icon: InboxIcon, hint: "drafts ready" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Greeting hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-white p-8">
        <div className="absolute inset-0 bg-brand-gradient-soft opacity-70 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary bg-white/80 border border-primary/20 rounded-full px-2.5 py-1 mb-3">
              <Sparkles className="w-3 h-3" /> Your outbound, running quietly in the background
            </div>
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight">
              Welcome back.
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {form.enabled
                ? "Autopilot is live, new potential users for your white-label are being drafted for your review each morning."
                : "Turn on Autopilot below and PixelOutreach will start bringing new users to your white-label every day."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/board"><Button variant="outline" size="sm" className="gap-1.5">Pipeline board <ArrowUpRight className="w-3.5 h-3.5" /></Button></Link>
            <Link to="/approval"><Button size="sm" className="gap-1.5 bg-brand-gradient shadow-brand hover:opacity-95">Review drafts</Button></Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60 shadow-none hover:shadow-sm transition">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
                <div className="w-7 h-7 rounded-md bg-brand-gradient-soft flex items-center justify-center">
                  <s.icon className="w-3.5 h-3.5 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-semibold tracking-tight tabular-nums">{s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{s.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Autopilot */}
      <Card className="border-border/60 overflow-hidden">
        <div className="p-6 border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient shadow-brand flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold tracking-tight">Daily Autopilot</h2>
                {form.enabled ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Paused</Badge>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-xl">
                Every morning, discover new matching leads, enrich them with tech-stack signals, and draft
                a personalized email sequence, waiting for your one-click approval.
              </p>
            </div>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => {
              const next = { ...form, enabled: v };
              setForm(next);
              saveMut.mutate(next);
            }}
          />
        </div>

        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Active search config</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={form.active_search_config_id ?? ""}
                onChange={(e) => setForm({ ...form, active_search_config_id: e.target.value || null })}
              >
                <option value="">— pick a config —</option>
                {configs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Daily lead target</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.daily_lead_target}
                onChange={(e) => setForm({ ...form, daily_lead_target: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending} variant="outline" className="flex-1">Save</Button>
              <Button
                onClick={() => runMut.mutate()}
                disabled={runMut.isPending || !form.active_search_config_id}
                className="flex-1 bg-brand-gradient shadow-brand hover:opacity-95"
              >
                {runMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
                Run now
              </Button>
            </div>
          </div>

          {auto?.last_run_at && (
            <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <span className="font-medium text-foreground">Last run:</span>{" "}
              {new Date(auto.last_run_at).toLocaleString()} — {auto.last_run_summary}
            </div>
          )}

          <div className="pt-4 border-t border-border/60 space-y-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Demo site automation</div>
            <label className="flex items-start gap-3 text-sm p-3 rounded-lg border border-border/60 hover:bg-muted/40 transition cursor-pointer">
              <Switch
                checked={form.auto_provision_demo}
                onCheckedChange={(v) => {
                  const next = { ...form, auto_provision_demo: v };
                  setForm(next);
                  saveMut.mutate(next);
                }}
              />
              <div>
                <div className="font-medium text-[13px]">Auto-provision demo on interested reply</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">When a lead replies as interested, spin up a personalized preview site on your platform.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 text-sm p-3 rounded-lg border border-border/60 hover:bg-muted/40 transition cursor-pointer">
              <Switch
                checked={form.auto_insert_sso_in_email3}
                onCheckedChange={(v) => {
                  const next = { ...form, auto_insert_sso_in_email3: v };
                  setForm(next);
                  saveMut.mutate(next);
                }}
              />
              <div>
                <div className="font-medium text-[13px]">Auto-insert one-click edit link in follow-up #3</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">Email #3 gets a fresh 15-min SSO link into the lead's personalized demo.</div>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Getting started */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-3 px-1">Get started</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: "/business", label: "Business profile", desc: "Teach the AI about your offer", icon: Building2, step: "01" },
            { to: "/targeting", label: "Targeting config", desc: "Pick niches and website platforms", icon: Target, step: "02" },
            { to: "/dashboard", label: "Enable Autopilot", desc: "Discovery runs every morning", icon: Zap, step: "03" },
            { to: "/approval", label: "Approve & send", desc: "Review drafts in one click", icon: CheckCircle2, step: "04" },
          ].map((s) => (
            <Link
              key={s.step}
              to={s.to}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-white p-4 hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-8 h-8 rounded-lg bg-brand-gradient-soft flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/60">{s.step}</span>
              </div>
              <div className="text-[13px] font-semibold tracking-tight">{s.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</div>
              <ArrowUpRight className="absolute bottom-3 right-3 w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
