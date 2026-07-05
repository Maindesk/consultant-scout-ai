import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalytics } from "@/lib/analytics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: Analytics,
});

function Analytics() {
  const fetchFn = useServerFn(getAnalytics);
  const { data } = useQuery({ queryKey: ["analytics"], queryFn: () => fetchFn() });

  const cards = [
    { label: "Total leads", value: data?.totalLeads ?? 0 },
    { label: "Emails sent", value: data?.sent ?? 0 },
    { label: "Replies", value: data?.replied ?? 0 },
    { label: "Positive replies", value: data?.positive ?? 0 },
    { label: "Reply rate", value: `${data?.replyRate ?? 0}%` },
    { label: "Positive rate", value: `${data?.positiveRate ?? 0}%` },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">{c.label}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {data?.byStatus && (
        <Card>
          <CardHeader><CardTitle className="text-base">Leads by status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.byStatus).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="capitalize">{k}</span>
                  <span className="font-medium">{v as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
