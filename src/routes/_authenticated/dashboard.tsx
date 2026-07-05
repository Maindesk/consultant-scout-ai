import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalytics } from "@/lib/analytics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fetchAnalytics = useServerFn(getAnalytics);
  const { data } = useQuery({ queryKey: ["analytics"], queryFn: () => fetchAnalytics() });

  const stats = [
    { label: "Total leads", value: data?.totalLeads ?? 0 },
    { label: "Emails sent", value: data?.sent ?? 0 },
    { label: "Replies", value: data?.replied ?? 0 },
    { label: "Pending approval", value: data?.pending ?? 0 },
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
        <CardHeader><CardTitle className="text-base">Get started</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>1. <Link to="/business" className="underline">Set up your business profile</Link> so the AI can personalize outreach.</div>
          <div>2. <Link to="/targeting" className="underline">Create a targeting config</Link> for the coaches & consultants you want to reach.</div>
          <div>3. <Link to="/leads" className="underline">Run discovery</Link> to find leads, then enrich them.</div>
          <div>4. <Link to="/approval" className="underline">Approve emails</Link> to send.</div>
        </CardContent>
      </Card>
    </div>
  );
}
