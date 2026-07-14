import { useLocation, useParams } from "wouter";
import { useEffect, useState } from "react";
import { useGetScenario, useGetTutorialScenario, useUpdateScenario, getGetScenarioQueryKey, getGetTutorialScenarioQueryKey } from "@workspace/api-client-react";
import { useBoardStore, readAutosaveTimestamp, simulateTurn, type PlayerTurnAction } from "@/lib/game";
import { advanceBoardStrategy, runBoardBlackmailAction, type BoardBlackmailAction } from "@/lib/strategy/boardStrategyBridge";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CommandCanvas } from "./canvas";
import { PaletteSidebar } from "./sidebar-left";
import { PropertiesSidebar } from "./sidebar-right";
import { ScoringPanel } from "./scoring-panel";
import { SimulationPanel } from "./simulation-panel";
import { AdvisorPanel } from "./advisor-panel";
import { DeveloperAiPanel } from "./developer-ai-panel";
import { WorldMapUnderlay } from "./world-map-underlay";
import { WorldSetupPanel } from "./world-setup-panel";
import { GuidedTutorial } from "./guided-tutorial";
import { saveWorldConfig } from "@/lib/world-config";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Download, Clock, Loader2, Code2, MapPin, BarChart3, CircleHelp, Map as MapIcon, Layers3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function BoardPage() {
  const params = useParams();
  const id = params.id;
  const isTutorial = id === "tutorial";
  const scenarioId = isTutorial ? null : parseInt(id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const scenarioQuery = useGetScenario(scenarioId!, { query: { enabled: !isTutorial && !!scenarioId, queryKey: getGetScenarioQueryKey(scenarioId!) } });
  const tutorialQuery = useGetTutorialScenario({ query: { enabled: isTutorial, queryKey: getGetTutorialScenarioQueryKey() } });
  const updateMutation = useUpdateScenario();
  const { loadBoard, board, scenarioName, scenarioDescription } = useBoardStore();
  const [initializedId, setInitializedId] = useState<string | null>(null);
  const [autosaveTime, setAutosaveTime] = useState<string | null>(readAutosaveTimestamp());
  const [developerPanelOpen, setDeveloperPanelOpen] = useState(false);
  const [worldSetupOpen, setWorldSetupOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);

  useEffect(() => {
    const data = isTutorial ? tutorialQuery.data : scenarioQuery.data;
    if (data && initializedId !== id) {
      loadBoard(data.board as any, data.id, data.name, data.description || "");
      const loadedBoard = data.board as any;
      if (loadedBoard?.world) saveWorldConfig({ ...loadedBoard.world, supplierCountry: loadedBoard.world.country, workAreaLabel: `${loadedBoard.world.city} og omegn` });
      setInitializedId(id!);
      if (isTutorial || localStorage.getItem(`tutorial-pending-${data.id}`) === "1" || localStorage.getItem("operation-kobenhavn-tutorial-complete") !== "1") setTutorialOpen(true);
    }
  }, [scenarioQuery.data, tutorialQuery.data, id, initializedId, isTutorial, loadBoard]);

  useEffect(() => { const interval = setInterval(() => setAutosaveTime(readAutosaveTimestamp()), 10000); return () => clearInterval(interval); }, []);

  const closeTutorial = () => { setTutorialOpen(false); localStorage.setItem("operation-kobenhavn-tutorial-complete", "1"); if (scenarioId) localStorage.removeItem(`tutorial-pending-${scenarioId}`); };
  const resolveTurn = (action: PlayerTurnAction) => {
    const result = simulateTurn(board, action);
    const advancedBoard = advanceBoardStrategy(result.board);
    loadBoard(advancedBoard, scenarioId, scenarioName, scenarioDescription);
    toast({ title: `Turn ${advancedBoard.simulation?.turn ?? ""} resolved`, description: result.summary });
  };
  const resolveBlackmail = (action: BoardBlackmailAction) => {
    const result = runBoardBlackmailAction(board, action);
    if (result.board !== board) {
      loadBoard(result.board, scenarioId, scenarioName, scenarioDescription);
    }
    toast({
      title: result.accepted ? "In-game blackmail resolved" : "Blackmail command rejected",
      description: result.message,
      ...(result.accepted ? {} : { variant: "destructive" as const }),
    });
  };
  const handleSave = async () => { if (isTutorial || !scenarioId) { toast({ title: "Cannot save tutorial directly" }); return; } try { await updateMutation.mutateAsync({ id: scenarioId, data: { board: board as any } }); toast({ title: "Scenario saved" }); } catch { toast({ title: "Save failed", variant: "destructive" }); } };
  const handleExport = () => { const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `operation-${scenarioName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); };

  if ((!isTutorial && scenarioQuery.isLoading) || (isTutorial && tutorialQuery.isLoading)) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!isTutorial && scenarioQuery.isError) return <div className="flex h-screen items-center justify-center flex-col gap-4"><div className="text-destructive font-bold">Failed to load scenario</div><Button onClick={() => setLocation("/")}>Return Home</Button></div>;

  return <div className="flex flex-col h-screen w-full overflow-hidden bg-background select-text">
    <header className="h-12 border-b bg-card flex items-center justify-between px-4 shrink-0 z-30"><div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-sm font-bold">{scenarioName}</h1><span className="text-[9px] text-muted-foreground">{board.world ? `${board.world.city}, ${board.world.country}` : "European world"} · Turn {board.simulation?.turn ?? 0}</span></div></div><div className="flex items-center gap-2">{autosaveTime && <span className="text-[10px] text-muted-foreground"><Clock className="inline h-3 w-3" /> {formatDistanceToNow(new Date(autosaveTime))} ago</span>}<Button variant={mapInteractive ? "default" : "outline"} size="sm" onClick={() => setMapInteractive(value => !value)}>{mapInteractive ? <Layers3 className="mr-1 h-3 w-3" /> : <MapIcon className="mr-1 h-3 w-3" />}{mapInteractive ? "Board" : "Map"}</Button><Button variant="outline" size="sm" onClick={() => setTutorialOpen(true)}><CircleHelp className="mr-1 h-3 w-3" />Guide</Button><Button variant="outline" size="sm" onClick={() => setWorldSetupOpen(true)}><MapPin className="mr-1 h-3 w-3" />World</Button><Button variant="outline" size="sm" onClick={() => setLocation("/analytics")}><BarChart3 className="mr-1 h-3 w-3" />Analytics</Button><Button variant={developerPanelOpen ? "default" : "outline"} size="sm" onClick={() => setDeveloperPanelOpen(value => !value)}><Code2 className="mr-1 h-3 w-3" />Developer AI</Button><Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-1 h-3 w-3" />Export</Button>{!isTutorial && <Button size="sm" onClick={handleSave}><Save className="mr-1 h-3 w-3" />Save</Button>}</div></header>
    <div className="flex-1 overflow-hidden"><ResizablePanelGroup direction="horizontal"><ResizablePanel defaultSize={15} minSize={10}><PaletteSidebar /></ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={58}><ResizablePanelGroup direction="vertical"><ResizablePanel defaultSize={64}><div className="relative h-full"><WorldMapUnderlay interactive={mapInteractive} /><div className={`absolute inset-0 z-10 ${mapInteractive ? "pointer-events-none opacity-25" : ""}`}><CommandCanvas mapTemplateId={board.mapTemplateId} /></div></div></ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={36} minSize={20}><ResizablePanelGroup direction="horizontal"><ResizablePanel defaultSize={50}><SimulationPanel board={board} onResolve={resolveTurn} onBlackmail={resolveBlackmail} /></ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={50}><ScoringPanel /></ResizablePanel></ResizablePanelGroup></ResizablePanel></ResizablePanelGroup></ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={27} minSize={18}><ResizablePanelGroup direction="vertical"><ResizablePanel defaultSize={45}><PropertiesSidebar /></ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={55}><AdvisorPanel /></ResizablePanel></ResizablePanelGroup></ResizablePanel></ResizablePanelGroup></div>
    <DeveloperAiPanel open={developerPanelOpen} onClose={() => setDeveloperPanelOpen(false)} /><WorldSetupPanel open={worldSetupOpen} onClose={() => setWorldSetupOpen(false)} /><GuidedTutorial open={tutorialOpen} onClose={closeTutorial} scenarioName={scenarioName} city={board.world?.city} generatedSummary={board.generatedContent?.tutorialSummary} />
  </div>;
}
