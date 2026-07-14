import { useLocation, useParams } from "wouter";
import { useEffect, useState } from "react";
import { useGetScenario, useGetTutorialScenario, useUpdateScenario, getGetScenarioQueryKey, getGetTutorialScenarioQueryKey } from "@workspace/api-client-react";
import { useBoardStore, readAutosaveTimestamp } from "@/lib/game";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CommandCanvas } from "./canvas";
import { PaletteSidebar } from "./sidebar-left";
import { PropertiesSidebar } from "./sidebar-right";
import { ScoringPanel } from "./scoring-panel";
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
  const { loadBoard, board, scenarioName } = useBoardStore();
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
      const pending = isTutorial || localStorage.getItem(`tutorial-pending-${data.id}`) === "1" || localStorage.getItem("operation-kobenhavn-tutorial-complete") !== "1";
      if (pending) setTutorialOpen(true);
    }
  }, [scenarioQuery.data, tutorialQuery.data, id, initializedId, isTutorial, loadBoard]);

  useEffect(() => { const interval = setInterval(() => setAutosaveTime(readAutosaveTimestamp()), 10000); return () => clearInterval(interval); }, []);

  const closeTutorial = () => { setTutorialOpen(false); localStorage.setItem("operation-kobenhavn-tutorial-complete", "1"); if (scenarioId) localStorage.removeItem(`tutorial-pending-${scenarioId}`); };
  const handleSave = async () => { if (isTutorial || !scenarioId) { toast({ title: "Cannot save tutorial scenario directly.", description: "Export it to save locally." }); return; } try { await updateMutation.mutateAsync({ id: scenarioId, data: { board: board as any } }); toast({ title: "Scenario saved successfully." }); } catch { toast({ title: "Failed to save", variant: "destructive" }); } };
  const handleExport = () => { const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `operation-${scenarioName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); };

  if ((!isTutorial && scenarioQuery.isLoading) || (isTutorial && tutorialQuery.isLoading)) return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  if (!isTutorial && scenarioQuery.isError) return <div className="flex h-screen w-full items-center justify-center bg-background flex-col gap-4"><div className="text-destructive font-bold text-xl">Failed to load scenario</div><Button onClick={() => setLocation("/")}>Return Home</Button></div>;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background select-text">
      <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-4"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button><div className="flex flex-col"><h1 className="text-sm font-bold leading-tight flex items-center gap-2">{scenarioName}{isTutorial && <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded uppercase">Tutorial</span>}</h1><span className="text-[9px] text-muted-foreground">{board.world ? `${board.world.city}, ${board.world.country}` : "European world"}</span></div></div>
        <div className="flex items-center gap-2">
          {autosaveTime && <div className="text-[10px] text-muted-foreground flex items-center mr-2"><Clock className="w-3 h-3 mr-1" />Auto-saved {formatDistanceToNow(new Date(autosaveTime))} ago</div>}
          <Button variant={mapInteractive ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setMapInteractive(value => !value)}>{mapInteractive ? <Layers3 className="h-3 w-3 mr-1.5" /> : <MapIcon className="h-3 w-3 mr-1.5" />}{mapInteractive ? "Board mode" : "Map mode"}</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setTutorialOpen(true)}><CircleHelp className="h-3 w-3 mr-1.5" />ELI5 Guide</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setWorldSetupOpen(true)}><MapPin className="h-3 w-3 mr-1.5" />World</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setLocation("/analytics")}><BarChart3 className="h-3 w-3 mr-1.5" />Analytics</Button>
          <Button variant={developerPanelOpen ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setDeveloperPanelOpen(current => !current)}><Code2 className="h-3 w-3 mr-1.5" />Developer AI</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}><Download className="h-3 w-3 mr-1.5" />Export</Button>
          {!isTutorial && <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={updateMutation.isPending}>{updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}Save</Button>}
        </div>
      </header>

      <div className="flex-1 overflow-hidden"><ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={15} minSize={10} maxSize={25}><PaletteSidebar /></ResizablePanel><ResizableHandle withHandle />
        <ResizablePanel defaultSize={60}><ResizablePanelGroup direction="vertical"><ResizablePanel defaultSize={70}><div className="relative h-full w-full overflow-hidden"><WorldMapUnderlay interactive={mapInteractive} /><div className={`absolute inset-0 z-10 transition-opacity ${mapInteractive ? "pointer-events-none opacity-25" : "pointer-events-auto opacity-100"}`}><CommandCanvas mapTemplateId={board.mapTemplateId} /></div></div></ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={30} minSize={15}><ScoringPanel /></ResizablePanel></ResizablePanelGroup></ResizablePanel><ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}><ResizablePanelGroup direction="vertical"><ResizablePanel defaultSize={50}><PropertiesSidebar /></ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={50}><AdvisorPanel /></ResizablePanel></ResizablePanelGroup></ResizablePanel>
      </ResizablePanelGroup></div>

      <DeveloperAiPanel open={developerPanelOpen} onClose={() => setDeveloperPanelOpen(false)} />
      <WorldSetupPanel open={worldSetupOpen} onClose={() => setWorldSetupOpen(false)} />
      <GuidedTutorial open={tutorialOpen} onClose={closeTutorial} scenarioName={scenarioName} city={board.world?.city} generatedSummary={board.generatedContent?.tutorialSummary} />
    </div>
  );
}
