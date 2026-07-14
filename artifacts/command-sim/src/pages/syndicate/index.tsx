import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  applyDanishSyndicatePreset,
  applySyndicateCommand,
  createSyndicateWorld,
  evaluateSyndicateStrategies,
  selectDeterministicStrategy,
  type SyndicateWorldState,
  type Territory,
} from "@workspace/strategy-sim";
import { ArrowLeft, BriefcaseBusiness, Download, FastForward, Network, Plus, Shield, Users } from "lucide-react";
import { useBoardStore, type SimulationState } from "@/lib/game";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function SyndicatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const board = useBoardStore(state => state.board);
  const loadBoard = useBoardStore(state => state.loadBoard);
  const scenarioId = useBoardStore(state => state.scenarioId);
  const scenarioName = useBoardStore(state => state.scenarioName);
  const scenarioDescription = useBoardStore(state => state.scenarioDescription);
  const [name, setName] = useState("Nordhavn Council");
  const [leader, setLeader] = useState("npc-council-lead");
  const [member, setMember] = useState("npc-associate-1");
  const [roleId, setRoleId] = useState("role-associate");
  const world = board.simulation?.syndicateWorld;
  const selected = world?.syndicates[0];
  const strategies = useMemo(() => selected && world ? evaluateSyndicateStrategies(world, selected.id) : [], [selected, world]);

  const saveWorld = (nextWorld: SyndicateWorldState, resolution: string) => {
    const simulation = board.simulation ?? createSimulation(nextWorld.seed);
    loadBoard({ ...board, simulation: { ...simulation, syndicateWorld: nextWorld, lastResolution: resolution } }, scenarioId, scenarioName, scenarioDescription);
  };

  const initialize = () => {
    try {
      const syndicateId = `syndicate-${safeId(name)}`;
      const leaderId = safeId(leader);
      let next = createSyndicateWorld(board.simulation?.seed ?? 1977, [createTerritory(board.world)]);
      next = applySyndicateCommand(next, { type: "create_syndicate", commandId: `create-${syndicateId}`, tick: 0, syndicateId, name: name.trim(), leaderNpcId: leaderId });
      next.syndicates = next.syndicates.map(item => item.id === syndicateId ? applyDanishSyndicatePreset(item) : item);
      next.sourceCases = board.generatedContent?.sourceCases.map((title, index) => ({
        id: `case-${index}-${safeId(title)}`,
        title,
        institution: "Source institution pending verification",
        jurisdiction: board.world?.country ?? "Europe",
        verified: false,
        patternTags: ["real-case-inspired", "fictional-people"],
        fictionalizationRule: "Use documented structural patterns and real institutions only. All private people and gameplay participants remain fictional.",
      })) ?? [];
      saveWorld(next, `${name.trim()} was initialized as a fictional decentralized faction.`);
      toast({ title: "Fictional faction created", description: `${name.trim()} · ${next.territories.length} territory region(s)` });
    } catch (error) {
      toast({ title: "Cannot create faction", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const recruit = () => {
    if (!world || !selected) return;
    try {
      const npcId = safeId(member);
      const next = applySyndicateCommand(world, {
        type: "recruit_member",
        commandId: `recruit-${npcId}-${world.tick}`,
        tick: world.tick,
        syndicateId: selected.id,
        npcId,
        roleId,
        salary: 45,
        loyalty: 55,
        ambition: 50,
        fear: 15,
        trust: 55,
        satisfaction: 55,
        ideologicalAlignment: 50,
        heart: 60,
        competence: 55,
      });
      saveWorld(next, `${npcId} joined ${selected.name}.`);
    } catch (error) {
      toast({ title: "Recruitment rejected", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const advance = () => {
    if (!world) return;
    const next = applySyndicateCommand(world, { type: "advance_tick", commandId: `advance-${world.tick}`, tick: world.tick, ticks: 1 });
    saveWorld(next, `Syndicate simulation advanced to tick ${next.tick}.`);
  };

  const autoStrategy = () => {
    if (!world || !selected) return;
    const recommendation = selectDeterministicStrategy(world, selected.id);
    const next = applySyndicateCommand(world, { type: "choose_strategy", commandId: `strategy-${world.tick}-${recommendation.strategy}`, tick: world.tick, syndicateId: selected.id, strategy: recommendation.strategy, reason: recommendation.reasons.join("; ") });
    saveWorld(next, `${selected.name} selected ${recommendation.strategy}.`);
  };

  const influence = (territoryId: string) => {
    if (!world || !selected) return;
    try {
      const next = applySyndicateCommand(world, {
        type: "influence_territory",
        commandId: `influence-${territoryId}-${world.tick}`,
        tick: world.tick,
        syndicateId: selected.id,
        territoryId,
        approach: "community_presence",
        resourceSpend: { capital: 2_000, supplies: 1, workforce: 1, intelligence: 0, influence: 1 },
      });
      saveWorld(next, `${selected.name} increased fictional influence in ${territoryId}.`);
    } catch (error) {
      toast({ title: "Influence command rejected", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const exportBrief = () => {
    if (!world) return;
    const payload = {
      title: `Employee syndicate brief — ${scenarioName}`,
      generatedAt: new Date().toISOString(),
      warning: "Fictional gameplay organization. Real-case references and institutions must be source-verified; all people are fictional.",
      world,
    };
    downloadJson(`syndicate-employee-brief-${safeId(scenarioName)}.json`, payload);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => setLocation(`/board/${scenarioId ?? "tutorial"}`)}><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-xl font-semibold">Fictional Syndicate Dashboard</h1><p className="text-xs text-muted-foreground">Deterministic commands, decentralized council structure, territory, economy, loyalty and replay</p></div></div>
          <div className="flex gap-2"><Button variant="outline" disabled={!world} onClick={exportBrief}><Download className="mr-2 h-4 w-4" />Employee brief</Button><Button variant="outline" disabled={!world} onClick={advance}><FastForward className="mr-2 h-4 w-4" />Advance tick</Button></div>
        </header>

        {!world || !selected ? <Card><CardHeader><CardTitle>Create a fictional faction</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><div><Label>Faction name</Label><Input value={name} onChange={event => setName(event.target.value)} /></div><div><Label>Fictional leader NPC id</Label><Input value={leader} onChange={event => setLeader(event.target.value)} /></div><Button className="self-end" onClick={initialize}><Plus className="mr-2 h-4 w-4" />Create</Button><p className="md:col-span-3 text-xs text-muted-foreground">The preset uses a Danish decentralized council and district-team structure. Religion, ethnicity, diagnosis, disability, recovery and substance-use history never modify criminality, aggression, honesty, competence or loyalty.</p></CardContent></Card> : <>
          <div className="grid gap-3 md:grid-cols-4"><Metric label="Tick" value={world.tick} /><Metric label="Internal loyalty" value={Math.round(selected.internalLoyalty)} suffix="%" /><Metric label="Public legitimacy" value={Math.round(selected.power.publicLegitimacy)} suffix="%" /><Metric label="Strategy" value={selected.activeStrategy} /></div>
          <Tabs defaultValue="hierarchy" className="space-y-3">
            <TabsList className="h-auto w-full flex-wrap justify-start"><TabsTrigger value="hierarchy">Hierarchy</TabsTrigger><TabsTrigger value="territory">Territory</TabsTrigger><TabsTrigger value="economy">Economy</TabsTrigger><TabsTrigger value="members">Members</TabsTrigger><TabsTrigger value="relationships">Relationships</TabsTrigger><TabsTrigger value="intelligence">Intelligence</TabsTrigger><TabsTrigger value="businesses">Businesses</TabsTrigger><TabsTrigger value="events">Events</TabsTrigger><TabsTrigger value="reputation">Reputation</TabsTrigger><TabsTrigger value="strategy">Strategy</TabsTrigger></TabsList>

            <TabsContent value="hierarchy"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-4 w-4" />Council and district structure</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-3">{selected.hierarchy.sort((a, b) => b.successionPriority - a.successionPriority).map(role => <div key={role.id} className="rounded border p-3"><div className="font-medium">{role.title}</div><div className="text-[10px] text-muted-foreground">Access {role.accessLevel} · upkeep {role.upkeep} · succession {role.successionPriority}</div><p className="mt-2 text-xs">{role.responsibilities.join("; ")}</p></div>)}</CardContent></Card></TabsContent>

            <TabsContent value="territory"><div className="grid gap-3 md:grid-cols-2">{world.territories.map(territory => <Card key={territory.id}><CardHeader><CardTitle className="text-sm">{territory.name}</CardTitle></CardHeader><CardContent className="space-y-2 text-xs"><div>Visibility: <Badge variant="outline">{territory.visibility}</Badge></div><div>Owner: {territory.ownerFactionId ?? "contested"}</div><div>Prosperity {Math.round(territory.prosperity)} · stability {Math.round(territory.stability)}</div><div>Influence: {Math.round(territory.influenceByFaction[selected.id] ?? 0)}%</div><Button size="sm" onClick={() => influence(territory.id)}>Increase community presence</Button></CardContent></Card>)}</div></TabsContent>

            <TabsContent value="economy"><Card><CardHeader><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4" />Generic resources</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-5">{Object.entries(selected.resources).map(([key, value]) => <Metric key={key} label={key} value={Math.round(value)} />)}</CardContent></Card></TabsContent>

            <TabsContent value="members"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Members and role assignment</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 md:grid-cols-[1fr_220px_auto]"><Input value={member} onChange={event => setMember(event.target.value)} placeholder="fictional NPC id" /><select className="rounded border bg-background px-2 text-sm" value={roleId} onChange={event => setRoleId(event.target.value)}>{selected.hierarchy.map(role => <option key={role.id} value={role.id}>{role.title}</option>)}</select><Button onClick={recruit}>Recruit</Button></div><div className="grid gap-2 md:grid-cols-2">{world.memberships.filter(item => item.syndicateId === selected.id).map(item => <div key={`${item.syndicateId}-${item.npcId}`} className="rounded border p-3 text-xs"><strong>{item.npcId}</strong><div>{selected.hierarchy.find(role => role.id === item.roleId)?.title ?? item.roleId}</div><div className="text-muted-foreground">Loyalty {Math.round(item.loyalty)} · trust {Math.round(item.trust)} · satisfaction {Math.round(item.satisfaction)} · competence {Math.round(item.competence)}</div></div>)}</div></CardContent></Card></TabsContent>

            <TabsContent value="relationships"><Card><CardContent className="space-y-2 p-4">{Object.keys(selected.relationships).length === 0 ? <p className="text-sm text-muted-foreground">No faction agreements or grievances yet.</p> : Object.entries(selected.relationships).map(([id, relation]) => <div key={id} className="rounded border p-3 text-xs"><strong>{id}</strong> · {relation.status} · trust {Math.round(relation.trust)} · respect {Math.round(relation.respect)} · hostility {Math.round(relation.hostility)}</div>)}</CardContent></Card></TabsContent>

            <TabsContent value="intelligence"><Card><CardHeader><CardTitle>Information capacity</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><Metric label="Capacity" value={Math.round(selected.power.intelligenceCapacity)} suffix="%" /><Metric label="Resource" value={Math.round(selected.resources.intelligence)} /><Metric label="Public pressure" value={Math.round(selected.publicPressure)} suffix="%" /><p className="md:col-span-3 text-xs text-muted-foreground">Fog of war and faction knowledge remain authoritative. The LLM may explain or suggest strategy but cannot reveal unseen state or mutate it directly.</p></CardContent></Card></TabsContent>

            <TabsContent value="businesses"><div className="grid gap-3 md:grid-cols-2">{world.businesses.length === 0 ? <Card><CardContent className="p-4 text-sm text-muted-foreground">No generic fictional businesses have been established.</CardContent></Card> : world.businesses.map(business => <Card key={business.id}><CardContent className="p-4 text-xs"><strong>{business.name}</strong><div>{business.category} · level {business.level} · territory {business.territoryId}</div></CardContent></Card>)}</div></TabsContent>

            <TabsContent value="events"><Card><CardContent className="max-h-[600px] space-y-1 overflow-auto p-4">{[...world.events].reverse().map(event => <div key={event.deterministicKey} className="grid grid-cols-[70px_1fr] gap-2 border-b py-2 text-xs"><span className="font-mono">tick {event.tick}</span><div><strong>{event.type}</strong><p className="text-muted-foreground">{event.summary}</p></div></div>)}</CardContent></Card></TabsContent>

            <TabsContent value="reputation"><Card><CardContent className="grid gap-3 p-4 md:grid-cols-4"><Metric label="Influence" value={Math.round(selected.influence)} /><Metric label="Legitimacy" value={Math.round(selected.legitimacy)} /><Metric label="Fear" value={Math.round(selected.power.fear)} /><Metric label="Stability" value={Math.round(selected.power.organizationalStability)} /></CardContent></Card></TabsContent>

            <TabsContent value="strategy"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Deterministic strategy evaluator</CardTitle><Button onClick={autoStrategy}>Choose highest utility</Button></div></CardHeader><CardContent className="space-y-2">{strategies.map(item => <div key={item.strategy} className="rounded border p-3 text-xs"><div className="flex justify-between"><strong>{item.strategy}</strong><span>{Math.round(item.utility)}%</span></div><p className="text-muted-foreground">{item.reasons.join("; ")}</p></div>)}</CardContent></Card></TabsContent>
          </Tabs>
        </>}
      </div>
    </div>
  );
}

function createTerritory(world: { city: string; latitude: number; longitude: number; workAreaRadiusKm: number } | undefined): Territory {
  const latitude = world?.latitude ?? 55.6761;
  const longitude = world?.longitude ?? 12.5683;
  const delta = Math.max(0.01, (world?.workAreaRadiusKm ?? 5) / 111);
  return {
    id: `territory-${safeId(world?.city ?? "copenhagen")}`,
    name: `${world?.city ?? "Copenhagen"} Region`,
    bounds: { type: "Polygon", coordinates: [[[longitude - delta, latitude - delta], [longitude + delta, latitude - delta], [longitude + delta, latitude + delta], [longitude - delta, latitude + delta], [longitude - delta, latitude - delta]]] },
    influenceByFaction: {},
    population: 100_000,
    prosperity: 60,
    stability: 65,
    visibility: "rumored",
    locationIds: [],
    resourceModifiers: { capital: 1, supplies: 1, workforce: 1, intelligence: 1, influence: 1 },
    loyaltyByFaction: {},
    eventPressure: 8,
    lastChangedAtTick: 0,
  };
}

function createSimulation(seed: number): SimulationState {
  return { seed, turn: 0, day: 1, hour: 8, publicConfidence: 65, mediaPressure: 10, blueTeamCoordination: 15, evidenceQuality: 10, cityTension: 20, economyIndex: 100, factions: [], shops: [], skills: [] };
}

function Metric({ label, value, suffix = "" }: { label: string; value: string | number; suffix?: string }) {
  return <Card><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 break-words text-lg font-semibold">{value}{suffix}</div></CardContent></Card>;
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "item";
}

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
