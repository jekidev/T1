import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import ScenarioList from "./scenario-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Boxes, PanelsTopLeft, Scale } from "lucide-react";
import {
  loadWorkspaceState,
  saveWorkspaceState,
  type UserWorkspaceState,
} from "@/lib/workspace";

export default function ScenarioListShell() {
  const [, setLocation] = useLocation();
  const [workspace, setWorkspace] = useState<UserWorkspaceState>(() => loadWorkspaceState());

  useEffect(() => saveWorkspaceState(workspace), [workspace]);

  const moralLabel = workspace.llmMoralSpectrum <= 20
    ? "ruthless"
    : workspace.llmMoralSpectrum <= 40
      ? "morally dark"
      : workspace.llmMoralSpectrum <= 60
        ? "pragmatic"
        : workspace.llmMoralSpectrum <= 80
          ? "principled"
          : "benevolent";

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_35%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--muted)/0.18))]">
      <div className="fixed right-4 top-4 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap justify-end gap-2">
        <div className="w-72 rounded-xl border bg-card/92 p-3 shadow-2xl shadow-primary/10 backdrop-blur">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="flex items-center gap-1 font-medium"><Scale className="h-3.5 w-3.5" />LLM moral stance at startup</span>
            <Badge variant="outline">{workspace.llmMoralSpectrum}/100 · {moralLabel}</Badge>
          </div>
          <input
            aria-label="LLM moral spectrum at startup"
            type="range"
            min="1"
            max="100"
            step="1"
            value={workspace.llmMoralSpectrum}
            onChange={event => setWorkspace(current => ({
              ...current,
              llmMoralSpectrum: Math.max(1, Math.min(100, Number(event.target.value))),
            }))}
            className="mt-2 w-full accent-primary"
          />
          <div className="flex justify-between text-[8px] text-muted-foreground"><span>1 · evil</span><span>50 · mixed</span><span>100 · good</span></div>
        </div>
        <Button variant="outline" className="bg-card/90 shadow-xl backdrop-blur" onClick={() => setLocation("/external-assets")}><Boxes className="mr-2 h-4 w-4" />Figma / HF Assets</Button>
        <Button variant="outline" className="bg-card/90 shadow-xl backdrop-blur" onClick={() => setLocation("/workspace")}><PanelsTopLeft className="mr-2 h-4 w-4" />Workspace & Preflight</Button>
      </div>
      <ScenarioList />
    </div>
  );
}
