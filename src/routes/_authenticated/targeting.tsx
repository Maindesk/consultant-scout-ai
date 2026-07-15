import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSearchConfigs, createSearchConfig, deleteSearchConfig } from "@/lib/targeting.functions";
import { discoverLeads } from "@/lib/leads.functions";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, Search } from "lucide-react";
import { KNOWN_PLATFORMS } from "@/lib/platforms";

export const Route = createFileRoute("/_authenticated/targeting")({
  component: Targeting,
});

const NICHE_SUGGESTIONS = ["business coach", "life coach", "fitness coach", "executive coach", "marketing consultant", "operations consultant"];
const PLATFORMS = [...KNOWN_PLATFORMS];

function Targeting() {
  const qc = useQueryClient();
  const list = useServerFn(listSearchConfigs);
  const create = useServerFn(createSearchConfig);
  const del = useServerFn(deleteSearchConfig);
  const discover = useServerFn(discoverLeads);

  const { data: configs = [] } = useQuery({ queryKey: ["search_configs"], queryFn: () => list() });

  const [name, setName] = useState("");
  const [niches, setNiches] = useState<string[]>([]);
  const [nicheInput, setNicheInput] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const [discoverLimits, setDiscoverLimits] = useState<Record<string, number>>({});

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, niches, locations, keywords, tech_stack: techStack } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search_configs"] });
      setName(""); setNiches([]); setLocations([]); setKeywords([]); setTechStack([]);
      toast.success("Config created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const discoverMut = useMutation({
    mutationFn: ({ id, limit }: { id: string; limit: number }) => discover({ data: { search_config_id: id, limit } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Discovered ${r.discovered} new leads${r.rejected ? ` — ${r.rejected} filtered` : ""}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Discovery failed"),
  });

  const discoverMut = useMutation({
    mutationFn: (id: string) => discover({ data: { search_config_id: id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Discovered ${r.discovered} new leads`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Discovery failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["search_configs"] }),
  });

  function addChip(v: string, arr: string[], setArr: (a: string[]) => void, setInput: (s: string) => void) {
    const t = v.trim();
    if (!t) return;
    if (!arr.includes(t)) setArr([...arr, t]);
    setInput("");
  }

  function togglePlatform(p: string) {
    setTechStack((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Targeting</h1>
        <p className="text-sm text-muted-foreground">Define who the AI should find.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">New search config</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input placeholder="e.g. US business coaches on Squarespace" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <ChipInput
            label="Niches"
            value={niches}
            input={nicheInput}
            setInput={setNicheInput}
            onAdd={(v) => addChip(v, niches, setNiches, setNicheInput)}
            onRemove={(v) => setNiches(niches.filter((x) => x !== v))}
            suggestions={NICHE_SUGGESTIONS}
          />
          <ChipInput
            label="Locations (optional)"
            value={locations}
            input={locationInput}
            setInput={setLocationInput}
            onAdd={(v) => addChip(v, locations, setLocations, setLocationInput)}
            onRemove={(v) => setLocations(locations.filter((x) => x !== v))}
          />
          <ChipInput
            label="Extra keywords (optional)"
            value={keywords}
            input={keywordInput}
            setInput={setKeywordInput}
            onAdd={(v) => addChip(v, keywords, setKeywords, setKeywordInput)}
            onRemove={(v) => setKeywords(keywords.filter((x) => x !== v))}
          />

          <div>
            <Label>Website platform (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Only keep leads whose site is built on one of these. Detected during enrichment.
            </p>
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

          <Button onClick={() => createMut.mutate()} disabled={!name || niches.length === 0 || createMut.isPending}>
            Save config
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Saved configs</h2>
        {configs.length === 0 && <p className="text-sm text-muted-foreground">No configs yet.</p>}
        {configs.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-6 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.niches.map((n: string) => <Badge key={n} variant="secondary">{n}</Badge>)}
                  {c.locations.map((n: string) => <Badge key={"l-" + n} variant="outline">{n}</Badge>)}
                  {(c.tech_stack ?? []).map((n: string) => (
                    <Badge key={"t-" + n} className="bg-blue-100 text-blue-800 border border-blue-300">{n}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => discoverMut.mutate(c.id)} disabled={discoverMut.isPending}>
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

function ChipInput({
  label, value, input, setInput, onAdd, onRemove, suggestions,
}: {
  label: string; value: string[]; input: string; setInput: (s: string) => void;
  onAdd: (v: string) => void; onRemove: (v: string) => void; suggestions?: string[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(input); } }}
          placeholder="Type and press Enter"
        />
        <Button type="button" variant="outline" onClick={() => onAdd(input)}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {value.map((v) => (
            <button key={v} onClick={() => onRemove(v)} className="text-xs bg-secondary hover:bg-destructive hover:text-destructive-foreground px-2 py-1 rounded">
              {v} ×
            </button>
          ))}
        </div>
      )}
      {suggestions && (
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <button key={s} onClick={() => onAdd(s)} className="text-xs text-muted-foreground hover:text-foreground border border-dashed px-2 py-1 rounded">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
