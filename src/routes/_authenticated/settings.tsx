import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyWorkspaces,
  updateWorkspaceSettings,
  testPlatformApi,
  testMainSiteApi,
  type WorkspaceSummary,
} from "@/lib/workspace.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, KeyRound, Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const list = useServerFn(getMyWorkspaces);
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => list(),
  });

  const active = workspaces?.find((w) => w.is_active) ?? workspaces?.[0];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Connect your platform, main site, and webhook endpoint.</p>
      </div>

      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {active && <WorkspaceIntegrationsCard workspace={active} />}
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
