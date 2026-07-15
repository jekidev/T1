import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { AdvisorPanel as LegacyAdvisorPanel } from "./advisor-panel";
import { FamilyTreePanel } from "./family-tree-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_ATTRIBUTES, useBoardStore, type BoardEntity, type EntityCategory, type Faction } from "@/lib/game";
import { loadWorkspaceState, saveWorkspaceState, type LlmWorkspaceMode } from "@/lib/workspace";
import { Blocks, Hammer, MessageCircle, Network, ScrollText, UsersRound } from "lucide-react";

interface BuildProposal {
  notesAppend?: string;
  phases?: Array<{ name: string; description: string }>;
  timelineEvents?: Array<{ label: string; description: string; severity: "info" | "caution" | "critical" }>;
  entities?: Array<{ label: string; category: EntityCategory; faction: Faction; notes: string }>;
}

const ENTITY_CATEGORIES = new Set<EntityCategory>(["unit", "location", "resource", "objective", "evidence", "vehicle", "civilian", "event"]);
const FACTIONS = new Set<Faction>(["police", "criminal", "neutral"]);

export function AdvisorWorkspaceShell() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [workspace, setWorkspace] = useState(() => loadWorkspaceState());
  const [workflowId, setWorkflowId] = useState("workflow-create-storyline");
  const [familyOpen, setFamilyOpen] = useState(false);
  const { board, loadBoard, scenarioId, scenarioName, scenarioDescription } = useBoardStore();
  const { toast } = useToast();

  useEffect(() => saveWorkspaceState(workspace), [workspace]);

  const setMode = (mode: LlmWorkspaceMode) => {
    setWorkspace(current => ({ ...current, chatMode: mode }));
    toast({ title: `${mode[0]!.toUpperCase()}${mode.slice(1)} mode`, description: mode === "build" ? "The LLM may propose additive board JSON. You must apply it explicitly." : mode === "plan" ? "The LLM produces plans without changing state." : "Conversation mode; no build proposal required." });
  };

  const loadWorkflowPrompt = () => {
    const workflow = workspace.workflows.find(item => item.id === workflowId);
    if (!workflow) return;
    const prompt = [
      `Run workflow: ${workflow.name}`,
      workflow.description,
      "",
      ...workflow.steps.map((step, index) => `${index + 1}. [${step.kind.toUpperCase()}] ${step.title}\n${step.prompt}`),
      "",
      "Start with the current selected collaboration mode and current board state. Stop before any state change unless Build mode is selected and a proposal is explicitly requested.",
    ].join("\n");
    setChatInput(prompt);
    toast({ title: "Workflow loaded", description: `${workflow.steps.length} steps inserted into chat.` });
  };

  const setChatInput = (value: string) => {
    const textarea = rootRef.current?.querySelector('textarea[placeholder^="Play or build"]') as HTMLTextAreaElement | null;
    if (!textarea) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  };

  const applyLastBuild = () => {
    const nodes = rootRef.current?.querySelectorAll(".whitespace-pre-wrap");
    const text = nodes && nodes.length > 0 ? nodes[nodes.length - 1]?.textContent ?? "" : "";
    const proposal = parseBuildProposal(text);
    if (!proposal) {
      toast({ title: "No valid build proposal", description: "The latest message does not contain the required additive JSON schema.", variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    const additions = (proposal.entities ?? []).slice(0, 60).map((entity, index): BoardEntity => ({
      id: nanoid(10),
      templateId: entity.category === "unit" ? "unit-network" : entity.category === "vehicle" ? "vehicle-car" : entity.category === "evidence" ? "evidence-document" : "location-building",
      category: entity.category,
      faction: entity.faction,
      label: entity.label.slice(0, 120),
      x: 120 + ((board.entities.length + index) * 97) % 760,
      y: 120 + ((board.entities.length + index) * 149) % 760,
      rotation: 0,
      scale: 1,
      zIndex: board.entities.length + index,
      layerId: board.layers[0]?.id ?? "layer-default",
      zoneId: null,
      groupId: null,
      locked: false,
      attributes: { ...DEFAULT_ATTRIBUTES },
      notes: entity.notes.slice(0, 2000),
      ...(entity.category === "unit" ? { profile: { personality: "Defined through the approved LLM build proposal and future player interaction.", biography: entity.notes.slice(0, 500), traits: ["llm-built"], source: "generated" as const } } : {}),
      sourceStatus: "fictional",
    }));
    const existingPhaseNames = new Set(board.phases.map(phase => phase.name.toLowerCase()));
    const phases = (proposal.phases ?? []).filter(phase => !existingPhaseNames.has(phase.name.toLowerCase())).slice(0, 20).map((phase, index) => ({ id: `phase-build-${nanoid(8)}`, name: phase.name.slice(0, 120), description: phase.description.slice(0, 2000), order: board.phases.length + index }));
    const events = (proposal.timelineEvents ?? []).slice(0, 50).map(event => ({ id: `build-event-${nanoid(8)}`, phaseId: board.currentPhaseId, label: event.label.slice(0, 160), description: event.description.slice(0, 3000), severity: event.severity, createdAt: now, sourceStatus: "fictional" as const }));
    const next = {
      ...board,
      entities: [...board.entities, ...additions],
      phases: [...board.phases, ...phases],
      timelineEvents: [...board.timelineEvents, ...events, { id: `build-applied-${nanoid(8)}`, phaseId: board.currentPhaseId, label: "LLM build applied", description: `${additions.length} entities, ${phases.length} phases and ${events.length} events added after explicit player approval.`, severity: "info" as const, createdAt: now, sourceStatus: "balance" as const }],
      notes: proposal.notesAppend?.trim() ? `${board.notes}\n\n${proposal.notesAppend.trim()}`.trim() : board.notes,
    };
    loadBoard(next, scenarioId, scenarioName, scenarioDescription);
    toast({ title: "Build proposal applied", description: `${additions.length} entities · ${phases.length} phases · ${events.length} events` });
  };

  const setInitialMorals = (value: number) => {
    if (!board.simulation?.teamDynamics || (board.simulation.turn ?? 0) > 0) return;
    const safe = Math.max(1, Math.min(100, value));
    const dynamics = board.simulation.teamDynamics;
    const next = { ...board, simulation: { ...board.simulation, teamDynamics: { ...dynamics, userProfile: { ...dynamics.userProfile, initialSpectrum: safe, currentSpectrum: safe, lastChange: 0 } } } };
    loadBoard(next, scenarioId, scenarioName, scenarioDescription);
  };

  const morals = board.simulation?.teamDynamics?.userProfile.currentSpectrum ?? 50;
  const lockedMorals = (board.simulation?.turn ?? 0) > 0;

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-[linear-gradient(145deg,hsl(var(--sidebar)),hsl(var(--background)))]">
      <div className="space-y-2 border-b border-border/70 bg-card/80 p-2 shadow-[inset_0_-1px_0_hsl(var(--primary)/0.15)] backdrop-blur">
        <div className="grid grid-cols-3 gap-1">
          <Button size="sm" variant={workspace.chatMode === "talk" ? "default" : "outline"} className="h-8 text-[10px] shadow-sm" onClick={() => setMode("talk")}><MessageCircle className="mr-1 h-3.5 w-3.5" />Talk</Button>
          <Button size="sm" variant={workspace.chatMode === "plan" ? "default" : "outline"} className="h-8 text-[10px] shadow-sm" onClick={() => setMode("plan")}><ScrollText className="mr-1 h-3.5 w-3.5" />Plan</Button>
          <Button size="sm" variant={workspace.chatMode === "build" ? "default" : "outline"} className="h-8 text-[10px] shadow-sm" onClick={() => setMode("build")}><Hammer className="mr-1 h-3.5 w-3.5" />Build</Button>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1">
          <Select value={workflowId} onValueChange={setWorkflowId}><SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{workspace.workflows.map(workflow => <SelectItem key={workflow.id} value={workflow.id}>{workflow.name}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={loadWorkflowPrompt}><Network className="mr-1 h-3.5 w-3.5" />Load</Button>
          <Button size="sm" variant="outline" className="h-8 text-[10px]" disabled={workspace.chatMode !== "build"} onClick={applyLastBuild}><Blocks className="mr-1 h-3.5 w-3.5" />Apply</Button>
          <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => setFamilyOpen(true)}><UsersRound className="mr-1 h-3.5 w-3.5" />Family</Button>
        </div>
        <div className="rounded-lg border bg-background/60 px-2 py-1.5 shadow-inner">
          <div className="flex items-center justify-between text-[9px]"><span>Good / evil moral spectrum at startup</span><div className="flex items-center gap-2"><Badge variant="outline">{Math.round(morals)}/100</Badge>{lockedMorals && <span className="text-muted-foreground">locked after turn 0</span>}</div></div>
          <input type="range" min="1" max="100" value={morals} disabled={lockedMorals} onChange={event => setInitialMorals(Number(event.target.value))} className="mt-1 w-full accent-primary" />
          <div className="flex justify-between text-[8px] text-muted-foreground"><span>1 · evil</span><span>50 · mixed</span><span>100 · good</span></div>
        </div>
      </div>
      <div className="min-h-0 flex-1"><LegacyAdvisorPanel /></div>
      <FamilyTreePanel open={familyOpen} board={board} onClose={() => setFamilyOpen(false)} onChange={next => loadBoard(next, scenarioId, scenarioName, scenarioDescription)} />
    </div>
  );
}

function parseBuildProposal(text: string): BuildProposal | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const start = text.indexOf("{");
  const candidate = fenced ?? (start >= 0 ? text.slice(start) : "");
  try {
    const parsed = JSON.parse(candidate) as BuildProposal;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.entities && !parsed.entities.every(entity => typeof entity.label === "string" && typeof entity.notes === "string" && ENTITY_CATEGORIES.has(entity.category) && FACTIONS.has(entity.faction))) return null;
    if (parsed.phases && !parsed.phases.every(phase => typeof phase.name === "string" && typeof phase.description === "string")) return null;
    if (parsed.timelineEvents && !parsed.timelineEvents.every(event => typeof event.label === "string" && typeof event.description === "string" && ["info", "caution", "critical"].includes(event.severity))) return null;
    return parsed;
  } catch {
    return null;
  }
}
