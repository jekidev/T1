import { BoardZone } from "@/lib/game";

export function ZoneRenderer({ zone, selected, onPointerDown }: { zone: BoardZone, selected: boolean, onPointerDown?: (e: React.PointerEvent) => void }) {
  const left = `${zone.x / 10}%`;
  const top = `${zone.y / 10}%`;
  const width = `${zone.width / 10}%`;
  const height = `${zone.height / 10}%`;

  // Provide some transparency to the user's selected hex color
  return (
    <div
      className={`absolute border-2 border-dashed ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-background z-40' : 'z-0'}`}
      style={{
        left,
        top,
        width,
        height,
        borderColor: zone.color,
        backgroundColor: `${zone.color}20`,
      }}
      onPointerDown={onPointerDown}
      data-zone-id={zone.id}
    >
      <div className="absolute top-0 left-0 bg-background/80 px-2 py-1 text-[10px] font-mono font-bold text-white border-b border-r border-white/20 backdrop-blur-sm uppercase">
        {zone.name}
      </div>
    </div>
  );
}