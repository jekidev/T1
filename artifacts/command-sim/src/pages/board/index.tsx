import { useLocation, useParams } from "wouter";
import { useEffect, useState } from "react";
import {
  useGetScenario,
  useGetTutorialScenario,
  useUpdateScenario,
  getGetScenarioQueryKey,
  getGetTutorialScenarioQueryKey,
} from "@workspace/api-client-react";
import { useBoardStore, readAutosaveTimestamp } from "@/lib/game";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CommandCanvas } from "./canvas";
import { PaletteSidebar } from "./sidebar-left";
import { PropertiesSidebar } from "./sidebar-right";
import { ScoringPanel } from "./scoring-panel";
import { AdvisorPanel } from "./advisor-panel";
import { DeveloperAiPanel } from "./developer-ai-panel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Download, Clock, Loader2, Code2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function BoardPage() {
  const params = useParams();
  const id = params.id;
  const isTutorial = id === "tutorial";
  const scenarioId = isTutorial ? null : parseInt(id || "0");
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const scenarioQuery = useGetScenario(scenarioId!, {
    query: { enabled: !isTutorial && !!scenarioId, queryKey: getGetScenarioQueryKey(scenarioId!) },
  });
  const tutorialQuery = useGetTutorialScenario({
    query: { enabled: isTutorial, queryKey: getGetTutorialScenarioQueryKey() },
  });
  
  const updateMutation = useUpdateScenario();
  
  const { loadBoard, board, scenarioName } = useBoardStore();
  
  const [initializedId, setInitializedId] = useState<string | null>(null);
  const [autosaveTime, setAutosaveTime] = useState<string | null>(readAutosaveTimestamp());
  const [developerPanelOpen, setDeveloperPanelOpen] = useState(false);

  useEffect(() => {
    const data = isTutorial ? tutorialQuery.data : scenarioQuery.data;
    if (data && initializedId !== id) {
      loadBoard(data.board as any, data.id, data.name, data.description || "");
      setInitializedId(id!);
    }
  }, [scenarioQuery.data, tutorialQuery.data, id, initializedId, isTutorial, loadBoard]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAutosaveTime(readAutosaveTimestamp());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    if (isTutorial || !scenarioId) {
      toast({ title: "Cannot save tutorial scenario directly.", description: "Export it to save locally." });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: scenarioId,
        data: {
          board: board as any
        }
      });
      toast({ title: "Scenario saved successfully." });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nordlys-${scenarioName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if ((!isTutorial && scenarioQuery.isLoading) || (isTutorial && tutorialQuery.isLoading)) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (!isTutorial && scenarioQuery.isError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background flex-col gap-4">
        <div className="text-destructive font-bold text-xl">Failed to load scenario</div>
        <Button onClick={() => setLocation("/")}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold leading-tight flex items-center gap-2">
              {scenarioName}
              {isTutorial && <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded uppercase">Tutorial</span>}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {autosaveTime && (
            <div className="text-[10px] text-muted-foreground flex items-center mr-2">
              <Clock className="w-3 h-3 mr-1" />
              Auto-saved {formatDistanceToNow(new Date(autosaveTime))} ago
            </div>
          )}
          <Button
            variant={developerPanelOpen ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setDeveloperPanelOpen((current) => !current)}
          >
            <Code2 className="h-3 w-3 mr-1.5" />
            Developer AI
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}>
            <Download className="h-3 w-3 mr-1.5" />
            Export
          </Button>
          {!isTutorial && (
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}
              Save
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
            <PaletteSidebar />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={60}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={70}>
                <CommandCanvas mapTemplateId={board.mapTemplateId} />
              </ResizablePanel>
              
              <ResizableHandle withHandle />
              
              <ResizablePanel defaultSize={30} minSize={15}>
                <ScoringPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={50}>
                <PropertiesSidebar />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50}>
                <AdvisorPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <DeveloperAiPanel open={developerPanelOpen} onClose={() => setDeveloperPanelOpen(false)} />
    </div>
  );
}
