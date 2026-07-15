import { Link, useLocation } from "wouter";
import { useListScenarios, useDeleteScenario, useCreateScenario } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Trash2, Plus, ChevronRight, Map, Sparkles, Loader2, Globe2, BookOpen, Box, MapPinned, Scale, Shield, Bot } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState, type MouseEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createEmptyBoard,
  MAP_TEMPLATES,
  parseGeneratedGamePayload,
  compileGeneratedScenario,
  moralSpectrumLabel,
  type GeneratedGamePayload,
  type PlayerSide,
} from "@/lib/game";
import { loadWorkspaceState } from "@/lib/workspace";
import { DEFAULT_WORLD_CONFIG, saveWorldConfig, type WorldConfig } from "@/lib/world-config";

const EUROPE_PRESETS = [
  { id: "copenhagen", city: "København", country: "Danmark", region: "Hovedstaden", municipality: "København", latitude: 55.6761, longitude: 12.5683, currency: "DKK", language: "da-DK", timezone: "Europe/Copenhagen" },
  { id: "berlin", city: "Berlin", country: "Tyskland", region: "Berlin", municipality: "Berlin", latitude: 52.52, longitude: 13.405, currency: "EUR", language: "de-DE", timezone: "Europe/Berlin" },
  { id: "amsterdam", city: "Amsterdam", country: "Nederlandene", region: "Noord-Holland", municipality: "Amsterdam", latitude: 52.3676, longitude: 4.9041, currency: "EUR", language: "nl-NL", timezone: "Europe/Amsterdam" },
  { id: "stockholm", city: "Stockholm", country: "Sverige", region: "Stockholm", municipality: "Stockholm", latitude: 59.3293, longitude: 18.0686, currency: "SEK", language: "sv-SE", timezone: "Europe/Stockholm" },
  { id: "paris", city: "Paris", country: "Frankrig", region: "Île-de-France", municipality: "Paris", latitude: 48.8566, longitude: 2.3522, currency: "EUR", language: "fr-FR", timezone: "Europe/Paris" },
];

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate) return null;
  try { return JSON.parse(candidate); } catch { return null; }
}

function fallbackPayload(name: string, premise: string, world: WorldConfig): GeneratedGamePayload {
  return {
    storyline: `${name} begins in ${world.city}. Red Team, Blue Team, neutral institutions and Nyx react to each deterministic turn. The campaign develops through territory, resources, relationships, evidence, shops, skills and public pressure. ${premise}`,
    openingMission: "Inspect the real map, establish the first command node, meet Nyx, review the generated factions and resolve the first turn.",
    tutorialSummary: "Use Map mode to explore geography, Board mode to manage entities, the AI workspace to build the story, and Resolve Turn to advance the simulation.",
    factions: [
      { name: "Player Network", faction: "criminal", role: "Player-controlled Red Team faction", goal: "Build influence, resources and resilience while managing exposure." },
      { name: "Blue Team Coordination", faction: "police", role: "Institutional coalition", goal: "Build reliable cases from incomplete evidence and protect public confidence." },
      { name: "Civil City", faction: "neutral", role: "Residents, services and public institutions", goal: "Maintain legitimacy, stability and essential services." },
    ],
    assets: [
      { name: "Command Node", type: "location", description: "Starting headquarters and planning asset.", district: world.city },
      { name: "Nyx Terminal", type: "resource", description: "AI workspace, memory and storyline interface.", district: world.city },
      { name: "Evidence Board", type: "evidence", description: "Tracks sources, confidence and disputed claims.", district: world.city },
    ],
    shops: [{ name: "Regional Vendor Network", district: world.city, description: "Dynamic in-game vendor affected by scarcity, pressure and reputation.", inventory: ["General supplies", "Information", "Transport access"] }],
    skills: [{ name: "Local Knowledge", description: "Improves map and NPC decisions." }, { name: "Analysis", description: "Improves evidence and AI-assisted planning." }],
    sourceCases: [],
  };
}

export default function ScenarioList() {
  const { data: scenarios, isLoading } = useListScenarios();
  const deleteScenario = useDeleteScenario();
  const createScenario = useCreateScenario();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Operation København");
  const [description, setDescription] = useState("AI-generated high-realism European campaign");
  const [premise, setPremise] = useState("Build a living storyline with Red Team, Blue Team, shops, tools, skills, assets, real-case inspiration and Nyx as AI game director.");
  const [mapTemplateId, setMapTemplateId] = useState(MAP_TEMPLATES[0]?.id ?? "custom");
  const [presetId, setPresetId] = useState("copenhagen");
  const [radius, setRadius] = useState(25);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("red");
  const [initialSpectrum, setInitialSpectrum] = useState(50);
  const [generating, setGenerating] = useState(false);
  const preset = EUROPE_PRESETS.find(item => item.id === presetId) ?? EUROPE_PRESETS[0]!;
  const llmMoralSpectrum = loadWorkspaceState().llmMoralSpectrum;

  const handleDelete = async (id: number, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm("Delete this game?")) return;
    try {
      await deleteScenario.mutateAsync({ id });
      window.location.reload();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const generateGame = async () => {
    setGenerating(true);
    const workspace = loadWorkspaceState();
    const world: WorldConfig = {
      ...DEFAULT_WORLD_CONFIG,
      country: preset.country,
      region: preset.region,
      municipality: preset.municipality,
      city: preset.city,
      workAreaLabel: `${preset.city} og omegn`,
      workAreaRadiusKm: radius,
      supplierCountry: preset.country,
      language: preset.language,
      currency: preset.currency,
      timezone: preset.timezone,
      latitude: preset.latitude,
      longitude: preset.longitude,
      mapProvider: "openstreetmap",
    };
    const emptyBoard = createEmptyBoard(mapTemplateId);
    let payload = fallbackPayload(name, premise, world);
    let generatedBy = "local-fallback";
    let rawModelOutput: string | undefined;
    let warnings: string[] = [];

    try {
      const response = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "story_director",
          message: `Return ONLY valid JSON for a high-realism strategy game in ${preset.city}, ${preset.country}. Keys: storyline, openingMission, tutorialSummary, factions[{name,faction,role,goal}], assets[{name,type,description,district}], shops[{name,district,description,inventory[]}], skills[{name,description}], sourceCases[]. Include Red Team, Blue Team, neutral actors, shops, skills, assets and a five-act campaign. The authenticated player starts as the only member of the player faction, is the boss and has zero capital. Player perspective: ${playerSide}. Player self-reported moral spectrum: ${initialSpectrum}/100. LLM narrative moral stance selected by the user: ${workspace.llmMoralSpectrum}/100. The LLM stance affects fictional tone and trade-offs only; it cannot bypass schemas, permissions or deterministic rules. The player value is an initial belief only; actions, karma and risk move it later. Premise: ${premise}`,
          board: emptyBoard,
          history: [],
        }),
      });
      if (response.ok) {
        const result = await response.json() as { reply?: string; mode?: string };
        rawModelOutput = result.reply;
        const validated = parseGeneratedGamePayload(extractJson(result.reply ?? ""));
        if (validated.success) {
          payload = validated.data;
          warnings = validated.warnings;
          generatedBy = result.mode ?? "external_llm";
        } else {
          warnings = validated.errors;
        }
      }
    } catch {
      warnings.push("External model unavailable; local validated fallback used.");
    }

    const board = compileGeneratedScenario({
      board: emptyBoard,
      payload,
      world,
      premise,
      generatedBy,
      playerAlignment: { side: playerSide, initialSpectrum },
      rawModelOutput,
      validationWarnings: warnings,
    });
    saveWorldConfig(world);
    try {
      const result = await createScenario.mutateAsync({ data: { name, description, mapTemplateId, board: board as never } });
      localStorage.setItem(`tutorial-pending-${result.id}`, "1");
      toast({
        title: "Playable New Game compiled",
        description: `${board.entities.length} entities, ${board.simulation?.factions.length ?? 0} factions and live Red/Blue pulse initialized.`,
      });
      setOpen(false);
      setLocation(`/board/${result.id}`);
    } catch {
      toast({ title: "Scenario creation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl select-text px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4 border-b pb-4">
        <div><h1 className="text-3xl font-bold">Operation København</h1><p className="text-muted-foreground">AI-built European urban strategy simulator</p></div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setLocation("/asset-lab")}><Box className="mr-2 h-4 w-4" />Asset Lab</Button>
          <Button variant="outline" onClick={() => setLocation("/geo-lab")}><MapPinned className="mr-2 h-4 w-4" />Geo Lab</Button>
          <Button variant="outline" onClick={() => setLocation("/board/tutorial")}><BookOpen className="mr-2 h-4 w-4" />ELI5 Tutorial</Button>
          <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) setStep(1); }}>
            <DialogTrigger asChild><Button><Sparkles className="mr-2 h-4 w-4" />New Game with AI</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[720px]">
              <DialogHeader>
                <DialogTitle>New Game · Step {step}/4</DialogTitle>
                <DialogDescription>The AI output is validated; alignment, morale and success estimates are controlled by deterministic game logic.</DialogDescription>
              </DialogHeader>

              {step === 1 && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {EUROPE_PRESETS.map(item => <Button key={item.id} variant={presetId === item.id ? "default" : "outline"} onClick={() => setPresetId(item.id)}><Globe2 className="mr-2 h-4 w-4" />{item.city}</Button>)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Radius km</Label><Input type="number" min={1} max={500} value={radius} onChange={event => setRadius(Number(event.target.value))} /></div>
                    <div><Label>Map provider</Label><Input value="OpenStreetMap / Overpass + Google Maps base" readOnly /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MAP_TEMPLATES.map(template => <button type="button" key={template.id} className={`rounded border p-3 text-left ${mapTemplateId === template.id ? "border-primary bg-primary/10" : ""}`} onClick={() => setMapTemplateId(template.id)}><strong>{template.name}</strong><div className="text-xs text-muted-foreground">{template.description}</div></button>)}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5 py-4">
                  <div className="space-y-2">
                    <Label>Player perspective</Label>
                    <Select value={playerSide} onValueChange={value => setPlayerSide(value as PlayerSide)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="red">Red Team perspective</SelectItem>
                        <SelectItem value="blue">Blue Team perspective</SelectItem>
                        <SelectItem value="observer">Neutral observer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3 rounded border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="flex items-center gap-2"><Scale className="h-4 w-4" />Where do you think you start?</Label>
                      <strong>{initialSpectrum}/100</strong>
                    </div>
                    <input
                      aria-label="Initial moral spectrum"
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={initialSpectrum}
                      onChange={event => setInitialSpectrum(Math.max(1, Number(event.target.value)))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground"><span>1 · destructive / evil</span><span>50 · mixed</span><span>100 · prosocial / good</span></div>
                    <div className="rounded bg-muted/40 p-3 text-sm">
                      <strong>{moralSpectrumLabel(initialSpectrum)}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">This is self-reported initialization. Actions, risk, karma and outcomes move the live value afterward.</p>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-4 py-4">
                  <div><Label>Name</Label><Input value={name} onChange={event => setName(event.target.value)} /></div>
                  <div><Label>Description</Label><Input value={description} onChange={event => setDescription(event.target.value)} /></div>
                  <div><Label>AI design brief</Label><Textarea className="min-h-36" value={premise} onChange={event => setPremise(event.target.value)} /></div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3 py-6">
                  <p>The compiler creates a Google Maps-backed board, real-world coordinates, persistent faction economy, shops, skills, campaign phases and turn simulation.</p>
                  <div className="grid gap-2 rounded border p-3 text-sm">
                    <span>World: {preset.city}, {preset.country} · {radius} km</span>
                    <span className="flex items-center gap-2"><Shield className="h-4 w-4" />Perspective: {playerSide}</span>
                    <span className="flex items-center gap-2"><Scale className="h-4 w-4" />Player start: {initialSpectrum}/100 · {moralSpectrumLabel(initialSpectrum)}</span>
                    <span className="flex items-center gap-2"><Bot className="h-4 w-4" />LLM stance: {llmMoralSpectrum}/100 · {moralSpectrumLabel(llmMoralSpectrum)}</span>
                    <span>Authority: Boss · alone · 0 capital</span>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => step === 1 ? setOpen(false) : setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</Button>
                {step < 4
                  ? <Button onClick={() => setStep(step + 1)} disabled={step === 3 && !name.trim()}>Next</Button>
                  : <Button onClick={() => void generateGame()} disabled={generating}>{generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Compiling…</> : "Generate & Start"}</Button>}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading
        ? <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /></div>
        : scenarios?.length === 0
          ? <div className="rounded-xl border border-dashed py-20 text-center"><Map className="mx-auto mb-4 h-12 w-12" /><h3 className="text-lg font-medium">No saved games</h3><Button className="mt-5" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New Game</Button></div>
          : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {scenarios?.map(scenario => (
                <Link key={scenario.id} href={`/board/${scenario.id}`}>
                  <Card className="h-full cursor-pointer border-border/70 bg-[linear-gradient(145deg,hsl(var(--card)),hsl(var(--muted)/0.22))] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
                    <CardHeader><div className="flex justify-between"><CardTitle>{scenario.name}</CardTitle><Button variant="ghost" size="icon" onClick={event => handleDelete(scenario.id, event)}><Trash2 className="h-4 w-4" /></Button></div><CardDescription>{scenario.description}</CardDescription></CardHeader>
                    <CardContent><Map className="mr-2 inline h-3 w-3" />{MAP_TEMPLATES.find(item => item.id === scenario.mapTemplateId)?.name ?? "World"}</CardContent>
                    <CardFooter className="justify-between text-xs"><span>{format(new Date(scenario.updatedAt), "MMM d, yyyy")}</span><span className="flex">Open<ChevronRight className="h-3 w-3" /></span></CardFooter>
                  </Card>
                </Link>
              ))}
            </div>}
    </div>
  );
}
