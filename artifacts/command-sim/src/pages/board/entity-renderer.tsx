import { useState } from "react";
import type { BoardEntity } from "@/lib/game";
import { getEntityTemplate } from "@/lib/game";
import { Shield, AlertTriangle, Users, MapPin, Package, Eye, Radio, Zap } from "lucide-react";

export function EntityIcon({ category, className }: { category: string; className?: string }) {
  let Icon = Package;
  switch (category) {
    case "unit": Icon = Shield; break;
    case "civilian": Icon = Users; break;
    case "location": Icon = MapPin; break;
    case "surveillance": Icon = Eye; break;
    case "vehicle": Icon = Zap; break;
    case "event": Icon = Radio; break;
  }
  return <Icon className={className} />;
}

interface RenderedEntityProps {
  entity: BoardEntity;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function RenderedEntity({ entity, selected, onPointerDown }: RenderedEntityProps) {
  const [hovered, setHovered] = useState(false);
  const template = getEntityTemplate(entity.templateId);
  if (!template) return null;

  const left = `${entity.x / 10}%`;
  const top = `${entity.y / 10}%`;
  const isPerson = entity.category === "unit" || entity.category === "civilian";
  const accent = entity.profile?.accent ?? factionAccent(entity.faction);
  const active = selected || hovered;

  return (
    <div
      className={`absolute flex touch-none select-none flex-col items-center justify-center transition-[filter,opacity] duration-150 ${active ? "z-50 drop-shadow-[0_0_12px_rgba(255,255,255,0.36)]" : "z-10"} ${selected ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        left,
        top,
        transform: `translate(-50%, -50%) rotate(${entity.rotation}deg) scale(${entity.scale * (hovered && !selected ? 1.08 : 1)})`,
        zIndex: entity.zIndex + (active ? 100 : 0),
      }}
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      data-entity-id={entity.id}
      title={`${entity.label}${entity.profile?.role ? ` · ${entity.profile.role}` : ""}`}
      role="button"
      aria-pressed={selected}
      aria-label={`Select ${entity.label}`}
    >
      {(selected || hovered) && (
        <div
          className="pointer-events-none absolute h-12 w-12 rounded-full border opacity-80 blur-[0.2px]"
          style={{ borderColor: accent, boxShadow: `0 0 18px ${accent}88, inset 0 0 12px ${accent}35` }}
        />
      )}

      <div
        className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border-2 bg-background/80 text-foreground backdrop-blur-sm transition-all duration-150"
        style={{
          borderColor: accent,
          boxShadow: active ? `0 0 16px ${accent}80, inset 0 0 12px ${accent}25` : `0 5px 12px rgba(0,0,0,0.28)`,
        }}
      >
        {isPerson && entity.profile?.avatarUrl ? (
          <img src={entity.profile.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <EntityIcon category={entity.category} className="h-4 w-4" />
        )}

        {isPerson && entity.profile?.status && entity.profile.status !== "unknown" && (
          <span
            className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-background ${statusClass(entity.profile.status)}`}
            aria-label={entity.profile.status}
          />
        )}
      </div>

      <div className="pointer-events-none mt-1 max-w-36 truncate rounded-md border border-white/10 bg-background/85 px-1.5 py-0.5 font-mono text-[9px] text-white shadow-sm backdrop-blur-sm">
        {entity.label}
        {hovered && entity.profile?.role ? <span className="ml-1 text-muted-foreground">· {entity.profile.role}</span> : null}
      </div>

      {entity.attributes.risk > 70 && (
        <div className="absolute -right-2 -top-2 rounded-full bg-background text-destructive shadow-md">
          <AlertTriangle className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

function factionAccent(faction: BoardEntity["faction"]): string {
  if (faction === "police") return "#4f8cff";
  if (faction === "criminal") return "#ff5c6c";
  return "#f4b860";
}

function statusClass(status: NonNullable<BoardEntity["profile"]>["status"]): string {
  if (status === "online") return "bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.9)]";
  if (status === "busy") return "bg-amber-400 shadow-[0_0_7px_rgba(251,191,36,0.8)]";
  return "bg-slate-500";
}
