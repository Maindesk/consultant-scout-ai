import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: () => (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <Card><CardContent className="pt-6 text-sm text-muted-foreground">
        Reply capture arrives with the sending infrastructure. Once emails start sending, replies land here with AI classification and suggested responses.
      </CardContent></Card>
    </div>
  ),
});
