import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listInbox,
  updateSuggestedReply,
  ignoreInbound,
  regenerateSuggestion,
  approveAndSendReply,
} from "@/lib/inbox.functions";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, RefreshCcw, X, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
});

const classColors: Record<string, string> = {
  interested: "bg-green-100 text-green-800 border-green-300",
  question: "bg-blue-100 text-blue-800 border-blue-300",
  objection: "bg-amber-100 text-amber-800 border-amber-300",
  not_interested: "bg-gray-100 text-gray-700 border-gray-300",
  out_of_office: "bg-purple-100 text-purple-800 border-purple-300",
  other: "bg-gray-100 text-gray-700 border-gray-300",
};

function InboxPage() {
  const qc = useQueryClient();
  const list = useServerFn(listInbox);
  const { data: messages = [] } = useQuery({ queryKey: ["inbox"], queryFn: () => list() });

  const pending = messages.filter((m: any) => m.reply_status === "pending_review");
  const done = messages.filter((m: any) => m.reply_status !== "pending_review");

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} replies awaiting your review · {done.length} handled
        </p>
      </div>

      {messages.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No replies yet. Once leads respond, they'll appear here with an AI-suggested reply for you to approve.
          </CardContent>
        </Card>
      )}

      {pending.map((m: any) => (
        <InboundCard key={m.id} msg={m} onChange={() => qc.invalidateQueries({ queryKey: ["inbox"] })} />
      ))}

      {done.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-muted-foreground pt-6">Handled</h2>
          {done.map((m: any) => (
            <InboundCard key={m.id} msg={m} onChange={() => qc.invalidateQueries({ queryKey: ["inbox"] })} readOnly />
          ))}
        </>
      )}
    </div>
  );
}

function InboundCard({ msg, onChange, readOnly = false }: { msg: any; onChange: () => void; readOnly?: boolean }) {
  const [reply, setReply] = useState<string>(msg.suggested_reply ?? "");
  const update = useServerFn(updateSuggestedReply);
  const ignore = useServerFn(ignoreInbound);
  const regen = useServerFn(regenerateSuggestion);
  const send = useServerFn(approveAndSendReply);

  const saveMut = useMutation({
    mutationFn: () => update({ data: { id: msg.id, suggested_reply: reply } }),
    onSuccess: () => toast.success("Draft saved"),
  });
  const regenMut = useMutation({
    mutationFn: () => regen({ data: { id: msg.id } }),
    onSuccess: (out) => { setReply(out.suggested_reply); onChange(); toast.success("Regenerated"); },
  });
  const ignoreMut = useMutation({
    mutationFn: () => ignore({ data: { id: msg.id } }),
    onSuccess: () => { onChange(); toast.success("Ignored"); },
  });
  const sendMut = useMutation({
    mutationFn: () => send({ data: { id: msg.id, body: reply } }),
    onSuccess: () => { onChange(); toast.success("Reply sent"); },
    onError: (e: any) => toast.error(e?.message ?? "Send failed"),
  });

  const cls = msg.classification ?? "other";
  const lead = msg.leads;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{lead?.business_name || msg.from_email}</div>
          <div className="text-xs text-muted-foreground truncate">
            {msg.from_email} · {new Date(msg.received_at).toLocaleString()}
          </div>
          {msg.subject && <div className="text-sm mt-1 font-medium">{msg.subject}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={classColors[cls] ?? classColors.other}>
            {cls.replace("_", " ")}
          </Badge>
          {msg.reply_status === "sent" && <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Sent</Badge>}
          {msg.reply_status === "ignored" && <Badge variant="outline">Ignored</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded border bg-muted/40 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-auto">
          {msg.body}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">AI-suggested reply</div>
          <Textarea
            rows={6}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={readOnly}
            placeholder="No suggestion generated"
          />
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !reply.trim()}>
                <Send className="w-3 h-3 mr-1" /> Approve & send
              </Button>
              <Button size="sm" variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || reply === (msg.suggested_reply ?? "")}>
                <Check className="w-3 h-3 mr-1" /> Save edits
              </Button>
              <Button size="sm" variant="outline" onClick={() => regenMut.mutate()} disabled={regenMut.isPending}>
                <RefreshCcw className="w-3 h-3 mr-1" /> Regenerate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => ignoreMut.mutate()} disabled={ignoreMut.isPending}>
                <X className="w-3 h-3 mr-1" /> Ignore
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
