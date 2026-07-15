/**
 * Shared pipeline / kanban stage definitions.
 * Client- and server-safe (no server-only imports).
 */
export type LeadStage =
  | "new"
  | "enriched"
  | "drafted"
  | "contacted"
  | "replied"
  | "in_progress"
  | "won"
  | "lost";

export const PIPELINE_STAGES: LeadStage[] = [
  "new",
  "enriched",
  "drafted",
  "contacted",
  "replied",
  "in_progress",
  "won",
  "lost",
];

/** Probability that a lead in this stage eventually closes (used for expected value). */
export const STAGE_WIN_PROBABILITY: Record<LeadStage, number> = {
  new: 0.05,
  enriched: 0.08,
  drafted: 0.10,
  contacted: 0.15,
  replied: 0.30,
  in_progress: 0.60,
  won: 1.0,
  lost: 0,
};

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  enriched: "Enriched",
  drafted: "Drafted",
  contacted: "Contacted",
  replied: "Replied",
  in_progress: "In Progress",
  won: "Won",
  lost: "Lost",
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  enriched: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  drafted: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  contacted: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  replied: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  in_progress: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  won: "bg-green-500/10 text-green-700 border-green-500/30",
  lost: "bg-gray-500/10 text-gray-600 border-gray-500/30",
};

export function isLeadStage(s: string | null | undefined): s is LeadStage {
  return !!s && (PIPELINE_STAGES as string[]).includes(s);
}

export function expectedValue(stage: string | null | undefined, avgDealValue: number): number {
  if (!isLeadStage(stage)) return 0;
  return avgDealValue * STAGE_WIN_PROBABILITY[stage];
}

export function formatCurrency(v: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `$${Math.round(v).toLocaleString()}`;
  }
}
