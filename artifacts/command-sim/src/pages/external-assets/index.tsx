import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Box, Image, Loader2, Play } from "lucide-react";
import { ExternalAssetImportPanel, type ExternalAssetRecord } from "@/components/external-asset-import-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const GUI_ASSETS_KEY = "t1-user-gui-assets-v1";

export default function ExternalAssetsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selected, setSelected] = useState<ExternalAssetRecord | null>(null);
  const [working, setWorking] = useState(false);

  const registerGuiAsset = () => {
    if (!selected) return;
    const current = loadGuiAssets();
    const next = [selected, ...current.filter(asset => asset.id !== selected.id)].slice(0, 200);
    localStorage.setItem(GUI_ASSETS_KEY, JSON.stringify(next));
    toast({ title: "GUI asset registered", description: `${selected.name} is available to this user's UI and workflow configuration.` });
  };

  const queueGeneration = async () => {
    if (!selected) return;
    if (!selected.mimeType.startsWith("image/")) {
      toast({ title: "Image source required", variant: "destructive" });
      return;
    }
    setWorking(true);
    try {
      const response = await fetch("/api/asset-generation/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image_to_3d",
          sourceAssetId: selected.sourceAssetId,
          generatorPreference: ["hunyuan3d-2", "instantmesh", "triposr"],
          assetType: "prop",
          targetPolygonCount: 50_000,
          lodCount: 3,
          removeBackground: true,
          licenseStatus: selected.licenseStatus,
          publishAfterValidation: false,
        }),
      });
      const body = await response.json() as { job?: { id?: string }; error?: string };
      if (!response.ok || !body.job?.id) throw new Error(body.error ?? `Job creation failed with HTTP ${response.status}.`);
      toast({ title: "Generation queued", description: `${selected.name} was sent to the existing GPU/Blender asset pipeline.` });
    } catch (error) {
      toast({ title: "Cannot queue generation", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_38%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--muted)/0.4))] p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/80 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-xl font-semibold">External Assets</h1><p className="text-xs text-muted-foreground">Figma GUI exports and selected Hugging Face assets, stored per authenticated workspace user.</p></div></div>
          <Button variant="outline" onClick={() => setLocation("/asset-lab")}><Box className="mr-2 h-4 w-4" />Open Asset Lab</Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
          <ExternalAssetImportPanel onSelect={setSelected} />
          <Card className="overflow-hidden shadow-xl">
            <CardHeader><CardTitle className="flex items-center justify-between text-sm"><span>Selected asset</span>{selected && <Badge variant="outline">{selected.provider}</Badge>}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!selected ? <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Import or select an asset from the library.</div> : (
                <>
                  <div className="overflow-hidden rounded-xl border bg-[linear-gradient(145deg,hsl(var(--muted)/0.5),hsl(var(--background)))] shadow-inner">
                    {selected.mimeType.startsWith("image/") ? <img src={`/api/external-assets/${encodeURIComponent(selected.id)}/content`} alt={selected.name} className="max-h-[460px] w-full object-contain" /> : <div className="flex min-h-72 flex-col items-center justify-center gap-2"><Box className="h-12 w-12 text-primary" /><span className="text-sm">{selected.mimeType}</span></div>}
                  </div>
                  <div className="grid gap-2 rounded-lg border bg-background/70 p-3 text-xs sm:grid-cols-2"><div><span className="text-muted-foreground">Name</span><strong className="block break-all">{selected.name}</strong></div><div><span className="text-muted-foreground">Size</span><strong className="block">{(selected.byteLength / 1024).toFixed(1)} KB</strong></div><div><span className="text-muted-foreground">License</span><strong className="block">{selected.licenseStatus}</strong></div><div><span className="text-muted-foreground">SHA-256</span><strong className="block truncate">{selected.sha256}</strong></div></div>
                  <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={registerGuiAsset}><Image className="mr-2 h-4 w-4" />Use in GUI</Button><Button disabled={working || !selected.mimeType.startsWith("image/")} onClick={() => void queueGeneration()}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Send to 3D pipeline</Button></div>
                  <p className="text-[10px] text-muted-foreground">GUI registration is scoped to the current browser profile. Server assets remain scoped to the authenticated workspace owner. Unverified or restricted assets cannot be auto-published to production.</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function loadGuiAssets(): ExternalAssetRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUI_ASSETS_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed as ExternalAssetRecord[] : [];
  } catch {
    return [];
  }
}
