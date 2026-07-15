import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getIsSuperAdmin,
  claimFirstSuperAdmin,
  listAllTenants,
  listAllRevenue,
  setPlanForWorkspace,
} from "@/lib/admin.functions";
import { listPlans } from "@/lib/billing.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const meFn = useServerFn(getIsSuperAdmin);
  const claimFn = useServerFn(claimFirstSuperAdmin);
  const tenantsFn = useServerFn(listAllTenants);
  const revFn = useServerFn(listAllRevenue);
  const plansFn = useServerFn(listPlans);
  const setPlanFn = useServerFn(setPlanForWorkspace);

  const { data: me } = useQuery({ queryKey: ["is_super_admin"], queryFn: () => meFn() });
  const enabled = me?.is_super_admin === true;

  const { data: tenants } = useQuery({ queryKey: ["admin_tenants"], queryFn: () => tenantsFn(), enabled });
  const { data: revenue = [] } = useQuery({ queryKey: ["admin_revenue"], queryFn: () => revFn(), enabled });
  const { data: plans = [] } = useQuery({ queryKey: ["plans"], queryFn: () => plansFn(), enabled });

  const setPlan = useMutation({
    mutationFn: (v: { workspace_id: string; plan_code: string }) => setPlanFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_tenants"] });
      toast.success("Plan updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: (res) => {
      if (res.claimed) {
        toast.success("You are now the platform super-admin.");
        qc.invalidateQueries({ queryKey: ["is_super_admin"] });
      } else {
        toast.info("Super-admin already claimed on this project.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (me && !enabled) {
    return (
      <div className="p-8 max-w-xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Platform admin</h1>
        <p className="text-sm text-muted-foreground">
          You aren't a super-admin. If this project has no super-admin yet, the first person to claim it here
          becomes the platform owner.
        </p>
        <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
          Claim super-admin
        </Button>
      </div>
    );
  }

  if (!tenants) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform admin</h1>
        <p className="text-sm text-muted-foreground">All tenants, subscriptions and revenue across PixelOutreach.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="MRR" value={`$${tenants.total_mrr_usd.toLocaleString()}`} />
        <Kpi label="Active tenants" value={tenants.active_count.toString()} />
        <Kpi label="On trial" value={tenants.trialing_count.toString()} />
        <Kpi label="Total workspaces" value={tenants.workspaces.length.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>MRR</th>
                  <th>Period end</th>
                  <th>Change plan</th>
                </tr>
              </thead>
              <tbody>
                {tenants.workspaces.map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="py-2 font-medium">{w.name}</td>
                    <td>{w.plan_code ?? "—"}</td>
                    <td>
                      <Badge
                        variant={
                          w.status === "active"
                            ? "default"
                            : w.status === "canceled"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {w.status}
                      </Badge>
                    </td>
                    <td>${w.price_usd_monthly}</td>
                    <td>{w.period_end ? new Date(w.period_end).toLocaleDateString() : "—"}</td>
                    <td>
                      <select
                        className="text-xs border rounded px-1 py-0.5 bg-background"
                        value={w.plan_code ?? ""}
                        onChange={(e) => setPlan.mutate({ workspace_id: w.id, plan_code: e.target.value })}
                      >
                        {plans.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent revenue events (Platform webhooks)</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No events yet. Once tenants close leads and the Platform webhook fires, they'll appear here.
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {revenue.map((r: any) => (
                <div key={r.id} className="flex justify-between items-center border-b py-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.type === "activation" ? "default" : "secondary"}>{r.type}</Badge>
                    <span>{r.plan_name ?? r.plan_id ?? "unknown plan"}</span>
                  </div>
                  <div>
                    ${(r.amount_cents / 100).toFixed(2)} {r.currency}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(r.occurred_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
