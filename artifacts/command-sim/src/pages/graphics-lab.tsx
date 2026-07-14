import { useState } from "react";
import { Link } from "wouter";
import { PrimaryGameScene } from "@/game/scenes/PrimaryGameScene";
import { GRAPHICS_PRESETS, type GraphicsQuality } from "@/config/graphics";
import { useGraphicsStore } from "@/state/useGraphicsStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bug, MonitorCog } from "lucide-react";

export default function GraphicsLabPage() {
  const quality = useGraphicsStore((state) => state.quality);
  const setQuality = useGraphicsStore((state) => state.setQuality);
  const autoQuality = useGraphicsStore((state) => state.autoQuality);
  const setAutoQuality = useGraphicsStore((state) => state.setAutoQuality);
  const capabilities = useGraphicsStore((state) => state.capabilities);
  const averageFps = useGraphicsStore((state) => state.averageFps);
  const [debugPhysics, setDebugPhysics] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-3">
        <div className="flex items-center gap-2">
          <Link href="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <div className="text-sm font-semibold">Three.js Graphics Lab</div>
            <div className="text-[10px] text-muted-foreground">Isolated production-stack validation scene</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">WebGL2 {capabilities?.webgl2 ? "yes" : "checking"}</Badge>
          <Badge variant="outline">WebGPU {capabilities?.webgpu ? "yes" : "no"}</Badge>
          {averageFps !== null && <Badge variant="outline">FPS {Math.round(averageFps)}</Badge>}
          <Button variant={debugPhysics ? "default" : "outline"} size="sm" onClick={() => setDebugPhysics(value => !value)}><Bug className="mr-1 h-3 w-3" />Physics</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 space-y-3 overflow-auto border-r bg-card p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><MonitorCog className="h-4 w-4" />Graphics quality</div>
          <Button variant={autoQuality ? "default" : "outline"} className="w-full justify-start" size="sm" onClick={() => setAutoQuality(!autoQuality)}>Automatic recommendation</Button>
          <div className="space-y-1">
            {(Object.keys(GRAPHICS_PRESETS) as GraphicsQuality[]).map(level => (
              <Button key={level} variant={!autoQuality && quality === level ? "default" : "outline"} className="w-full justify-start capitalize" size="sm" onClick={() => setQuality(level)}>{level}</Button>
            ))}
          </div>
          <div className="rounded border p-2 text-[10px] text-muted-foreground">
            <div>DPR: {GRAPHICS_PRESETS[quality].maxDpr}</div>
            <div>Shadow map: {GRAPHICS_PRESETS[quality].shadowMapSize}</div>
            <div>Draw distance: {GRAPHICS_PRESETS[quality].drawDistance}</div>
            <div>Post-processing: {GRAPHICS_PRESETS[quality].postProcessing.enabled ? "on" : "off"}</div>
          </div>
          <div className="text-[10px] text-muted-foreground">WASD/arrow keys move the Rapier body. Space jumps. Shift sprints. Orbit with mouse or touch.</div>
        </aside>
        <main className="relative min-w-0 flex-1"><PrimaryGameScene debugPhysics={debugPhysics} /></main>
      </div>
    </div>
  );
}
