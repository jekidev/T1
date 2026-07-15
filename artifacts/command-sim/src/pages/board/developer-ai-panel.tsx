import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, Bug, Camera, Download, FileDown, ImagePlus, Save, Sparkles, X } from "lucide-react";
import { applySyndicateCommand } from "@workspace/strategy-sim";
import { useSendAdvisorMessage } from "@workspace/api-client-react";
import { useBoardStore } from "@/lib/game";
import { captureDomSnapshot } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlayerStatusMeter } from "@/components/player-status-meter";
import { NetworkRagControl, type WorldUpdateResult } from "@/components/network-rag-control";

interface ObservabilityEvent {
  id: string;
  timestamp: string;
  source: "browser" | "server" | "game" | "system";
  level: "debug" | "info" | "warn" | "error";
  type: string;
  message: string;
  data?: unknown;
}

interface DeveloperAiPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DeveloperAiPanel({ open, onClose }: DeveloperAiPanelProps) {
  const board = useBoardStore(state => state.board);
  const loadBoard = useBoardStore(state => state.loadBoard);
  const scenarioId = useBoardStore(state => state.scenarioId);
  const scenarioName = useBoardStore(state => state.scenarioName);
  const scenarioDescription = useBoardStore(state => state.scenarioDescription);
  const [events, setEvents] = useState<ObservabilityEvent[]>([]);
  const [analysis, setAnalysis] = useState("");
  const [question, setQuestion] = useState("Analyze the latest runtime events, identify the most important bug or UX issue, and propose a safe implementation plan.");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteImage, setNoteImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [working, setWorking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendAdvisorMessage();

  useEffect(() => {
    if (!open) return;
    let stream: EventSource | null = new EventSource("/api/observability/stream");
    stream.addEventListener("snapshot", ((event: MessageEvent<string>) => {
      try { setEvents((JSON.parse(event.data) as ObservabilityEvent[]).slice(-150)); } catch { /* ignored */ }
    }) as EventListener);
    stream.addEventListener("telemetry", ((event: MessageEvent<string>) => {
      try { const telemetry = JSON.parse(event.data) as ObservabilityEvent; setEvents(current => [...current.slice(-149), telemetry]); } catch { /* ignored */ }
    }) as EventListener);
    stream.onerror = () => { stream?.close(); stream = null; };
    return () => stream?.close();
  }, [open]);

  const counts = useMemo(() => events.reduce((result, event) => { result[event.level] += 1; return result; }, { debug: 0, info: 0, warn: 0, error: 0 }), [events]);

  const handleAnalyze = async () => {
    if (!question.trim() || sendMessage.isPending) return;
    setAnalysis("");
    try {
      const response = await sendMessage.mutateAsync({ data: { role: "neutral_analyst", message: `Act as the Developer AI. Use board state, telemetry and persistent RAG memory. Separate facts, causes and proposed changes. You have no web-search tool; never claim you searched the internet.\n\n${question.trim()}`, board: board as never, history: [] } });
      setAnalysis(response.reply);
    } catch {
      setAnalysis("Developer analysis failed. Check OpenRouter and runtime telemetry.");
    }
  };

  const handleSourceDebug = async () => {
    setWorking(true);
    setAnalysis("Scanning repository source code with a configured coding model...");
    try {
      const response = await fetch("/api/source-debug/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: question }) });
      const body = await response.json() as { report?: string; model?: string; files?: number; message?: string };
      if (!response.ok) throw new Error(body.message ?? "Source debugger failed");
      setAnalysis(`Model: ${body.model}\nFiles reviewed: ${body.files}\n\n${body.report}`);
    } catch (error) {
      setAnalysis(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const handleImage = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setNoteImage({ name: file.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || (!noteText.trim() && !noteImage)) return;
    setWorking(true);
    try {
      const response = await fetch("/api/rag/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: noteTitle, text: noteText, imageName: noteImage?.name, imageDataUrl: noteImage?.dataUrl }) });
      const body = await response.json() as { message?: string; notePath?: string };
      if (!response.ok) throw new Error(body.message ?? "Could not save RAG note");
      setAnalysis(`Saved to RAG: ${body.notePath}\nThe note was immediately synchronized into persistent memory.`);
      setNoteTitle(""); setNoteText(""); setNoteImage(null);
    } catch (error) {
      setAnalysis(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const handleWorldUpdated = (result: WorldUpdateResult) => {
    const simulation = board.simulation;
    if (!simulation?.syndicateWorld) return;
    const npcIds = [...new Set(simulation.syndicateWorld.memberships.map(member => member.npcId))];
    const syndicateWorld = applySyndicateCommand(simulation.syndicateWorld, {
      type: "update_world_from_rag",
      commandId: `rag-world-${result.ragRevision.slice(0, 20)}-${simulation.syndicateWorld.tick}`,
      tick: simulation.syndicateWorld.tick,
      ragRevision: result.ragRevision,
      npcIds,
    });
    const nextBoard = {
      ...board,
      simulation: { ...simulation, syndicateWorld, lastResolution: `World RAG revision updated to ${result.ragRevision.slice(0, 12)}.` },
      timelineEvents: [...board.timelineEvents, {
        id: `rag-world-${Date.now()}`,
        phaseId: board.currentPhaseId,
        label: "World knowledge updated",
        description: `${result.itemCount} RAG items were re-indexed. NPC knowledge revision is now ${result.ragRevision}.`,
        severity: "info" as const,
        createdAt: new Date().toISOString(),
        sourceStatus: "verified" as const,
      }].slice(-1000),
    };
    loadBoard(nextBoard, scenarioId, scenarioName, scenarioDescription);
  };

  const handleExportPackage = () => downloadJson("developer-review.json", {
    packageName: `developer-review-${new Date().toISOString()}`,
    question,
    analysis,
    telemetry: events.slice(-150),
    boardSummary: { entities: board.entities.length, zones: board.zones.length, phases: board.phases.length },
  });

  const handleEmployeeBrief = () => {
    const simulation = board.simulation;
    const syndicate = simulation?.syndicateWorld;
    const profile = simulation?.teamDynamics?.userProfile;
    const lines = [
      `# Employee brief — ${scenarioName}`,
      "",
      `Generated: ${new Date().toISOString()}`,
      `World: ${board.world ? `${board.world.city}, ${board.world.country}` : "not configured"}`,
      `Current phase: ${board.phases.find(phase => phase.id === board.currentPhaseId)?.name ?? "none"}`,
      "",
      "## Player status",
      `- Health signal: ${Math.round(average(board.entities.map(entity => entity.attributes.morale), 70))}/100`,
      `- Action readiness: ${Math.round(100 - (profile?.riskIndex ?? 25))}/100`,
      `- Karma: ${profile?.karma ?? 0}`,
      `- Morals: ${Math.max(1, Math.round(profile?.currentSpectrum ?? 50))}/100 (1 evil → 100 good)`,
      "",
      "## Team pulse",
      `- Red estimated success: ${simulation?.teamDynamics?.red.estimatedSuccess ?? "n/a"}%`,
      `- Red collective morale: ${simulation?.teamDynamics?.red.collectiveMorale ?? "n/a"}%`,
      `- Blue estimated success: ${simulation?.teamDynamics?.blue.estimatedSuccess ?? "n/a"}%`,
      `- Blue collective morale: ${simulation?.teamDynamics?.blue.collectiveMorale ?? "n/a"}%`,
      "",
      "## Factions",
      ...(simulation?.factions.map(faction => `- ${faction.name}: personnel ${faction.personnel}, cohesion ${faction.cohesion}, legitimacy ${faction.legitimacy}, objectives ${faction.objectives.join("; ")}`) ?? ["- No factions loaded"]),
      "",
      "## Fictional syndicates",
      ...(syndicate?.syndicates.map(item => `- ${item.name}: ${item.memberIds.length} members, ${item.controlledTerritoryIds.length} territories, strategy ${item.activeStrategy}, loyalty ${Math.round(item.internalLoyalty)}`) ?? ["- No syndicate world loaded"]),
      "",
      "## Instructions",
      "This export is an in-game operational brief. People, roles and covert gameplay labels are fictional. Real-case references must remain separately sourced and verified.",
    ];
    downloadText(`employee-brief-${safeFileName(scenarioName)}.md`, lines.join("\n"));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-12 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2"><Bot className="h-4 w-4 shrink-0 text-primary" /><div><div className="text-sm font-semibold">Developer AI</div><div className="text-[10px] text-muted-foreground">Source debugger, RAG, world update and live observability</div></div></div>
        <div className="flex items-start gap-2"><PlayerStatusMeter board={board} compact /><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button></div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
        <Badge variant="outline">Events {events.length}</Badge><Badge variant="outline">Errors {counts.error}</Badge><Badge variant="outline">Warnings {counts.warn}</Badge>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => captureDomSnapshot()}><Camera className="mr-1 h-3 w-3" />DOM</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleExportPackage}><Download className="mr-1 h-3 w-3" />Developer export</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleEmployeeBrief}><FileDown className="mr-1 h-3 w-3" />Employee brief</Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(110px,0.7fr)_auto_auto_auto_minmax(120px,1fr)]">
        <ScrollArea className="border-b border-border p-3"><div className="space-y-2">{[...events].reverse().map(event => <div key={event.id} className="rounded-md border border-border bg-muted/30 p-2 text-[10px]"><div className="flex justify-between"><span className="font-medium"><Activity className="mr-1 inline h-3 w-3" />{event.source} · {event.type}</span><span>{event.level}</span></div><div className="mt-1">{event.message}</div></div>)}</div></ScrollArea>
        <div className="space-y-2 border-b border-border p-3"><Textarea value={question} onChange={event => setQuestion(event.target.value)} className="min-h-16 text-xs" /><div className="grid grid-cols-2 gap-2"><Button size="sm" onClick={handleAnalyze} disabled={working || sendMessage.isPending}><Sparkles className="mr-1 h-3.5 w-3.5" />Analyze runtime</Button><Button size="sm" variant="secondary" onClick={handleSourceDebug} disabled={working}><Bug className="mr-1 h-3.5 w-3.5" />Debug source</Button></div></div>
        <div className="border-b border-border p-3"><NetworkRagControl onMessage={setAnalysis} onWorldUpdated={handleWorldUpdated} /></div>
        <div className="space-y-2 border-b border-border p-3"><input className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs" placeholder="RAG note title" value={noteTitle} onChange={event => setNoteTitle(event.target.value)} /><Textarea className="min-h-16 text-xs" placeholder="Text note, world information, design idea or image description" value={noteText} onChange={event => setNoteText(event.target.value)} /><div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1 h-3.5 w-3.5" />{noteImage?.name ?? "Add image"}</Button><Button size="sm" className="flex-1" onClick={handleSaveNote} disabled={working || !noteTitle.trim()}><Save className="mr-1 h-3.5 w-3.5" />Save to RAG</Button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) handleImage(file); }} /></div></div>
        <ScrollArea className="p-3"><div className="whitespace-pre-wrap text-xs leading-relaxed">{analysis || "Run analysis, import approved RAG sources, update the world, or save text and images."}</div></ScrollArea>
      </div>
    </div>
  );
}

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function downloadText(filename: string, value: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9æøå._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "scenario";
}

function average(values: readonly number[], fallback: number): number {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) / finite.length : fallback;
}
