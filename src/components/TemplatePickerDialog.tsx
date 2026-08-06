import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAvailableTemplates } from "@/lib/platform.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ImageOff, ExternalLink, Check, LayoutTemplate } from "lucide-react";

export interface PickedTemplate {
  id: string;
  name: string;
  type: "WEBSITE" | "FUNNEL";
  thumb?: string;
  previewUrl?: string;
}

/** Reusable modal that lists the white-label platform templates with preview images. */
export function TemplatePickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value?: string | null;
  onSelect: (tpl: PickedTemplate | null) => void;
}) {
  const listTpls = useServerFn(listAvailableTemplates);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["demo-templates"],
    queryFn: () => listTpls(),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const templates = (data?.templates ?? []) as PickedTemplate[];
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return templates;
    return templates.filter((x) => x.name.toLowerCase().includes(t));
  }, [templates, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choose a demo site template</DialogTitle>
          <DialogDescription>
            Every demo site provisioned for a prospect starts from this template, with their business name, contact
            details and brand colour injected automatically.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search templates…"
          className="h-9"
        />

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading templates…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {data?.error
                ? `Couldn't load templates: ${data.error}`
                : "No templates available — connect your platform API in Integrations."}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map((t) => {
                const active = value === t.id;
                return (
                  <button
                    key={`${t.type}-${t.id}`}
                    type="button"
                    onClick={() => {
                      onSelect(t);
                      onOpenChange(false);
                    }}
                    className={`group text-left rounded-lg border overflow-hidden transition hover:shadow-md ${
                      active ? "border-primary ring-2 ring-primary/30" : "border-border"
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                      {t.thumb ? (
                        <img
                          src={t.thumb}
                          alt={`${t.name} template preview`}
                          loading="lazy"
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <ImageOff className="w-6 h-6 text-muted-foreground" />
                      )}
                      {active && (
                        <span className="absolute top-2 right-2 rounded-full bg-primary text-primary-foreground p-1">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <div className="text-xs font-medium truncate">{t.name}</div>
                      <div className="flex items-center gap-1">
                        {t.type === "FUNNEL" && <Badge variant="secondary" className="text-[10px]">Funnel</Badge>}
                        {t.previewUrl && (
                          <a
                            href={t.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-muted-foreground underline inline-flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> Live preview
                          </a>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect(null);
              onOpenChange(false);
            }}
          >
            Clear selection
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small button + thumbnail showing the currently selected template. */
export function TemplatePickerButton({
  selected,
  onOpen,
  label = "Choose template",
}: {
  selected?: PickedTemplate | null;
  onOpen: () => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {selected?.thumb && (
        <img
          src={selected.thumb}
          alt={`${selected.name} template preview`}
          className="w-16 h-12 object-cover object-top rounded border"
        />
      )}
      <div className="flex-1 min-w-0">
        <Button type="button" variant="outline" size="sm" onClick={onOpen}>
          <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
          {selected ? "Change template" : label}
        </Button>
        <div className="text-[11px] text-muted-foreground truncate mt-1">
          {selected ? selected.name : "No template selected — the prospect picks one on first login."}
        </div>
      </div>
    </div>
  );
}
