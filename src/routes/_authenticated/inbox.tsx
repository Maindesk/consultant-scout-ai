import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listConversations,
  getLeadConversation,
  updateSuggestedReply,
  ignoreInbound,
  regenerateSuggestion,
  approveAndSendReply,
} from "@/lib/inbox.functions";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, RefreshCcw, X, Check, MailOpen, ArrowLeft, Inbox as InboxIcon } from "lucide-react";

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
  const list = useServerFn(listConversations);
  const { data: conversations = [] } = useQuery({
    queryKey: ["inbox_conversations"],
    queryFn: () => list(),
  });

  const [activeLead, setActiveLead] = useState<string | null>(null);

  const pending = conversations.filter((c) => c.pending_replies > 0);
  const other = conversations.filter((c) => c.pending_replies === 0);

  return (
    <div className="flex h-full">
      {/* Left: conversation list */}
      <div className="w-96 border-r flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <InboxIcon className="w-4 h-4" /> Inbox
          </h1>
          <p className="text-xs text-muted-foreground">
            {pending.length} pending · {conversations.length} total
          </p>
        </div>
        <div className="flex-1 overflow-auto">
          {conversations.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              No conversations yet. Replies from leads will appear here.
            </div>
          )}
          {pending.length > 0 && <SectionLabel>Needs review</SectionLabel>}
          {pending.map((c) => (
            <ConversationRow key={c.lead_id} c={c} active={activeLead === c.lead_id} onClick={() => setActiveLead(c.lead_id)} />
          ))}
          {other.length > 0 && <SectionLabel>All conversations</SectionLabel>}
          {other.map((c) => (
            <ConversationRow key={c.lead_id} c={c} active={activeLead === c.lead_id} onClick={() => setActiveLead(c.lead_id)} />
          ))}
        </div>
      </div>

      {/* Right: conversation view */}
      <div className="flex-1 overflow-auto bg-muted/20">
        {activeLead ? (
          <ConversationView leadId={activeLead} onBack={() => setActiveLead(null)} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{children}</div>;
}

function ConversationRow({
  c,
  active,
  onClick,
}: {
  c: any;
  active: boolean;
  onClick: () => void;
}) {
  const title = c.lead?.business_name || c.lead?.website || c.last_from || "Unknown lead";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b hover:bg-accent/50 transition ${
        active ? "bg-accent" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{title}</div>
          <div className="text-xs text-muted-foreground truncate">{c.last_from ?? c.lead?.email}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {c.pending_replies > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
              {c.pending_replies}
            </Badge>
          )}
          {c.classification && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${classColors[c.classification] ?? classColors.other}`}>
              {c.classification.replace("_", " ")}
            </span>
          )}
        </div>
      </div>
      {c.last_inbound_preview && (
        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.last_inbound_preview}</div>
      )}
      <div className="text-[10px] text-muted-foreground mt-1">
        {c.sent_count} sent · {c.inbound_count} received
        {c.last_activity && <> · {new Date(c.last_activity).toLocaleString()}</>}
      </div>
    </button>
  );
}

function ConversationView({ leadId, onBack }: { leadId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const fetchThread = useServerFn(getLeadConversation);
  const { data, isLoading } = useQuery({
    queryKey: ["conversation", leadId],
    queryFn: () => fetchThread({ data: { lead_id: leadId } }),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;

  const { lead, thread } = data;
  const pendingInbound = thread.filter((t) => t.kind === "inbound" && t.reply_status === "pending_review").pop();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <div className="font-semibold truncate">{lead.business_name || lead.website}</div>
          <div className="text-xs text-muted-foreground truncate">
            {lead.email ?? "no email"} · {lead.niche ?? ""} · status: {lead.status}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {thread.map((item) => (item.kind === "sent" ? (
          <SentMessage key={"s-" + item.id} item={item} />
        ) : (
          <InboundMessage
            key={"i-" + item.id}
            item={item}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["conversation", leadId] });
              qc.invalidateQueries({ queryKey: ["inbox_conversations"] });
            }}
          />
        )))}
        {thread.length === 0 && (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">No messages yet.</CardContent></Card>
        )}
      </div>

      {pendingInbound && (
        <div className="text-xs text-muted-foreground text-center pt-4">
          AI reply drafted above — approve or edit to send.
        </div>
      )}
    </div>
  );
}

function SentMessage({ item }: { item: any }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        <div className="text-[10px] text-muted-foreground text-right mb-1 flex items-center justify-end gap-1">
          <MailOpen className="w-3 h-3" /> You sent · {new Date(item.at).toLocaleString()}
        </div>
        <div className="rounded-lg bg-primary text-primary-foreground p-3 text-sm">
          {item.subject && <div className="font-medium text-xs opacity-90 mb-1">{item.subject}</div>}
          <div className="whitespace-pre-wrap">{item.body}</div>
        </div>
      </div>
    </div>
  );
}

function InboundMessage({ item, onChange }: { item: any; onChange: () => void }) {
  const [reply, setReply] = useState<string>(item.suggested_reply ?? "");
  useEffect(() => { setReply(item.suggested_reply ?? ""); }, [item.suggested_reply]);

  const update = useServerFn(updateSuggestedReply);
  const ignore = useServerFn(ignoreInbound);
  const regen = useServerFn(regenerateSuggestion);
  const send = useServerFn(approveAndSendReply);

  const saveMut = useMutation({
    mutationFn: () => update({ data: { id: item.id, suggested_reply: reply } }),
    onSuccess: () => toast.success("Draft saved"),
  });
  const regenMut = useMutation({
    mutationFn: () => regen({ data: { id: item.id } }),
    onSuccess: (out) => { setReply(out.suggested_reply); onChange(); toast.success("Regenerated"); },
  });
  const ignoreMut = useMutation({
    mutationFn: () => ignore({ data: { id: item.id } }),
    onSuccess: () => { onChange(); toast.success("Ignored"); },
  });
  const sendMut = useMutation({
    mutationFn: () => send({ data: { id: item.id, body: reply } }),
    onSuccess: () => { onChange(); toast.success("Reply sent"); },
    onError: (e: any) => toast.error(e?.message ?? "Send failed"),
  });

  const cls = item.classification ?? "other";
  const isPending = item.reply_status === "pending_review";

  return (
    <div className="space-y-2">
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-2">
            {item.from_email} · {new Date(item.at).toLocaleString()}
            <span className={`px-1.5 py-0.5 rounded border ${classColors[cls] ?? classColors.other}`}>
              {cls.replace("_", " ")}
            </span>
            {item.reply_status === "sent" && (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Replied</Badge>
            )}
            {item.reply_status === "ignored" && <Badge variant="outline">Ignored</Badge>}
          </div>
          <div className="rounded-lg bg-card border p-3 text-sm">
            {item.subject && <div className="font-medium text-xs mb-1">{item.subject}</div>}
            <div className="whitespace-pre-wrap">{item.body}</div>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="ml-4 border-l-2 border-primary/40 pl-4 space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground">AI-suggested reply</div>
          <Textarea
            rows={5}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="No suggestion generated"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !reply.trim()}>
              <Send className="w-3 h-3 mr-1" /> Approve & send
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || reply === (item.suggested_reply ?? "")}>
              <Check className="w-3 h-3 mr-1" /> Save edits
            </Button>
            <Button size="sm" variant="outline" onClick={() => regenMut.mutate()} disabled={regenMut.isPending}>
              <RefreshCcw className="w-3 h-3 mr-1" /> Regenerate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => ignoreMut.mutate()} disabled={ignoreMut.isPending}>
              <X className="w-3 h-3 mr-1" /> Ignore
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
