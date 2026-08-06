import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSearchConfigs, createSearchConfig, deleteSearchConfig, expandAudience } from "@/lib/targeting.functions";
import { discoverLeads, enrichLead } from "@/lib/leads.functions";
import { draftEmailsForLead } from "@/lib/drafts.functions";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Trash2, Search, Sparkles, ChevronDown } from "lucide-react";
import { KNOWN_PLATFORMS } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/targeting")({
  component: Targeting,
});

const PLATFORMS = [...KNOWN_PLATFORMS];

const AUDIENCE_EXAMPLES = [
  "Independent yoga studios in California that sell online class packs and want to grow membership.",
  "Solo dentists in the UK still using an old WordPress site with no online booking.",
  "Boutique Shopify skincare brands doing under $50k/mo that lean heavily on Instagram.",
  "Executive coaches in North America charging $10k+ programs and running webinars.",
];

function Targeting() {
  const qc = useQueryClient();
  const list = useServerFn(listSearchConfigs);
  const create = useServerFn(createSearchConfig);
  const del = useServerFn(deleteSearchConfig);
  const discover = useServerFn(discoverLeads);
  const enrich = useServerFn(enrichLead);
  const draft = useServerFn(draftEmailsForLead);
  const expand = useServerFn(expandAudience);

  const { data: configs = [] } = useQuery({ queryKey: ["search_configs"], queryFn: () => list() });

  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [niches, setNiches] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [intents, setIntents] = useState<string[]>([]);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discoverLimits, setDiscoverLimits] = useState<Record<string, number>>({});
  const [autoProcess, setAutoProcess] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const expandMut = useMutation({
    mutationFn: () => expand({ data: { description } }),
    onSuccess: (r) => {
      if (!name) setName(r.suggested_name || "New audience");
      setNiches(r.niches ?? []);
      setLocations(r.locations ?? []);
      setKeywords(r.keywords ?? []);
      setIntents(r.search_intents ?? []);
      setShowAdvanced(true);
      toast.success("Audience structured — review below and save.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not parse description"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          niches,
          locations,
          keywords,
          tech_stack: techStack,
          audience_description: description || undefined,
          search_intents: intents,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search_configs"] });
      setDescription(""); setName(""); setNiches([]); setLocations([]); setKeywords([]); setIntents([]); setTechStack([]);
      setShowAdvanced(false);
      toast.success("Audience saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const discoverMut = useMutation({
    mutationFn: async ({ id, limit }: { id: string; limit: number }) => {
      const r = await discover({ data: { search_config_id: id, limit } });
      if (!autoProcess || r.lead_ids.length === 0) return { ...r, enriched: 0, drafted: 0 };

      let enriched = 0;
      let drafted = 0;
      let done = 0;
      const ids = r.lead_ids;
      setProgress({ done: 0, total: ids.length });

      const CONCURRENCY = 3;
      const queue = [...ids];
      const worker = async () => {
        while (queue.length) {
          const leadId = queue.shift()!;
          try {
            const res: any = await enrich({ data: { lead_id: leadId } });
            enriched += 1;
            // Only draft when we actually have a reachable contact.
            if (res?.email) {
              try {
                await draft({ data: { lead_id: leadId } });
                drafted += 1;
              } catch { /* drafting is best-effort */ }
            }
          } catch { /* skip failed lead */ }
          done += 1;
          setProgress({ done, total: ids.length });
          qc.invalidateQueries({ queryKey: ["leads"] });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
      setProgress(null);
      return { ...r, enriched, drafted };
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pending_drafts"] });
      toast.success(
        autoProcess
          ? `${r.discovered} leads found · ${r.enriched} enriched · ${r.drafted} with drafted sequences`
          : `Discovered ${r.discovered} new leads${r.rejected ? ` — ${r.rejected} filtered` : ""}`,
      );
    },
    onError: (e) => {
      setProgress(null);
      toast.error(e instanceof Error ? e.message : "Discovery failed");
    },
  });


  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["search_configs"] }),
  });

  function togglePlatform(p: string) {
    setTechStack((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Targeting</h1>
        <p className="text-sm text-muted-foreground">
          Describe your ideal prospect in plain English. The AI turns it into a search config — no keyword expertise needed.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Describe your audience</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Independent yoga studios in California that sell online class packs and want to grow membership."
              rows={4}
              className="resize-none"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {AUDIENCE_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setDescription(ex)}
                  className="text-xs text-muted-foreground hover:text-foreground border border-dashed px-2 py-1 rounded text-left"
                >
                  {ex.length > 60 ? ex.slice(0, 60) + "…" : ex}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => expandMut.mutate()}
              disabled={description.trim().length < 10 || expandMut.isPending}
            >
              {expandMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Structure with AI
            </Button>
            {intents.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {niches.length} niches · {intents.length} search intents · {keywords.length} keywords
              </span>
            )}
          </div>

          <div>
            <Label>Website platform (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">Only keep leads whose site is built on one of these.</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`text-xs px-2.5 py-1 rounded border transition ${
                    techStack.includes(p)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {(intents.length > 0 || niches.length > 0 || showAdvanced) && (
            <div className="pt-2 border-t space-y-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ChevronDown className={`w-3 h-3 transition ${showAdvanced ? "rotate-180" : ""}`} />
                {showAdvanced ? "Hide" : "Review & tweak"} what the AI extracted
              </button>

              {showAdvanced && (
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Audience name" />
                  </div>
                  <ChipView label="Niches" items={niches} onChange={setNiches} />
                  <ChipView label="Locations" items={locations} onChange={setLocations} />
                  <ChipView label="Extra keywords" items={keywords} onChange={setKeywords} />
                  <ChipView
                    label="Search intent phrases"
                    hint="Snippets the AI expects to find on a real prospect's site."
                    items={intents}
                    onChange={setIntents}
                  />
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => createMut.mutate()}
            disabled={!name || niches.length === 0 || createMut.isPending}
            className="w-full"
          >
            {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save audience
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Saved audiences</h2>
        {configs.length === 0 && <p className="text-sm text-muted-foreground">No audiences yet.</p>}
        {configs.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-6 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                {(c as any).audience_description && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{(c as any).audience_description}"</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.niches.map((n: string) => <Badge key={n} variant="secondary">{n}</Badge>)}
                  {c.locations.map((n: string) => <Badge key={"l-" + n} variant="outline">{n}</Badge>)}
                  {(c.tech_stack ?? []).map((n: string) => (
                    <Badge key={"t-" + n} className="bg-blue-100 text-blue-800 border border-blue-300">{n}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={discoverLimits[c.id] ?? 15}
                  onChange={(e) => setDiscoverLimits((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                  disabled={discoverMut.isPending}
                  aria-label="How many leads to discover"
                >
                  {[5, 10, 15, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n} leads</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => discoverMut.mutate({ id: c.id, limit: discoverLimits[c.id] ?? 15 })}
                  disabled={discoverMut.isPending}
                >
                  {discoverMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Discover
                </Button>
                <Button size="sm" variant="ghost" onClick={() => delMut.mutate(c.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChipView({
  label, items, onChange, hint,
}: { label: string; items: string[]; onChange: (a: string[]) => void; hint?: string }) {
  const [input, setInput] = useState("");
  function add(v: string) {
    const t = v.trim();
    if (!t) return;
    if (!items.includes(t)) onChange([...items, t]);
    setInput("");
  }
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-1">{hint}</p>}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          placeholder="Add and press Enter"
        />
        <Button type="button" variant="outline" onClick={() => add(input)}>Add</Button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {items.map((v) => (
            <button
              key={v}
              onClick={() => onChange(items.filter((x) => x !== v))}
              className="text-xs bg-secondary hover:bg-destructive hover:text-destructive-foreground px-2 py-1 rounded"
            >
              {v} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
