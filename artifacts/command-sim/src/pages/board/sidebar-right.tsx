import { useBoardStore } from "@/lib/game";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PersonProfileEditor } from "./person-profile-editor";
import { SceneEnvironmentPanel } from "./scene-environment-panel";

export function PropertiesSidebar() {
  const board = useBoardStore(state => state.board);
  const selectedIds = useBoardStore(state => state.selectedIds);
  const updateEntity = useBoardStore(state => state.updateEntity);
  const addLayer = useBoardStore(state => state.addLayer);
  const updateLayer = useBoardStore(state => state.updateLayer);
  const removeLayer = useBoardStore(state => state.removeLayer);
  const setNotes = useBoardStore(state => state.setNotes);

  const selectedEntity = selectedIds.length === 1
    ? board.entities.find(entity => entity.id === selectedIds[0])
    : null;

  return (
    <div className="flex h-full w-full flex-col border-l border-sidebar-border bg-[linear-gradient(145deg,hsl(var(--sidebar)),hsl(var(--background)))] text-sidebar-foreground shadow-inner">
      <Tabs defaultValue="properties" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="h-10 w-full justify-start space-x-1 rounded-none border-b border-sidebar-border bg-sidebar-primary/5 px-2">
          <TabsTrigger value="properties" className="text-xs data-[state=active]:bg-sidebar-accent">Profile</TabsTrigger>
          <TabsTrigger value="scene" className="text-xs data-[state=active]:bg-sidebar-accent">Scene</TabsTrigger>
          <TabsTrigger value="layers" className="text-xs data-[state=active]:bg-sidebar-accent">Layers</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs data-[state=active]:bg-sidebar-accent">Notes</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 p-4">
          <TabsContent value="properties" className="m-0 space-y-4">
            {selectedEntity ? (
              <div className="space-y-4">
                {selectedEntity.category === "unit" || selectedEntity.category === "civilian" ? (
                  <PersonProfileEditor
                    entity={selectedEntity}
                    onUpdate={patch => updateEntity(selectedEntity.id, patch)}
                  />
                ) : (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">{selectedEntity.label}</h3>
                    <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      {selectedEntity.category} · {selectedEntity.faction}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Custom label</Label>
                    <Input
                      className="h-8 bg-background/50 text-xs"
                      value={selectedEntity.label}
                      onChange={event => updateEntity(selectedEntity.id, { label: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      className="min-h-[60px] bg-background/50 text-xs"
                      value={selectedEntity.notes}
                      onChange={event => updateEntity(selectedEntity.id, { notes: event.target.value })}
                      placeholder="Operational or narrative notes…"
                    />
                  </div>

                  <div className="space-y-3 border-t border-sidebar-border/50 pt-3">
                    <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Transform</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1">
                        <Label className="text-[10px]">Rotation</Label>
                        <Input type="number" className="h-8 text-xs" value={selectedEntity.rotation} onChange={event => updateEntity(selectedEntity.id, { rotation: Number(event.target.value) })} />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px]">Scale</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={selectedEntity.scale} onChange={event => updateEntity(selectedEntity.id, { scale: Number(event.target.value) })} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-sidebar-border/50 pt-3">
                    <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attributes</Label>
                    {Object.entries(selectedEntity.attributes).map(([key, value]) => {
                      if (value === 0 && key !== "legalAuthority") return null;
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex justify-between">
                            <Label className="text-[10px] capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</Label>
                            <span className="font-mono text-[10px] text-muted-foreground">{value}</span>
                          </div>
                          <Slider
                            value={[value]}
                            max={100}
                            step={5}
                            onValueChange={([next]) => updateEntity(selectedEntity.id, {
                              attributes: { ...selectedEntity.attributes, [key]: next },
                            })}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : selectedIds.length > 1 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">{selectedIds.length} entities selected.</p>
                <p className="mt-1 text-xs text-muted-foreground">Select one person or entity to open its profile.</p>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No selection.</p>
                <p className="mt-1 text-xs text-muted-foreground">Click or tap a person on the board to highlight it and open its profile.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scene" className="m-0">
            <SceneEnvironmentPanel />
          </TabsContent>

          <TabsContent value="layers" className="m-0 space-y-4">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Map layers</Label>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addLayer("New Layer")}><Plus className="h-3 w-3" /></Button>
            </div>
            <div className="space-y-1">
              {[...board.layers].sort((a, b) => b.order - a.order).map(layer => (
                <div key={layer.id} className="flex items-center gap-2 rounded-md border border-sidebar-border/50 bg-sidebar-accent/10 p-2 shadow-inner hover:bg-sidebar-accent/20">
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => updateLayer(layer.id, { visible: !layer.visible })}>
                    {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => updateLayer(layer.id, { locked: !layer.locked })}>
                    {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                  <Input className="h-7 border-transparent bg-transparent px-1 text-xs hover:border-input focus-visible:bg-background" value={layer.name} onChange={event => updateLayer(layer.id, { name: event.target.value })} />
                  {board.layers.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeLayer(layer.id)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="m-0 flex h-full flex-col space-y-4">
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scenario notes</Label>
            <Textarea
              className="min-h-[300px] flex-1 resize-none bg-background/50 font-mono text-sm"
              value={board.notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Overall scenario description, objectives, or briefing materials…"
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
