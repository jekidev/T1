import type { BoardState, PlayerTurnAction } from "@/lib/game";
import type { BoardBlackmailAction } from "@/lib/strategy/boardStrategyBridge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandCanvas } from "./canvas";
import { WorldMapUnderlay } from "./world-map-underlay";
import { PaletteSidebar } from "./sidebar-left";
import { PropertiesSidebar } from "./sidebar-right";
import { SimulationPanel } from "./simulation-panel";
import { ScoringPanel } from "./scoring-panel";
import { AdvisorWorkspaceShell } from "./advisor-workspace-shell";
import { Bot, Boxes, Map, Play, SlidersHorizontal, Target } from "lucide-react";

interface MobileBoardWorkspaceProps {
  board: BoardState;
  mapInteractive: boolean;
  onResolve: (action: PlayerTurnAction) => void;
  onBlackmail: (action: BoardBlackmailAction) => void;
}

export function MobileBoardWorkspace({
  board,
  mapInteractive,
  onResolve,
  onBlackmail,
}: MobileBoardWorkspaceProps) {
  return (
    <Tabs defaultValue="board" className="flex h-full min-h-0 flex-col bg-background lg:hidden">
      <div className="overflow-x-auto border-b bg-card/95 px-1 py-1 shadow-sm backdrop-blur">
        <TabsList className="grid h-11 min-w-[480px] grid-cols-6 bg-muted/45">
          <MobileTab value="board" icon={Map} label="Board" />
          <MobileTab value="add" icon={Boxes} label="Add" />
          <MobileTab value="profile" icon={SlidersHorizontal} label="Profile" />
          <MobileTab value="play" icon={Play} label="Play" />
          <MobileTab value="score" icon={Target} label="Score" />
          <MobileTab value="ai" icon={Bot} label="AI" />
        </TabsList>
      </div>

      <TabsContent value="board" className="relative m-0 min-h-0 flex-1 data-[state=inactive]:hidden">
        <WorldMapUnderlay interactive={mapInteractive} />
        <div className={`absolute inset-0 z-10 ${mapInteractive ? "pointer-events-none opacity-25" : ""}`}>
          <CommandCanvas mapTemplateId={board.mapTemplateId} />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/85 px-3 py-1.5 text-[10px] text-muted-foreground shadow-lg backdrop-blur">
          Tap a person to highlight and open Profile
        </div>
      </TabsContent>

      <TabsContent value="add" className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <PaletteSidebar />
      </TabsContent>
      <TabsContent value="profile" className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <PropertiesSidebar />
      </TabsContent>
      <TabsContent value="play" className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <SimulationPanel board={board} onResolve={onResolve} onBlackmail={onBlackmail} />
      </TabsContent>
      <TabsContent value="score" className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <ScoringPanel />
      </TabsContent>
      <TabsContent value="ai" className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
        <AdvisorWorkspaceShell />
      </TabsContent>
    </Tabs>
  );
}

function MobileTab({ value, icon: Icon, label }: { value: string; icon: typeof Map; label: string }) {
  return (
    <TabsTrigger value={value} className="flex h-9 gap-1 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </TabsTrigger>
  );
}
