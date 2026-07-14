import { MapShape } from "@/lib/game/mapTemplates";

export function MapShapeRenderer({ shape }: { shape: MapShape }) {
  let style: React.CSSProperties = { position: "absolute" };
  let className = "";

  switch (shape.category) {
    case "water":
      className = "bg-sky-950/40 border border-sky-900/30";
      break;
    case "road":
      className = "bg-zinc-800 border-x border-zinc-700/50";
      break;
    case "rail":
      className = "bg-zinc-800/80 border border-zinc-700 repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 12px)";
      break;
    case "block":
      className = "bg-zinc-900/80 border border-zinc-800";
      break;
    case "park":
      className = "bg-emerald-950/30 border border-emerald-900/40";
      break;
    case "landmark":
      className = "bg-zinc-800 border border-zinc-600/50 shadow-sm";
      break;
  }

  if (shape.points) {
    // Render as an SVG polygon
    const minX = Math.min(...shape.points.map(p => p[0]));
    const minY = Math.min(...shape.points.map(p => p[1]));
    const maxX = Math.max(...shape.points.map(p => p[0]));
    const maxY = Math.max(...shape.points.map(p => p[1]));
    const w = maxX - minX;
    const h = maxY - minY;
    
    return (
      <div 
        style={{ left: minX, top: minY, width: w, height: h, position: 'absolute' }}
        className="pointer-events-none"
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <polygon 
            points={shape.points.map(p => `${p[0] - minX},${p[1] - minY}`).join(' ')}
            className={`fill-current stroke-current ${className.replace('bg-', 'text-').replace('border-', 'stroke-')}`}
          />
        </svg>
        {shape.label && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <span className="text-[10px] font-mono tracking-widest text-white whitespace-nowrap bg-background/50 px-1 rounded">{shape.label}</span>
          </div>
        )}
      </div>
    );
  }

  style.left = `${shape.x}%`;
  style.top = `${shape.y}%`;
  style.width = `${shape.width}%`;
  style.height = `${shape.height}%`;
  // Using percentage logic? Wait, coordinates are 0-1000. So divide by 10 for %.
  style.left = `${(shape.x || 0) / 10}%`;
  style.top = `${(shape.y || 0) / 10}%`;
  style.width = `${(shape.width || 0) / 10}%`;
  style.height = `${(shape.height || 0) / 10}%`;

  return (
    <div style={style} className={className}>
      {shape.label && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 overflow-hidden">
          <span className="text-[10px] font-mono tracking-widest text-white whitespace-nowrap bg-background/50 px-1 rounded">{shape.label}</span>
        </div>
      )}
    </div>
  );
}