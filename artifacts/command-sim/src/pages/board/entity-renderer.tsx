import { BoardEntity, EntityTemplate } from "@/lib/game";
import { getEntityTemplate } from "@/lib/game";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, AlertTriangle, Users, MapPin, Package, Eye, Radio, Zap } from "lucide-react";

export function EntityIcon({ category, faction, className }: { category: string, faction: string, className?: string }) {
  let Icon = Package;
  switch(category) {
    case 'unit': Icon = Shield; break;
    case 'civilian': Icon = Users; break;
    case 'location': Icon = MapPin; break;
    case 'surveillance': Icon = Eye; break;
    case 'vehicle': Icon = Zap; break;
    case 'event': Icon = Radio; break;
  }
  return <Icon className={className} />;
}

interface RenderedEntityProps {
  entity: BoardEntity;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}

export function RenderedEntity({ entity, selected, onPointerDown }: RenderedEntityProps) {
  const template = getEntityTemplate(entity.templateId);
  if (!template) return null;

  // Convert 0-1000 to percentages
  const left = `${entity.x / 10}%`;
  const top = `${entity.y / 10}%`;
  
  // Visuals based on faction
  let colorClass = "border-zinc-500 bg-zinc-800 text-zinc-300";
  if (entity.faction === "police") colorClass = "border-faction-police bg-faction-police/20 text-blue-100 shadow-[0_0_10px_rgba(0,100,255,0.2)]";
  if (entity.faction === "criminal") colorClass = "border-faction-criminal bg-faction-criminal/20 text-red-100 shadow-[0_0_10px_rgba(255,0,0,0.2)]";
  if (entity.faction === "neutral") colorClass = "border-faction-neutral bg-faction-neutral/20 text-amber-100";

  return (
    <div
      className={`absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing hover-elevate touch-none ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-background z-50' : 'z-10'}`}
      style={{
        left,
        top,
        transform: `translate(-50%, -50%) rotate(${entity.rotation}deg) scale(${entity.scale})`,
        zIndex: entity.zIndex + (selected ? 100 : 0)
      }}
      onPointerDown={onPointerDown}
      data-entity-id={entity.id}
    >
      <div className={`w-8 h-8 rounded flex items-center justify-center border-2 backdrop-blur-sm ${colorClass}`}>
        <EntityIcon category={entity.category} faction={entity.faction} className="w-4 h-4" />
      </div>
      <div className="mt-1 bg-background/80 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap border border-white/10 text-white shadow-sm pointer-events-none backdrop-blur-sm">
        {entity.label}
      </div>
      {entity.attributes.risk > 70 && (
        <div className="absolute -top-2 -right-2 text-destructive bg-background rounded-full">
          <AlertTriangle className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}