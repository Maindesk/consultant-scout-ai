import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listPipeline, updateLeadStage } from "@/lib/leads.functions";
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  STAGE_WIN_PROBABILITY,
  expectedValue,
  formatCurrency,
  type LeadStage,
} from "@/lib/pipeline";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/board")({
  component: BoardPage,
});

type PipelineLead = {
  id: string;
  business_name: string | null;
  domain: string | null;
  website: string | null;
  status: LeadStage;
  platform: string | null;
  platform_confidence: number | null;
  niche: string | null;
  ai_stage_reason: string | null;
  email: string | null;
};

function BoardPage() {
  const listFn = useServerFn(listPipeline);
  const updateFn = useServerFn(updateLeadStage);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline"],
    queryFn: () => listFn(),
  });

  const move = useMutation({
    mutationFn: (v: { lead_id: string; stage: LeadStage }) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline"] }),
  });

  const [dragId, setDragId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byStage: Record<LeadStage, PipelineLead[]> = Object.fromEntries(
      PIPELINE_STAGES.map((s) => [s, [] as PipelineLead[]])
    ) as any;
    for (const l of (data?.leads ?? []) as PipelineLead[]) {
      if (byStage[l.status]) byStage[l.status].push(l);
    }
    return byStage;
  }, [data]);

  const avg = data?.avg_deal_value ?? 0;
  const currency = data?.currency ?? "USD";

  const totalExpected = useMemo(() => {
    let sum = 0;
    for (const stage of PIPELINE_STAGES) {
      sum += grouped[stage].length * expectedValue(stage, avg);
    }
    return sum;
  }, [grouped, avg]);

  const wonValue = grouped.won.length * avg;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading pipeline…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline Board</h1>
          <p className="text-sm text-muted-foreground">Drag leads between stages. Expected value uses your avg deal value × stage probability.</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Expected pipeline</div>
            <div className="text-xl font-semibold">{formatCurrency(totalExpected, currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Closed won</div>
            <div className="text-xl font-semibold text-green-600">{formatCurrency(wonValue, currency)}</div>
          </div>
          {avg === 0 && (
            <div className="text-xs text-amber-600 self-center max-w-xs">
              Set an avg deal value in <b>My Business</b> to see forecasts.
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const items = grouped[stage];
          const stageEV = items.length * expectedValue(stage, avg);
          return (
            <div
              key={stage}
              className="w-72 shrink-0 rounded-lg border border-border bg-card flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) {
                  move.mutate({ lead_id: dragId, stage });
                  setDragId(null);
                }
              }}
            >
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${STAGE_COLORS[stage]}`}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(STAGE_WIN_PROBABILITY[stage] * 100)}% · {formatCurrency(stageEV, currency)}
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[120px] flex-1">
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground italic px-2 py-6 text-center">Drop leads here</div>
                )}
                {items.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => setDragId(null)}
                    className="rounded-md border border-border bg-background p-2 text-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition"
                  >
                    <div className="font-medium truncate">{l.business_name || l.domain}</div>
                    <div className="text-xs text-muted-foreground truncate">{l.domain}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {l.platform && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted">
                          {l.platform}
                          {l.platform_confidence != null ? ` ${Math.round(l.platform_confidence * 100)}%` : ""}
                        </span>
                      )}
                      {l.niche && (
                        <span className="text-[10px] text-muted-foreground truncate">{l.niche}</span>
                      )}
                    </div>
                    {l.ai_stage_reason && (
                      <div className="text-[10px] text-indigo-600 mt-1 line-clamp-2 border-l-2 border-indigo-500 pl-1.5">
                        {l.ai_stage_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
