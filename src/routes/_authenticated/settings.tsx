import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyWorkspaces,
  createWorkspace,
  updateWorkspaceSettings,
  testPlatformApi,
  testMainSiteApi,
  type WorkspaceSummary,
} from "@/lib/workspace.functions";
import {
  getEmailSenderStatus,
  saveEmailSender,
  clearEmailSender,
  testEmailSender,
  runDomainHealthCheck,
  type EmailProviderName,
} from "@/lib/email-settings.functions";
import { getMyBilling, getUsageAlertPrefs, saveUsageAlertPrefs } from "@/lib/billing.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, KeyRound, Tag, Mail, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const list = useServerFn(getMyWorkspaces);
  const create = useServerFn(createWorkspace);
  const qc = useQueryClient();
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => list(),
  });
  const [name, setName] = useState("My Workspace");
  const [creating, setCreating] = useState(false);

  const active = workspaces?.find((w) => w.is_active) ?? workspaces?.[0];
  const empty = !isLoading && (workspaces?.length ?? 0) === 0;

  async function onCreate() {
    setCreating(true);
    try {
      await create({ data: { name: name.trim() || "My Workspace" } });
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Connect your platform, main site, and webhook endpoint.</p>
      </div>

      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {empty && (
        <Card>
          <CardHeader>
            <CardTitle>Create your workspace</CardTitle>
            <CardDescription>You need a workspace to configure integrations, email sender, and automations.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name" />
            <Button onClick={onCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </CardContent>
        </Card>
      )}
      {active && <UsageCard />}
      {active && <EmailSenderCard workspace={active} />}
      {active && <WorkspaceIntegrationsCard workspace={active} />}
    </div>
  );
}

/* ----------------------------- USAGE & ALERTS ----------------------------- */
function UsageBar({ label, used, limit, warn }: { label: string; used: number; limit: number; warn: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const over = used > limit;
  const near = !over && pct >= warn;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used.toLocaleString("en-US")} / {limit.toLocaleString("en-US")}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            over ? "bg-destructive" : near ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground">
        {over ? `${(used - limit).toLocaleString("en-US")} over allowance` : `${pct}% used`}
      </div>
    </div>
  );
}

function UsageCard() {
  const loadBilling = useServerFn(getMyBilling);
  const loadPrefs = useServerFn(getUsageAlertPrefs);
  const savePrefs = useServerFn(saveUsageAlertPrefs);
  const qc = useQueryClient();

  const { data: billing, isLoading } = useQuery({ queryKey: ["billing"], queryFn: () => loadBilling() });
  const { data: prefs } = useQuery({ queryKey: ["usage_alert_prefs"], queryFn: () => loadPrefs() });

  const [form, setForm] = useState({ enabled: true, threshold_pct: 80, email: "" });
  useEffect(() => {
    if (prefs) setForm({ enabled: prefs.enabled, threshold_pct: prefs.threshold_pct, email: prefs.email });
  }, [prefs]);

  const save = useMutation({
    mutationFn: (patch: typeof form) => savePrefs({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usage_alert_prefs"] });
      toast.success("Usage alerts updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6"><Loader2 className="w-4 h-4 animate-spin" /></CardContent>
      </Card>
    );
  }
  if (!billing) return null;

  const { subscription: sub, usage } = billing;
  const periodEnd = new Date(sub.current_period_end);
  const overageCents = usage.overage_cents ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gauge className="w-4 h-4" /> Usage this period</CardTitle>
        <CardDescription>
          {sub.plan.name} plan · resets {periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-5 md:grid-cols-3">
          <UsageBar label="Leads" used={usage.leads_discovered_used} limit={sub.plan.leads_monthly} warn={form.threshold_pct} />
          <UsageBar label="AI credits" used={usage.ai_credits_used} limit={sub.plan.ai_credits_monthly} warn={form.threshold_pct} />
          <UsageBar label="Emails" used={usage.emails_used} limit={sub.plan.emails_monthly} warn={form.threshold_pct} />
        </div>

        {usage.overage_leads_used > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">
                {usage.overage_leads_used.toLocaleString("en-US")} leads billed as overage
              </div>
              <div className="text-xs mt-0.5">
                ${(overageCents / 100).toFixed(2)} extra this period at $
                {((sub.plan.overage_price_cents_per_lead ?? 0) / 100).toFixed(2)} per lead.
              </div>
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                <BellRing className="w-4 h-4" /> Notify me before overage
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                Get an email when your lead usage crosses your threshold, and again the moment you hit 100% and
                pay-as-you-go pricing kicks in. Sent from your connected sending domain.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => {
                const next = { ...form, enabled: v };
                setForm(next);
                save.mutate(next);
              }}
            />
          </div>

          {form.enabled && (
            <div className="grid gap-4 md:grid-cols-[160px_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Warn me at</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={50}
                    max={99}
                    value={form.threshold_pct}
                    onChange={(e) => setForm({ ...form, threshold_pct: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Send alerts to</Label>
                <Input
                  type="email"
                  placeholder="Defaults to your account email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}



function EmailSenderCard({ workspace }: { workspace: WorkspaceSummary }) {
  const qc = useQueryClient();
  const status = useServerFn(getEmailSenderStatus);
  const save = useServerFn(saveEmailSender);
  const clear = useServerFn(clearEmailSender);
  const testFn = useServerFn(testEmailSender);
  const healthFn = useServerFn(runDomainHealthCheck);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["email-sender", workspace.id],
    queryFn: () => status({ data: { workspace_id: workspace.id } }),
  });

  const [provider, setProvider] = useState<EmailProviderName>("resend");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState<null | { ok: boolean; message: string }>(null);

  useEffect(() => {
    if (cfg) {
      setProvider((cfg.provider as EmailProviderName) ?? "resend");
      setFromEmail(cfg.from_email ?? "");
      setFromName(cfg.from_name ?? "");
    }
  }, [cfg]);

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          workspace_id: workspace.id,
          provider,
          from_email: fromEmail,
          from_name: fromName,
          ...(apiKey ? { api_key: apiKey } : {}),
        },
      }),
    onSuccess: () => {
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["email-sender", workspace.id] });
      toast.success("Sender saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const clearMut = useMutation({
    mutationFn: () => clear({ data: { workspace_id: workspace.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sender", workspace.id] });
      toast.success("Sender disconnected");
    },
  });

  const healthMut = useMutation({
    mutationFn: () => healthFn({ data: { workspace_id: workspace.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-sender", workspace.id] });
      toast.success("Domain health checked");
    },
    onError: (e: any) => toast.error(e.message ?? "Health check failed"),
  });

  const health = cfg?.health as null | {
    domain: string;
    score: number;
    grade: string;
    records: {
      mx: { ok: boolean; values: string[] };
      spf: { ok: boolean; value: string | null; note?: string };
      dkim: { ok: boolean; found: string[]; note?: string };
      dmarc: { ok: boolean; value: string | null; policy?: string };
    };
    recommendations: string[];
  };

  const scoreColor = (s: number) =>
    s >= 90 ? "text-green-600" : s >= 75 ? "text-lime-600" : s >= 60 ? "text-amber-600" : s >= 40 ? "text-orange-600" : "text-red-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email Sender</CardTitle>
        <CardDescription>
          Connect your own sending provider and verified domain. Recipients will see mail coming from your brand,
          and deliverability stays under your control.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Provider &amp; credentials</h3>
            {cfg?.configured ? (
              <Badge variant="outline" className="text-xs">connected · {cfg.provider}</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">not connected</Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(["resend", "sendgrid", "postmark"] as EmailProviderName[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`rounded-md border px-3 py-2 text-sm capitalize text-left transition ${
                  provider === p ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="font-medium">{p}</div>
                <div className="text-[10px] text-muted-foreground">
                  {p === "resend" && "resend.com"}
                  {p === "sendgrid" && "sendgrid.com"}
                  {p === "postmark" && "postmarkapp.com"}
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">
                API key {cfg?.configured && <span className="text-muted-foreground">(leave blank to keep)</span>}
              </Label>
              <Input
                type="password"
                placeholder={cfg?.configured ? "••••••••" : "paste key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {provider === "resend" && "Create at resend.com → API Keys"}
                {provider === "sendgrid" && "Create at sendgrid.com → Settings → API Keys (Mail Send scope)"}
                {provider === "postmark" && "Server API Token from postmarkapp.com"}
              </p>
            </div>
            <div>
              <Label className="text-xs">From name</Label>
              <Input placeholder="Jane at Acme" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">From email (must be on a domain verified in your provider)</Label>
              <Input placeholder="hi@yourdomain.com" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !fromEmail || (!cfg?.configured && !apiKey)}>
              {saveMut.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {cfg?.configured ? "Update sender" : "Connect sender"}
            </Button>
            {cfg?.configured && (
              <>
                <Input
                  className="w-56 h-8 text-xs"
                  placeholder="test recipient (defaults to your email)"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => setTestMsg(await testFn({ data: { workspace_id: workspace.id, to: testTo || undefined } }))}
                >
                  Send test
                </Button>
                <Button size="sm" variant="ghost" onClick={() => clearMut.mutate()}>Disconnect</Button>
              </>
            )}
            {testMsg?.ok && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{testMsg.message}</span>}
            {testMsg && !testMsg.ok && <span className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" />{testMsg.message}</span>}
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Sending domain health</h3>
            {cfg?.from_domain && <Badge variant="outline" className="text-xs font-mono">{cfg.from_domain}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Live DNS check of MX, SPF, DKIM, and DMARC for your sending domain. Higher score = better inbox placement.
          </p>

          {!cfg?.from_domain && (
            <p className="text-xs text-muted-foreground italic">Save a from-email first to enable domain health checks.</p>
          )}

          {cfg?.from_domain && (
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => healthMut.mutate()} disabled={healthMut.isPending}>
                <RefreshCw className={`w-3 h-3 mr-1 ${healthMut.isPending ? "animate-spin" : ""}`} />
                {health ? "Re-check" : "Check now"}
              </Button>
              {cfg.health_checked_at && (
                <span className="text-[10px] text-muted-foreground">
                  Last checked: {new Date(cfg.health_checked_at).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {health && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${scoreColor(health.score)}`}>{health.score}</div>
                <div>
                  <div className="text-sm font-semibold">Grade {health.grade}</div>
                  <div className="text-xs text-muted-foreground">out of 100</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <HealthRow label="MX" ok={health.records.mx.ok} detail={health.records.mx.values.slice(0, 2).join(", ") || "not found"} />
                <HealthRow label="SPF" ok={health.records.spf.ok} detail={health.records.spf.value?.slice(0, 60) ?? "not found"} note={health.records.spf.note} />
                <HealthRow label="DKIM" ok={health.records.dkim.ok} detail={health.records.dkim.found.length ? `selectors: ${health.records.dkim.found.join(", ")}` : "not found"} note={health.records.dkim.note} />
                <HealthRow label="DMARC" ok={health.records.dmarc.ok} detail={health.records.dmarc.value?.slice(0, 60) ?? "not found"} note={health.records.dmarc.policy ? `policy=${health.records.dmarc.policy}` : undefined} />
              </div>

              {health.recommendations.length > 0 && (
                <div className="border-t pt-3 space-y-1">
                  <div className="text-xs font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Recommendations</div>
                  <ul className="text-xs text-muted-foreground list-disc ml-5 space-y-1">
                    {health.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function HealthRow({ label, ok, detail, note }: { label: string; ok: boolean; detail: string; note?: string }) {
  return (
    <div className={`rounded border p-2 ${ok ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
      <div className="flex items-center gap-1 font-semibold">
        {ok ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
        {label}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono break-all">{detail}</div>
      {note && <div className="text-[10px] text-amber-600 mt-0.5">{note}</div>}
    </div>
  );
}

function WorkspaceIntegrationsCard({ workspace }: { workspace: WorkspaceSummary }) {
  const qc = useQueryClient();
  const update = useServerFn(updateWorkspaceSettings);
  const testPlatform = useServerFn(testPlatformApi);
  const testMain = useServerFn(testMainSiteApi);

  const [platformDomain, setPlatformDomain] = useState(workspace.platform_wl_domain ?? "");
  const [platformKey, setPlatformKey] = useState("");
  const [mainDomain, setMainDomain] = useState(workspace.main_site_domain ?? "");
  const [mainKey, setMainKey] = useState("");
  const [syncReplies, setSyncReplies] = useState(workspace.sync_replies_to_main_site);
  const [defaultTag, setDefaultTag] = useState(workspace.reply_contact_default_tag);
  const [webhookSecret, setWebhookSecret] = useState("");

  const saveMut = useMutation({
    mutationFn: (patch: Parameters<typeof update>[0]["data"]) => update({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setPlatformKey("");
      setMainKey("");
      setWebhookSecret("");
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const [platformStatus, setPlatformStatus] = useState<null | { ok: boolean; message?: string; plans_count?: number }>(null);
  const [mainStatus, setMainStatus] = useState<null | { ok: boolean; message?: string }>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations — {workspace.name}</CardTitle>
        <CardDescription>Credentials are encrypted at rest and never returned to the browser.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform API */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Platform API (Simvoly white-label)</h3>
            {workspace.has_platform_key ? (
              <Badge variant="outline" className="text-xs">key saved</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">not configured</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Used to create demo websites for hot leads and mint 1-click edit SSO links.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">White-label domain</Label>
              <Input placeholder="maindesk.io" value={platformDomain} onChange={(e) => setPlatformDomain(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">API calls go to <code>api.&lt;domain&gt;</code></p>
            </div>
            <div>
              <Label className="text-xs">X-CLIENT-KEY {workspace.has_platform_key && <span className="text-muted-foreground">(replace to change)</span>}</Label>
              <Input type="password" placeholder={workspace.has_platform_key ? "••••••••" : "paste key"} value={platformKey} onChange={(e) => setPlatformKey(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              size="sm"
              onClick={() =>
                saveMut.mutate({
                  workspace_id: workspace.id,
                  platform_wl_domain: platformDomain,
                  ...(platformKey ? { platform_client_key: platformKey } : {}),
                })
              }
            >
              Save Platform
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!workspace.has_platform_key || !platformDomain}
              onClick={async () => setPlatformStatus(await testPlatform({ data: { workspace_id: workspace.id } }))}
            >
              Test connection
            </Button>
            {platformStatus?.ok && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {platformStatus.plans_count ?? 0} plans returned
              </span>
            )}
            {platformStatus && !platformStatus.ok && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="w-3 h-3" /> {platformStatus.message}
              </span>
            )}
          </div>
        </section>

        <Separator />

        {/* Main Site API */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Main site Website API</h3>
            {workspace.has_main_site_key ? (
              <Badge variant="outline" className="text-xs">key saved</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">not configured</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sync every lead & replier as a contact on your main marketing site (uses the per-website API key).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Main site domain</Label>
              <Input placeholder="app.maindesk.io" value={mainDomain} onChange={(e) => setMainDomain(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Website API key {workspace.has_main_site_key && <span className="text-muted-foreground">(replace to change)</span>}</Label>
              <Input type="password" placeholder={workspace.has_main_site_key ? "••••••••" : "paste key"} value={mainKey} onChange={(e) => setMainKey(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              size="sm"
              onClick={() =>
                saveMut.mutate({
                  workspace_id: workspace.id,
                  main_site_domain: mainDomain,
                  ...(mainKey ? { main_site_api_key: mainKey } : {}),
                })
              }
            >
              Save Main Site
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!workspace.has_main_site_key || !mainDomain}
              onClick={async () => setMainStatus(await testMain({ data: { workspace_id: workspace.id } }))}
            >
              Test connection
            </Button>
            {mainStatus?.ok && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> connected
              </span>
            )}
            {mainStatus && !mainStatus.ok && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="w-3 h-3" /> {mainStatus.message}
              </span>
            )}
          </div>

          {/* Reply → Contact sync */}
          <div className="rounded-lg border border-dashed p-3 space-y-3 bg-muted/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Tag className="w-4 h-4 mt-0.5 text-primary" />
                <div>
                  <div className="text-sm font-medium">Auto-sync replies as main-site contacts</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
                    When a lead replies to your outreach, PixelOutreach creates (or updates) the
                    contact on your main website via the Website API and tags them so your
                    on-site automations (nurture sequences, segments, CRM stages) can take over.
                    Requires the Main Site API above.
                  </p>
                </div>
              </div>
              <Switch checked={syncReplies} onCheckedChange={setSyncReplies} />
            </div>
            <div>
              <Label className="text-xs">Default tag applied to every reply</Label>
              <Input
                value={defaultTag}
                onChange={(e) => setDefaultTag(e.target.value)}
                placeholder="PixelOutreach Reply"
                maxLength={100}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Each synced contact also gets a classification tag like <code>Reply: interested</code>,
                <code>Reply: question</code>, or <code>Reply: not_interested</code>.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                saveMut.mutate({
                  workspace_id: workspace.id,
                  sync_replies_to_main_site: syncReplies,
                  reply_contact_default_tag: defaultTag,
                })
              }
            >
              Save reply-sync settings
            </Button>
          </div>
        </section>

        <Separator />

        {/* Webhook secret */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Platform webhook signing secret</h3>
            {workspace.has_webhook_secret ? (
              <Badge variant="outline" className="text-xs">saved</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">not configured</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Paste this webhook URL into your Platform → Webhooks config, subscribe to
            <code className="mx-1">subscription_activated / renewed / expired</code>, then paste the same signing secret both sides.
            Incoming events auto-move leads to Won/Lost and record MRR.
          </p>
          <div>
            <Label className="text-xs">Webhook URL (copy into Platform)</Label>
            <Input
              readOnly
              value={typeof window !== "undefined" ? `${window.location.origin}/api/public/webhooks/platform/${workspace.id}` : `/api/public/webhooks/platform/${workspace.id}`}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <div>
            <Label className="text-xs">Signing secret {workspace.has_webhook_secret && <span className="text-muted-foreground">(replace to change)</span>}</Label>
            <Input
              type="password"
              placeholder={workspace.has_webhook_secret ? "••••••••" : "paste secret"}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            onClick={() =>
              saveMut.mutate({
                workspace_id: workspace.id,
                ...(webhookSecret ? { webhook_secret: webhookSecret } : {}),
              })
            }
            disabled={!webhookSecret}
          >
            Save Webhook Secret
          </Button>
        </section>

      </CardContent>
    </Card>
  );
}
