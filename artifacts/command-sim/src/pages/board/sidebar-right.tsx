import { useState } from "react";
import { useBoardStore } from "@/lib/game";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Eye, EyeOff, Lock, Unlock, Plus, Trash2, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function PropertiesSidebar() {
  const board = useBoardStore(s => s.board);
  const selectedIds = useBoardStore(s => s.selectedIds);
  const updateEntity = useBoardStore(s => s.updateEntity);
  const addLayer = useBoardStore(s => s.addLayer);
  const updateLayer = useBoardStore(s => s.updateLayer);
  const removeLayer = useBoardStore(s => s.removeLayer);
  const setNotes = useBoardStore(s => s.setNotes);
  const [uploading, setUploading] = useState(false);

  const selectedEntity = selectedIds.length === 1 ? board.entities.find(e => e.id === selectedIds[0]) : null;

  const uploadAvatar = async (file: File) => {
    if (!selectedEntity || selectedEntity.category !== "unit") return;
    setUploading(true);
    try {
      const response = await fetch("/api/asset-generation/sources", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": file.name },
        body: file,
      });
      const body = await response.json() as { source?: { id: string }; error?: string };
      if (!response.ok || !body.source) throw new Error(body.error ?? "Profile image upload failed.");
      updateEntity(selectedEntity.id, {
        profile: {
          personality: selectedEntity.profile?.personality ?? "Personality develops through player interaction and game events.",
          biography: selectedEntity.profile?.biography ?? selectedEntity.notes,
          traits: selectedEntity.profile?.traits ?? [],
          source: selectedEntity.profile?.source ?? "manual",
          avatarAssetId: body.source.id,
          avatarUrl: `/api/asset-generation/sources/${encodeURIComponent(body.source.id)}`,
        },
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[linear-gradient(145deg,hsl(var(--sidebar)),hsl(var(--background)))] border-l border-sidebar-border text-sidebar-foreground shadow-inner">
      <Tabs defaultValue="properties" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b border-sidebar-border bg-sidebar-primary/5 h-10 px-2 space-x-1">
          <TabsTrigger value="properties" className="text-xs data-[state=active]:bg-sidebar-accent">Properties</TabsTrigger>
          <TabsTrigger value="layers" className="text-xs data-[state=active]:bg-sidebar-accent">Layers</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs data-[state=active]:bg-sidebar-accent">Notes</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 p-4">
          <TabsContent value="properties" className="m-0 space-y-4">
            {selectedEntity ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {selectedEntity.category === "unit" ? <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-muted shadow-md">{selectedEntity.profile?.avatarUrl ? <img src={selectedEntity.profile.avatarUrl} alt={selectedEntity.label} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><UserRound className="h-6 w-6 text-muted-foreground" /></div>}</div> : null}
                  <div><h3 className="text-sm font-semibold mb-1">{selectedEntity.label}</h3><div className="text-xs text-muted-foreground uppercase font-mono tracking-wider">{selectedEntity.category} • {selectedEntity.faction}</div></div>
                </div>

                {selectedEntity.category === "unit" && <div className="space-y-3 rounded-lg border bg-background/55 p-3 shadow-inner">
                  <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Personal profile</Label><label className="inline-flex cursor-pointer items-center rounded-md border px-2 py-1 text-[10px] hover:bg-accent"><Upload className="mr-1 h-3 w-3" />{uploading ? "Uploading…" : "Profile image"}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.currentTarget.value = ""; }} /></label></div>
                  <div><Label className="text-[10px]">Personality</Label><Textarea className="min-h-16 text-xs" value={selectedEntity.profile?.personality ?? ""} onChange={event => updateEntity(selectedEntity.id, { profile: { personality: event.target.value, biography: selectedEntity.profile?.biography ?? "", traits: selectedEntity.profile?.traits ?? [], source: selectedEntity.profile?.source ?? "manual", ...(selectedEntity.profile?.avatarAssetId ? { avatarAssetId: selectedEntity.profile.avatarAssetId } : {}), ...(selectedEntity.profile?.avatarUrl ? { avatarUrl: selectedEntity.profile.avatarUrl } : {}) } })} placeholder="Temperament, values, communication style, goals…" /></div>
                  <div><Label className="text-[10px]">Biography</Label><Textarea className="min-h-16 text-xs" value={selectedEntity.profile?.biography ?? ""} onChange={event => updateEntity(selectedEntity.id, { profile: { personality: selectedEntity.profile?.personality ?? "", biography: event.target.value, traits: selectedEntity.profile?.traits ?? [], source: selectedEntity.profile?.source ?? "manual", ...(selectedEntity.profile?.avatarAssetId ? { avatarAssetId: selectedEntity.profile.avatarAssetId } : {}), ...(selectedEntity.profile?.avatarUrl ? { avatarUrl: selectedEntity.profile.avatarUrl } : {}) } })} /></div>
                  <div><Label className="text-[10px]">Traits (comma separated)</Label><Input className="h-7 text-xs" value={(selectedEntity.profile?.traits ?? []).join(", ")} onChange={event => updateEntity(selectedEntity.id, { profile: { personality: selectedEntity.profile?.personality ?? "", biography: selectedEntity.profile?.biography ?? "", traits: event.target.value.split(",").map(value => value.trim()).filter(Boolean).slice(0, 30), source: selectedEntity.profile?.source ?? "manual", ...(selectedEntity.profile?.avatarAssetId ? { avatarAssetId: selectedEntity.profile.avatarAssetId } : {}), ...(selectedEntity.profile?.avatarUrl ? { avatarUrl: selectedEntity.profile.avatarUrl } : {}) } })} /></div>
                </div>}

                <div className="space-y-3">
                  <div className="grid gap-1.5"><Label className="text-xs">Custom Label</Label><Input className="h-7 text-xs bg-background/50" value={selectedEntity.label} onChange={e => updateEntity(selectedEntity.id, { label: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Notes</Label><Textarea className="text-xs min-h-[60px] bg-background/50" value={selectedEntity.notes} onChange={e => updateEntity(selectedEntity.id, { notes: e.target.value })} placeholder="Operational notes..." /></div>

                  <div className="border-t border-sidebar-border/50 pt-3 space-y-3"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Transform</Label><div className="grid grid-cols-2 gap-2"><div className="grid gap-1"><Label className="text-[10px]">Rotation</Label><Input type="number" className="h-7 text-xs" value={selectedEntity.rotation} onChange={e => updateEntity(selectedEntity.id, { rotation: Number(e.target.value) })} /></div><div className="grid gap-1"><Label className="text-[10px]">Scale</Label><Input type="number" step="0.1" className="h-7 text-xs" value={selectedEntity.scale} onChange={e => updateEntity(selectedEntity.id, { scale: Number(e.target.value) })} /></div></div></div>

                  <div className="border-t border-sidebar-border/50 pt-3 space-y-3"><Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Attributes</Label>{Object.entries(selectedEntity.attributes).map(([key, val]) => { if (val === 0 && key !== "legalAuthority") return null; return <div key={key} className="space-y-1.5"><div className="flex justify-between"><Label className="text-[10px] capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</Label><span className="text-[10px] text-muted-foreground font-mono">{val}</span></div><Slider value={[val as number]} max={100} step={5} onValueChange={([v]) => updateEntity(selectedEntity.id, { attributes: { ...selectedEntity.attributes, [key]: v } })} /></div>; })}</div>
                </div>
              </div>
            ) : selectedIds.length > 1 ? <div className="text-center py-10"><p className="text-sm text-muted-foreground">{selectedIds.length} entities selected.</p><p className="text-xs text-muted-foreground mt-1">Select a single entity to edit properties.</p></div> : <div className="text-center py-10"><p className="text-sm text-muted-foreground">No selection.</p><p className="text-xs text-muted-foreground mt-1">Click an entity or zone on the board to view its properties.</p></div>}
          </TabsContent>

          <TabsContent value="layers" className="m-0 space-y-4"><div className="flex justify-between items-center mb-2"><Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Map Layers</Label><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => addLayer("New Layer")}><Plus className="h-3 w-3" /></Button></div><div className="space-y-1">{[...board.layers].sort((a, b) => b.order - a.order).map(layer => <div key={layer.id} className="flex items-center gap-2 p-2 border border-sidebar-border/50 rounded-md bg-sidebar-accent/10 hover:bg-sidebar-accent/20 shadow-inner"><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => updateLayer(layer.id, { visible: !layer.visible })}>{layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}</Button><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => updateLayer(layer.id, { locked: !layer.locked })}>{layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}</Button><Input className="h-6 text-xs border-transparent bg-transparent hover:border-input focus-visible:bg-background px-1" value={layer.name} onChange={e => updateLayer(layer.id, { name: e.target.value })} />{board.layers.length > 1 && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeLayer(layer.id)}><Trash2 className="h-3 w-3" /></Button>}</div>)}</div></TabsContent>

          <TabsContent value="notes" className="m-0 space-y-4 flex flex-col h-full"><Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-2">Scenario Notes</Label><Textarea className="flex-1 min-h-[300px] text-sm bg-background/50 font-mono resize-none" value={board.notes} onChange={e => setNotes(e.target.value)} placeholder="Overall scenario description, objectives, or briefing materials..." /></TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
