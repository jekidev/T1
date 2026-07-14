import { Link, useLocation } from "wouter";
import { useListScenarios, useDeleteScenario, useCreateScenario } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Trash2, Plus, Play, ChevronRight, Map, Sparkles, Loader2, Globe2, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEmptyBoard, MAP_TEMPLATES, type GeneratedGameContent } from "@/lib/game";
import { DEFAULT_WORLD_CONFIG, saveWorldConfig, type WorldConfig } from "@/lib/world-config";

const EUROPE_PRESETS = [
  { id: "copenhagen", city: "København", country: "Danmark", region: "Hovedstaden", municipality: "København", latitude: 55.6761, longitude: 12.5683, currency: "DKK", language: "da-DK", timezone: "Europe/Copenhagen" },
  { id: "berlin", city: "Berlin", country: "Tyskland", region: "Berlin", municipality: "Berlin", latitude: 52.52, longitude: 13.405, currency: "EUR", language: "de-DE", timezone: "Europe/Berlin" },
  { id: "amsterdam", city: "Amsterdam", country: "Nederlandene", region: "Noord-Holland", municipality: "Amsterdam", latitude: 52.3676, longitude: 4.9041, currency: "EUR", language: "nl-NL", timezone: "Europe/Amsterdam" },
  { id: "stockholm", city: "Stockholm", country: "Sverige", region: "Stockholm", municipality: "Stockholm", latitude: 59.3293, longitude: 18.0686, currency: "SEK", language: "sv-SE", timezone: "Europe/Stockholm" },
  { id: "paris", city: "Paris", country: "Frankrig", region: "Île-de-France", municipality: "Paris", latitude: 48.8566, longitude: 2.3522, currency: "EUR", language: "fr-FR", timezone: "Europe/Paris" },
];

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate) return null;
  try { return JSON.parse(candidate) as Record<string, unknown>; } catch { return null; }
}

function fallbackGenerated(name: string, premise: string, world: WorldConfig): GeneratedGameContent {
  return {
    generatedAt: new Date().toISOString(), generatedBy: "local-fallback", premise,
    storyline: `${name} begins in ${world.city}, where rival factions, public institutions and Nyx react to every turn. The first act establishes territory, resources, relationships and evidence pressure.`,
    openingMission: "Establish your first command node, inspect the real map, meet Nyx and choose your opening faction strategy.",
    tutorialSummary: "Open World, inspect the map, place an entity, review scoring, then ask Nyx what the current board means.",
    factions: [
      { name: "Player Network", faction: "criminal", role: "Player faction", goal: "Build influence and survive escalating pressure." },
      { name: "Blue Team Coordination", faction: "police", role: "Institutional coalition", goal: "Build a reliable case from incomplete signals." },
      { name: "Civil City", faction: "neutral", role: "Public environment", goal: "Protect legitimacy, services and public confidence." },
    ],
    assets: [
      { name: "Command Node", type: "location", description: "Starting headquarters asset." },
      { name: "Nyx Terminal", type: "resource", description: "AI workspace and storyline interface." },
      { name: "Evidence Board", type: "evidence", description: "Tracks confidence, sources and disputed claims." },
    ],
    shops: [{ name: "Regional Vendor Network", district: world.city, description: "Dynamic in-game shop whose stock changes with reputation, scarcity and pressure." }],
    skills: [{ name: "Local Knowledge", description: "Improves map decisions and NPC dialogue." }, { name: "Analysis", description: "Improves evidence and AI-assisted planning." }],
    sourceCases: [],
  };
}

export default function ScenarioList() {
  const { data: scenarios, isLoading } = useListScenarios();
  const deleteScenario = useDeleteScenario();
  const createScenario = useCreateScenario();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [newScenarioOpen, setNewScenarioOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Operation København");
  const [description, setDescription] = useState("AI-generated high-realism European campaign");
  const [premise, setPremise] = useState("Build a living storyline with Red Team, Blue Team, shops, tools, skills, assets, real-case inspiration and Nyx as AI game director.");
  const [selectedMapTemplate, setSelectedMapTemplate] = useState(MAP_TEMPLATES[0].id);
  const [presetId, setPresetId] = useState("copenhagen");
  const [radius, setRadius] = useState(25);
  const [generating, setGenerating] = useState(false);

  const preset = EUROPE_PRESETS.find(item => item.id === presetId) ?? EUROPE_PRESETS[0];

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Are you sure you want to delete this scenario?")) return;
    try { await deleteScenario.mutateAsync({ id }); toast({ title: "Scenario deleted" }); window.location.reload(); }
    catch { toast({ title: "Failed to delete scenario", variant: "destructive" }); }
  };

  const generateGame = async () => {
    if (!name.trim() || !preset) return;
    setGenerating(true);
    const world: WorldConfig = {
      ...DEFAULT_WORLD_CONFIG,
      country: preset.country, region: preset.region, municipality: preset.municipality, city: preset.city,
      workAreaLabel: `${preset.city} og omegn`, workAreaRadiusKm: radius, supplierCountry: preset.country,
      language: preset.language, currency: preset.currency, timezone: preset.timezone,
      latitude: preset.latitude, longitude: preset.longitude, mapProvider: "google",
    };
    const board = createEmptyBoard(selectedMapTemplate);
    let generated = fallbackGenerated(name, premise, world);
    try {
      const response = await fetch("/api/advisor/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "story_director",
          message: `Create the first New Game package for a high-realism strategy game set in ${preset.city}, ${preset.country}. Premise: ${premise}. Return ONLY JSON with keys storyline, openingMission, tutorialSummary, factions[{name,faction,role,goal}], assets[{name,type,description}], shops[{name,district,description}], skills[{name,description}], sourceCases[]. Include Red Team and Blue Team gameplay, world assets, vendors, skills and a five-act storyline.`,
          board, history: [],
        }),
      });
      if (response.ok) {
        const payload = await response.json() as { reply?: string; mode?: string };
        const parsed = extractJson(payload.reply ?? "");
        if (parsed) generated = { ...generated, ...parsed, generatedAt: new Date().toISOString(), generatedBy: payload.mode ?? "external-llm", rawModelOutput: payload.reply } as GeneratedGameContent;
      }
    } catch { /* deterministic fallback remains functional */ }

    board.world = world;
    board.generatedContent = generated;
    board.notes = `${generated.storyline}\n\nOpening mission: ${generated.openingMission}`;
    board.phases = [
      { id: "phase-onboarding", name: "Guided Start", description: generated.tutorialSummary, order: 0 },
      { id: "phase-act-1", name: "Act I — Zero State", description: generated.openingMission, order: 1 },
      { id: "phase-act-2", name: "Act II — Signals", description: "Factions and institutions begin reacting to patterns.", order: 2 },
    ];
    board.currentPhaseId = "phase-onboarding";
    board.timelineEvents.push({ id: crypto.randomUUID(), phaseId: "phase-onboarding", label: "AI world generated", description: generated.openingMission, severity: "info", createdAt: new Date().toISOString() });
    saveWorldConfig(world);

    try {
      const res = await createScenario.mutateAsync({ data: { name, description, mapTemplateId: selectedMapTemplate, board: board as any } });
      localStorage.setItem(`tutorial-pending-${res.id}`, "1");
      toast({ title: "New Game generated", description: `${preset.city} world, storyline and starter assets are ready.` });
      setNewScenarioOpen(false); setLocation(`/board/${res.id}`);
    } catch { toast({ title: "Failed to create scenario", variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl select-text">
      <div className="flex justify-between items-center mb-8 border-b pb-4 border-border">
        <div><h1 className="text-3xl font-bold tracking-tight mb-1">Operation København</h1><p className="text-muted-foreground">AI-built European urban strategy simulator</p></div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setLocation("/board/tutorial")}><BookOpen className="mr-2 h-4 w-4" />ELI5 Tutorial</Button>
          <Dialog open={newScenarioOpen} onOpenChange={open => { setNewScenarioOpen(open); if (open) setStep(1); }}>
            <DialogTrigger asChild><Button><Sparkles className="mr-2 h-4 w-4" />New Game with AI</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[680px]">
              <DialogHeader><DialogTitle>New Game · Step {step}/3</DialogTitle><DialogDescription>Choose a real European world, describe the campaign, then let the AI generate storyline, factions, starter assets, shops and skills.</DialogDescription></DialogHeader>
              {step === 1 && <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>European start world</Label><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{EUROPE_PRESETS.map(item => <Button type="button" key={item.id} variant={presetId === item.id ? "default" : "outline"} className="justify-start" onClick={() => setPresetId(item.id)}><Globe2 className="mr-2 h-4 w-4" />{item.city}</Button>)}</div></div>
                <div className="grid grid-cols-2 gap-3"><div><Label>Work area radius (km)</Label><Input type="number" min={1} max={500} value={radius} onChange={e => setRadius(Number(e.target.value))} /></div><div><Label>Map provider</Label><Input value="Google Maps (OpenStreetMap fallback)" readOnly /></div></div>
                <div className="grid gap-2"><Label>Board overlay template</Label><div className="grid grid-cols-2 gap-2">{MAP_TEMPLATES.map(t => <button type="button" key={t.id} className={`border rounded-md p-3 text-left text-sm ${selectedMapTemplate === t.id ? "border-primary bg-primary/10" : "border-border"}`} onClick={() => setSelectedMapTemplate(t.id)}><div className="font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.description}</div></button>)}</div></div>
              </div>}
              {step === 2 && <div className="grid gap-4 py-4"><div className="grid gap-2"><Label>Game name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div><div className="grid gap-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div><div className="grid gap-2"><Label>What should the AI build?</Label><Textarea className="min-h-36" value={premise} onChange={e => setPremise(e.target.value)} /></div></div>}
              {step === 3 && <div className="py-6 space-y-4"><div className="rounded-lg border bg-muted/40 p-4"><h3 className="font-semibold mb-2">AI generation package</h3><p className="text-sm text-muted-foreground">The model will create the opening storyline, factions, assets, shops, skills, first mission and guided tutorial for {preset.city}. A deterministic local package is used if the external model is unavailable.</p></div><div className="text-sm"><strong>World:</strong> {preset.city}, {preset.country} · {radius} km<br/><strong>Map:</strong> Google Maps + board overlay<br/><strong>Content:</strong> Red Team, Blue Team, Nyx, real-case framework, storyline and progression</div></div>}
              <DialogFooter><Button variant="outline" onClick={() => step === 1 ? setNewScenarioOpen(false) : setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</Button>{step < 3 ? <Button onClick={() => setStep(step + 1)} disabled={step === 2 && !name.trim()}>Next</Button> : <Button onClick={() => void generateGame()} disabled={generating}>{generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating world…</> : <><Sparkles className="mr-2 h-4 w-4" />Generate & Start</>}</Button>}</DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /></div> : scenarios?.length === 0 ? <div className="text-center py-20 border border-dashed rounded-xl"><Map className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" /><h3 className="text-lg font-medium mb-2">No saved games</h3><p className="text-muted-foreground mb-6">Start New Game and let the AI build the first storyline, assets and tutorial.</p><Button onClick={() => setNewScenarioOpen(true)}><Plus className="mr-2 h-4 w-4" />New Game</Button></div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{scenarios?.map(scenario => <Link key={scenario.id} href={`/board/${scenario.id}`}><Card className="hover:border-primary/50 cursor-pointer flex flex-col h-full"><CardHeader><div className="flex justify-between"><CardTitle className="text-lg">{scenario.name}</CardTitle><Button variant="ghost" size="icon" onClick={e => handleDelete(scenario.id, e)}><Trash2 className="h-4 w-4" /></Button></div><CardDescription>{scenario.description || "No description"}</CardDescription></CardHeader><CardContent className="flex-grow"><div className="flex items-center text-xs text-muted-foreground"><Map className="mr-2 h-3 w-3" />{MAP_TEMPLATES.find(t => t.id === scenario.mapTemplateId)?.name || "European World"}</div></CardContent><CardFooter className="text-xs text-muted-foreground flex justify-between border-t py-3"><span>Updated {format(new Date(scenario.updatedAt), "MMM d, yyyy")}</span><span className="flex items-center text-primary">Open <ChevronRight className="ml-1 h-3 w-3" /></span></CardFooter></Card></Link>)}</div>}
    </div>
  );
}
