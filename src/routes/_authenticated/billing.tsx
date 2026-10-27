import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBilling, cancelMyPlan } from "@/lib/billing.functions";
import { PricingPlans } from "@/components/PricingPlans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [
    { title: "Billing & usage | PixelOutreach" },
    { name: "description", content: "Review your PixelOutreach usage and the Base and Pro plans for growing your white-label." },
    { property: "og:title", content: "Billing & usage | PixelOutreach" },
    { property: "og:description", content: "Manage your white-label outreach subscription and monthly usage." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: BillingPage,
});

function BillingPage() {
  const qc = useQueryClient();
  const billFn = useServerFn(getMyBilling);
  const cancelFn = useServerFn(cancelMyPlan);

  const { data: billing, isPending, error } = useQuery({ queryKey: ["billing"], queryFn: () => billFn() });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Subscription canceled");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isPending) return <div className="p-8 text-sm text-muted-foreground">Loading billing…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error instanceof Error ? error.message : "Unable to load billing. Please try again."}</div>;
  if (!billing) return <div className="p-8 text-sm text-muted-foreground">Create your workspace to view billing.</div>;

  const sub = billing.subscription;
  const plan = sub.plan;
  const usage = billing.usage;
  const isTrialing = sub.status === "trialing";
  const isCanceled = sub.status === "canceled";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing & usage</h1>
        <p className="text-sm text-muted-foreground">Manage your plan and monitor this month's usage.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Current plan: {plan.name}
              <Badge variant={isCanceled ? "destructive" : isTrialing ? "secondary" : "default"}>{sub.status}</Badge>
            </CardTitle>
            <CardDescription>
              {isTrialing
                ? `Trial ends ${new Date(sub.trial_end ?? sub.current_period_end).toLocaleDateString()}`
                : `Renews ${new Date(sub.current_period_end).toLocaleDateString()}`}
              {" · "}${plan.price_usd_monthly}/month
            </CardDescription>
          </div>
          {!isCanceled && !isTrialing && (
            <Button variant="ghost" size="sm" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              Cancel plan
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-6">
            <UsageBlock label="Leads discovered" used={usage.leads_discovered_used} limit={plan.leads_monthly} />
            <UsageBlock label="AI credits" used={usage.ai_credits_used} limit={plan.ai_credits_monthly} />
            <UsageBlock label="Emails sent" used={usage.emails_used} limit={plan.emails_monthly} />
          </div>
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Pay-as-you-go leads</div>
              <div className="text-xs text-muted-foreground">
                Past your allowance, extra leads keep flowing at $
                {((plan.overage_price_cents_per_lead ?? 0) / 100).toFixed(2)} each instead of stopping.
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{usage.overage_leads_used.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                ${(usage.overage_cents / 100).toFixed(2)} this period
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      <div>
        <h2 className="text-lg font-semibold mb-3">Available plans</h2>
        <PricingPlans renderAction={() => <Button disabled variant="outline" size="lg" className="w-full h-11">Checkout not available yet</Button>} />
        <p className="text-xs text-muted-foreground mt-4">
          Base and Pro are the new paid offers. Checkout is not connected yet; your current subscription and enforced usage limits remain unchanged.
        </p>
      </div>
    </div>
  );
}

function UsageBlock({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">
        {used.toLocaleString()} / {limit.toLocaleString()}
      </div>
      <div className="w-full h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

