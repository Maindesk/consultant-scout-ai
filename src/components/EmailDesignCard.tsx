import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Palette, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getEmailBranding, saveEmailBranding } from "@/lib/email-settings.functions";
import { renderBrandedEmail, type EmailBranding } from "@/lib/email-branding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const SAMPLE =
  "Hi Sarah,\n\nI noticed your site runs on a builder plus three separate tools. We put everything in one place.\n\n{{DEMO_LINK}}\n\nWorth a quick look?\n\nBest,";

export function EmailDesignCard({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getEmailBranding);
  const saveFn = useServerFn(saveEmailBranding);
  const { data } = useQuery({
    queryKey: ["email-branding", workspaceId],
    queryFn: () => getFn({ data: { workspace_id: workspaceId } }),
  });
  const [b, setB] = useState<EmailBranding>({});
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (data) setB(data); }, [data]);
  const set = (k: keyof EmailBranding) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setB((p) => ({ ...p, [k]: k === "logo_width" ? Number(e.target.value) : e.target.value }));

  const save = useMutation({
    mutationFn: () => saveFn({ data: { workspace_id: workspaceId, branding: b } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-branding", workspaceId] }); toast.success("Email design saved"); },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${workspaceId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("email-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: s, error: e2 } = await supabase.storage.from("email-logos").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (e2 || !s) throw e2 ?? new Error("Could not create link");
      setB((p) => ({ ...p, logo_url: s.signedUrl }));
      toast.success("Logo uploaded — click Save design");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  }

  const preview = useMemo(() => renderBrandedEmail(SAMPLE, b, "https://example.com").html, [b]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Palette className="w-4 h-4" /> Email design</CardTitle>
        <CardDescription>Signature with your logo, plus the button used for demo-site links in outreach emails.</CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Name</Label><Input value={b.sig_name ?? ""} onChange={set("sig_name")} placeholder="Hafedh K." /></div>
            <div><Label className="text-xs">Title</Label><Input value={b.sig_title ?? ""} onChange={set("sig_title")} placeholder="Founder of Maindesk" /></div>
            <div><Label className="text-xs">Website</Label><Input value={b.website ?? ""} onChange={set("website")} placeholder="maindesk.io" /></div>
            <div><Label className="text-xs">Email</Label><Input value={b.email ?? ""} onChange={set("email")} placeholder="hello@maindesk.io" /></div>
            <div><Label className="text-xs">Phone (optional)</Label><Input value={b.phone ?? ""} onChange={set("phone")} /></div>
            <div><Label className="text-xs">Logo width (px)</Label><Input type="number" min={40} max={300} value={b.logo_width ?? 140} onChange={set("logo_width")} /></div>
          </div>
          <div>
            <Label className="text-xs">Logo</Label>
            <div className="flex gap-2 items-center">
              <Button asChild size="sm" variant="outline" disabled={uploading}>
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                  Upload logo
                  <input type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
              </Button>
              {b.logo_url && <Button size="sm" variant="ghost" onClick={() => setB((p) => ({ ...p, logo_url: "" }))}>Remove</Button>}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">PNG or JPG works best in email apps (SVG is often blocked).</p>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div><Label className="text-xs">Demo button text</Label><Input value={b.button_label ?? ""} onChange={set("button_label")} placeholder="View your demo site" /></div>
            <div><Label className="text-xs">Color</Label><Input type="color" className="w-14 p-1" value={b.button_color || "#FF5100"} onChange={set("button_color")} /></div>
          </div>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Save design
          </Button>
          <p className="text-[10px] text-muted-foreground">Use “Send test” above to see it in your inbox.</p>
        </div>
        <div>
          <Label className="text-xs">Preview</Label>
          <iframe title="Email preview" sandbox="" className="w-full h-[420px] rounded-md border bg-card" srcDoc={`<body style="margin:16px;background:#fff">${preview}</body>`} />
        </div>
      </CardContent>
    </Card>
  );
}
