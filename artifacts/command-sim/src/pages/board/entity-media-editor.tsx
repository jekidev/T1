import { useEffect, useState } from "react";
import type { BoardEntity, EntityMediaReference } from "@/lib/game";
import {
  WORKSPACE_UPDATED_EVENT,
  loadWorkspaceState,
  type UserWorkspaceState,
  type WorkspaceAsset,
} from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, Trash2, Video } from "lucide-react";

export function EntityMediaEditor({
  entity,
  onUpdate,
}: {
  entity: BoardEntity;
  onUpdate: (patch: Partial<BoardEntity>) => void;
}) {
  const [assets, setAssets] = useState<WorkspaceAsset[]>(() => loadWorkspaceState().assets);
  const [selectedId, setSelectedId] = useState(entity.media?.assetId ?? "");

  useEffect(() => {
    setSelectedId(entity.media?.assetId ?? "");
  }, [entity.id, entity.media?.assetId]);

  useEffect(() => {
    const refresh = (event?: Event) => {
      const custom = event as CustomEvent<UserWorkspaceState> | undefined;
      setAssets(custom?.detail?.assets ?? loadWorkspaceState().assets);
    };
    window.addEventListener(WORKSPACE_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(WORKSPACE_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const applyAsset = () => {
    const asset = assets.find(item => item.id === selectedId);
    if (!asset) return;
    onUpdate({ media: toMedia(asset, entity.media?.caption) });
  };

  return (
    <section className="space-y-3 rounded-xl border bg-[linear-gradient(145deg,hsl(var(--background)/0.88),hsl(var(--muted)/0.3))] p-3 shadow-inner">
      <div className="flex items-center gap-2 text-xs font-semibold">
        {entity.media?.mimeType.startsWith("video/") ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
        Entity media
      </div>

      {entity.media ? (
        <div className="overflow-hidden rounded-lg border bg-black/30 shadow-lg">
          <div className="aspect-video">
            {entity.media.mimeType.startsWith("image/")
              ? <img src={entity.media.url} alt={entity.media.caption || entity.label} className="h-full w-full object-cover" />
              : entity.media.mimeType.startsWith("video/")
                ? <video src={entity.media.url} controls preload="metadata" className="h-full w-full object-cover" />
                : <div className="grid h-full place-items-center text-xs text-muted-foreground">Unsupported preview type</div>}
          </div>
          <div className="space-y-1 p-2 text-[9px] text-muted-foreground">
            <div className="truncate">{entity.media.assetId} · {entity.media.origin}</div>
            <div>{entity.media.mimeType}</div>
          </div>
        </div>
      ) : <div className="rounded-lg border border-dashed p-4 text-center text-[10px] text-muted-foreground">No image or video is attached.</div>}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={assets.length ? "Select account asset" : "No synchronized assets"} /></SelectTrigger>
          <SelectContent>{assets.map(asset => <SelectItem key={asset.id} value={asset.id}>{asset.name} · {asset.origin}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" className="h-8" disabled={!selectedId} onClick={applyAsset}>Attach</Button>
      </div>

      {entity.media && (
        <div className="space-y-1">
          <Label className="text-[10px]">Caption</Label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              className="h-8 text-xs"
              value={entity.media.caption ?? ""}
              maxLength={500}
              onChange={event => onUpdate({ media: { ...entity.media!, caption: event.target.value } })}
              placeholder="Optional board caption"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onUpdate({ media: undefined })}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}
    </section>
  );
}

function toMedia(asset: WorkspaceAsset, caption?: string): EntityMediaReference {
  return {
    assetId: asset.id,
    sourceId: asset.sourceId,
    url: asset.sourceUrl,
    mimeType: asset.mimeType,
    origin: asset.origin,
    ...(caption?.trim() ? { caption: caption.trim().slice(0, 500) } : {}),
  };
}
