import { useLocation, useParams } from "wouter";
import { useEffect, useState } from "react";
import { applyDanishSyndicatePreset } from "@workspace/strategy-sim";
import {
  getGetScenarioQueryKey,
  getGetTutorialScenarioQueryKey,
  useGetScenario,
  useGetTutorialScenario,
  useUpdateScenario,
} from "@workspace/api-client-react";
import {
  applyTeamDynamicsEvent,
  readAutosaveTimestamp,
  simulateTurn,
  useBoardStore,
  type BoardState,
  type PlayerTurnAction,
  type TeamSide,
} from "@/lib/game";
import {
  advanceBoardStrategy,
  runBoardBlackmailAction,
  type BoardBlackmailAction,
} from "@/lib/strategy/boardStrategyBridge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CommandCanvas } from "./canvas";
import { PaletteSidebar } from "./sidebar-left";
import { PropertiesSidebar } from "./sidebar-right";
import { ScoringPanel } from "./scoring-panel";
import { SimulationPanel } from "./simulation-panel";
import { AdvisorWorkspaceShell } from "./advisor-workspace-shell";
import { DeveloperAiPanel } from "./developer-ai-panel";
import { WorldMapUnderlay } from "./world-map-underlay";
import { WorldSetupPanel } from "./world-setup-panel";
import { GuidedTutorial } from "./guided-tutorial";
import { SyndicateDashboard } from "./syndicate-dashboard";
import { FamilyTreePanel } from "./family-tree-panel";
import { MobileBoardWorkspace } from "./mobile-board-workspace";
import { saveWorldConfig } from "@/lib/world-config";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BarChart3,
  CircleHelp,
  Clock,
  Code2,
  Download,
  Layers3,
  Loader2,
  Map as MapIcon,
  MapPin,
  Network,
  PanelsTopLeft,
  Save,
  UsersRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function BoardPage() {
  const params = useParams();
  const id = params.id;
  const isTutorial = id === "tutorial";
  const scenarioId = isTutorial ? null : parseInt(id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const scenarioQuery = useGetScenario(scenarioId!, {
    query: {
      enabled: !isTutorial && !!scenarioId,
      queryKey: getGetScenarioQueryKey(scenarioId!),
    },
  });
  const tutorialQuery = useGetTutorialScenario({
    query: {
      enabled: isTutorial,
      queryKey: getGetTutorialScenarioQueryKey(),
    },
  });
  const updateMutation = useUpdateScenario();
  const { loadBoard, board, scenarioName, scenarioDescription } = useBoardStore();
  const [initializedId, setInitializedId] = useState<string | null>(null);
  const [autosaveTime, setAutosaveTime] = useState<string | null>(readAutosaveTimestamp());
  const [developerPanelOpen, setDeveloperPanelOpen] = useState(false);
  const [worldSetupOpen, setWorldSetupOpen] = useState(false);
  const [syndicateOpen, setSyndicateOpen] = useState(false);
  const [familyTreeOpen, setFamilyTreeOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);

  useEffect(() => {
    const data = isTutorial ? tutorialQuery.data : scenarioQuery.data;
    if (data && initializedId !== id) {
      loadBoard(data.board as never, data.id, data.name, data.description || "");
      const loadedBoard = data.board as { world?: Record<string, unknown> };
      if (loadedBoard.world) {
        saveWorldConfig({
          ...loadedBoard.world,
          supplierCountry: loadedBoard.world.country,
          workAreaLabel: `${loadedBoard.world.city} og omegn`,
        } as never);
      }
      setInitializedId(id!);
      if (
        isTutorial
        || localStorage.getItem(`tutorial-pending-${data.id}`) === "1"
        || localStorage.getItem("operation-kobenhavn-tutorial-complete") !== "1"
      ) {
        setTutorialOpen(true);
      }
    }
  }, [scenarioQuery.data, tutorialQuery.data, id, initializedId, isTutorial, loadBoard]);

  useEffect(() => {
    const interval = setInterval(() => setAutosaveTime(readAutosaveTimestamp()), 10_000);
    return () => clearInterval(interval);
  }, []);

  const closeTutorial = () => {
    setTutorialOpen(false);
    localStorage.setItem("operation-kobenhavn-tutorial-complete", "1");
    if (scenarioId) localStorage.removeItem(`tutorial-pending-${scenarioId}`);
  };

  const resolveTurn = (action: PlayerTurnAction) => {
    const result = simulateTurn(board, action);
    const advancedBoard = advanceBoardStrategy(result.board);
    loadBoard(advancedBoard, scenarioId, scenarioName, scenarioDescription);
    toast({ title: `Turn ${advancedBoard.simulation?.turn ?? ""} resolved`, description: result.summary });
  };

  const resolveBlackmail = (action: BoardBlackmailAction) => {
    const result = runBoardBlackmailAction(board, action);
    let resolvedBoard = result.board;
    const simulation = resolvedBoard.simulation;
    if (result.accepted && simulation) {
      const actor = simulation.factions.find(faction => faction.id === action.actorFactionId);
      const side: TeamSide = actor?.faction === "police" ? "blue" : "red";
      const success = /succeeded|lykkedes/i.test(result.message);
      const failed = /failed|mislykkedes/i.test(result.message);
      const effect = action.type === "gather"
        ? { spectrumDelta: -0.5, karmaDelta: -0.5, riskDelta: 2, moraleDelta: 0.5, reason: "Gathering leverage increased exposure and created a small ethical cost." }
        : success
          ? { spectrumDelta: -4, karmaDelta: -3, riskDelta: 5, moraleDelta: 2, reason: "A successful coercive action increased short-term morale while lowering moral alignment and increasing exposure." }
          : failed
            ? { spectrumDelta: -2, karmaDelta: -2, riskDelta: 8, moraleDelta: -4, reason: "A failed coercive action damaged collective morale and sharply increased risk." }
            : { spectrumDelta: -2, karmaDelta: -2, riskDelta: 5, moraleDelta: -1, reason: "The coercive action carried moral and operational costs." };
      resolvedBoard = {
        ...resolvedBoard,
        simulation: {
          ...simulation,
          teamDynamics: applyTeamDynamicsEvent(simulation, {
            side,
            source: "blackmail",
            ...effect,
          }),
        },
      };
    }
    if (resolvedBoard !== board) loadBoard(resolvedBoard, scenarioId, scenarioName, scenarioDescription);
    toast({
      title: result.accepted ? "In-game blackmail resolved" : "Blackmail command rejected",
      description: result.message,
      ...(result.accepted ? {} : { variant: "destructive" as const }),
    });
  };

  const handleSyndicateChange = (next: BoardState) => {
    const world = next.simulation?.syndicateWorld;
    if (!world) {
      loadBoard(next, scenarioId, scenarioName, scenarioDescription);
      return;
    }
    loadBoard({
      ...next,
      simulation: {
        ...next.simulation!,
        syndicateWorld: {
          ...world,
          syndicates: world.syndicates.map(applyDanishSyndicatePreset),
        },
      },
    }, scenarioId, scenarioName, scenarioDescription);
  };

  const handleSave = async () => {
    if (isTutorial || !scenarioId) {
      toast({ title: "Cannot save tutorial directly" });
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: scenarioId, data: { board: board as never } });
      toast({ title: "Scenario saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `operation-${scenarioName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if ((!isTutorial && scenarioQuery.isLoading) || (isTutorial && tutorialQuery.isLoading)) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!isTutorial && scenarioQuery.isError) {
    return <div className="flex h-screen flex-col items-center justify-center gap-4"><div className="font-bold text-destructive">Failed to load scenario</div><Button onClick={() => setLocation("/")}>Return home</Button></div>;
  }

  return (
    <div className="flex h-screen w-full select-text flex-col overflow-hidden bg-background">
      <header className="z-30 flex min-h-12 shrink-0 items-center gap-2 overflow-hidden border-b bg-card/95 px-2 shadow-md backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-[130px] shrink-0">
          <h1 className="max-w-48 truncate text-sm font-bold">{scenarioName}</h1>
          <span className="block max-w-56 truncate text-[9px] text-muted-foreground">
            {board.world ? `${board.world.city}, ${board.world.country}` : "European world"} · Boss · 0 start capital · Turn {board.simulation?.turn ?? 0}
          </span>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {autosaveTime && (
            <span className="hidden shrink-0 text-[10px] text-muted-foreground xl:inline">
              <Clock className="inline h-3 w-3" /> {formatDistanceToNow(new Date(autosaveTime))} ago
            </span>
          )}
          <HeaderButton active={mapInteractive} icon={mapInteractive ? Layers3 : MapIcon} label={mapInteractive ? "Board" : "Google map"} onClick={() => setMapInteractive(value => !value)} />
          <HeaderButton icon={PanelsTopLeft} label="Workspace" onClick={() => setLocation("/workspace")} />
          <HeaderButton icon={Network} label="Syndicate" onClick={() => setSyndicateOpen(true)} />
          <HeaderButton icon={UsersRound} label="Family Tree" onClick={() => setFamilyTreeOpen(true)} />
          <HeaderButton icon={CircleHelp} label="Guide" onClick={() => setTutorialOpen(true)} />
          <HeaderButton icon={MapPin} label="World" onClick={() => setWorldSetupOpen(true)} />
          <HeaderButton icon={BarChart3} label="Analytics" onClick={() => setLocation("/analytics")} />
          <HeaderButton active={developerPanelOpen} icon={Code2} label="Developer AI" onClick={() => setDeveloperPanelOpen(value => !value)} />
          <HeaderButton icon={Download} label="Export" onClick={handleExport} />
          {!isTutorial && <HeaderButton primary icon={Save} label="Save" onClick={() => void handleSave()} />}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {isDesktop ? (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={15} minSize={10}><PaletteSidebar /></ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={58}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={64}>
                  <div className="relative h-full">
                    <WorldMapUnderlay interactive={mapInteractive} />
                    <div className={`absolute inset-0 z-10 ${mapInteractive ? "pointer-events-none opacity-25" : ""}`}>
                      <CommandCanvas mapTemplateId={board.mapTemplateId} />
                    </div>
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={36} minSize={20}>
                  <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={50}><SimulationPanel board={board} onResolve={resolveTurn} onBlackmail={resolveBlackmail} /></ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={50}><ScoringPanel /></ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={27} minSize={18}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={40}><PropertiesSidebar /></ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={60}><AdvisorWorkspaceShell /></ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <MobileBoardWorkspace
            board={board}
            mapInteractive={mapInteractive}
            onResolve={resolveTurn}
            onBlackmail={resolveBlackmail}
          />
        )}
      </div>

      <DeveloperAiPanel open={developerPanelOpen} onClose={() => setDeveloperPanelOpen(false)} />
      <WorldSetupPanel open={worldSetupOpen} onClose={() => setWorldSetupOpen(false)} />
      <SyndicateDashboard open={syndicateOpen} board={board} onClose={() => setSyndicateOpen(false)} onChange={handleSyndicateChange} />
      <FamilyTreePanel open={familyTreeOpen} board={board} onClose={() => setFamilyTreeOpen(false)} onChange={handleSyndicateChange} />
      <GuidedTutorial open={tutorialOpen} onClose={closeTutorial} scenarioName={scenarioName} city={board.world?.city} generatedSummary={board.generatedContent?.tutorialSummary} />
    </div>
  );
}

function HeaderButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  primary = false,
}: {
  icon: typeof Save;
  label: string;
  onClick: () => void;
  active?: boolean;
  primary?: boolean;
}) {
  return (
    <Button
      variant={primary || active ? "default" : "outline"}
      size="sm"
      className="h-8 shrink-0 px-2 sm:px-3"
      onClick={onClick}
      title={label}
    >
      <Icon className="h-3.5 w-3.5 sm:mr-1" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
