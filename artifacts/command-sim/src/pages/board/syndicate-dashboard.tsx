import { useEffect, useMemo, useState } from "react";
import {
  applySyndicateCommand,
  createSyndicateWorld,
  evaluateSyndicateStrategies,
  type Syndicate,
  type SyndicateRole,
  type SyndicateWorldState,
  type Territory,
} from "@workspace/strategy-sim";
import type { BoardState } from "@/lib/game";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Download,
  Handshake,
  Landmark,
  Network,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";

interface SyndicateDashboardProps {
  open: boolean;
  board: BoardState;
  onClose: () => void;
  onChange: (board: BoardState) => void;
}

export function SyndicateDashboard({ open, board, onClose, onChange }: SyndicateDashboardProps) {
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("New Fictional Network");
  const [leaderNpcId, setLeaderNpcId] = useState("");
  const [recruitNpcId, setRecruitNpcId] = useState("");
  const [recruitRoleId, setRecruitRoleId] = useState("role-associate");
  const world = board.simulation?.syndicateWorld;
  const selected = world?.syndicates.find(item => item.id === selectedId) ?? world?.syndicates[0];
  const playerNpcCandidates = board.entities.filter(entity => entity.category === "unit");

  useEffect(() => {
    if (selected?.id && selected.id !== selectedId) setSelectedId(selected.id);
    if (!leaderNpcId && playerNpcCandidates[0]) setLeaderNpcId(playerNpcCandidates[0].id);
    if (!recruitNpcId && playerNpcCandidates[0]) setRecruitNpcId(playerNpcCandidates[0].id);
  }, [leaderNpcId, playerNpcCandidates, recruitNpcId, selected, selectedId]);

  const strategyEvaluations = useMemo(
    () => world && selected ? evaluateSyndicateStrategies(world, selected.id) : [],
    [selected, world],
  );

  if (!open) return null;

  const updateWorld = (nextWorld: SyndicateWorldState) => {
    if (!board.simulation) return;
    onChange({ ...board, simulation: { ...board.simulation, syndicateWorld: nextWorld } });
  };

  const ensureWorld = (): SyndicateWorldState => world ?? createSyndicateWorld(board.simulation?.seed ?? 1, territoriesFromBoard(board));

  const createFaction = () => {
    if (!newName.trim() || !leaderNpcId) return;
    const current = ensureWorld();
    const id = `syndicate-${slug(newName)}-${current.syndicates.length + 1}`;
    const next = applySyndicateCommand(current, {
      type: "create_syndicate",
      commandId: `ui-create-${current.tick}-${id}`,
      tick: current.tick,
      syndicateId: id,
      name: newName.trim(),
      leaderNpcId,
    });
    updateWorld(next);
    setSelectedId(id);
  };

  const recruit = () => {
    if (!world || !selected || !recruitNpcId) return;
    const next = applySyndicateCommand(world, {
      type: "recruit_member",
      commandId: `ui-recruit-${world.tick}-${selected.id}-${recruitNpcId}`,
      tick: world.tick,
      syndicateId: selected.id,
      npcId: recruitNpcId,
      roleId: recruitRoleId,
      salary: 30,
      loyalty: 50,
      ambition: 50,
      fear: 20,
      trust: 50,
      satisfaction: 50,
      ideologicalAlignment: 50,
      heart: 50,
      competence: 50,
    });
    updateWorld(next);
  };

  const chooseStrategy = (strategy: Syndicate["activeStrategy"]) => {
    if (!world || !selected) return;
    updateWorld(applySyndicateCommand(world, {
      type: "choose_strategy",
      commandId: `ui-strategy-${world.tick}-${selected.id}-${strategy}`,
      tick: world.tick,
      syndicateId: selected.id,
      strategy,
      reason: "Selected by the player from the syndicate dashboard.",
    }));
  };

  const influenceTerritory = (territoryId: string) => {
    if (!world || !selected) return;
    const capital = Math.min(10_000, selected.resources.capital);
    const influence = Math.min(3, selected.resources.influence);
    updateWorld(applySyndicateCommand(world, {
      type: "influence_territory",
      commandId: `ui-influence-${world.tick}-${selected.id}-${territoryId}`,
      tick: world.tick,
      syndicateId: selected.id,
      territoryId,
      approach: "community_presence",
      resourceSpend: { capital, supplies: 0, workforce: 0, intelligence: 0, influence },
    }));
  };

  const downloadEmployeeBrief = () => {
    if (!world || !selected) return;
    const memberships = world.memberships.filter(item => item.syndicateId === selected.id);
    const brief = [
      `# ${selected.name} — Employee Gameplay Brief`,
      "",
      `Generated: ${new Date().toISOString()}`,
      `World tick: ${world.tick}`,
      `Active strategy: ${selected.activeStrategy}`,
      `Public legitimacy: ${selected.power.publicLegitimacy.toFixed(1)}`,
      `Organizational stability: ${selected.power.organizationalStability.toFixed(1)}`,
      `Internal loyalty: ${selected.internalLoyalty.toFixed(1)}`,
      "",
      "## Resources",
      ...Object.entries(selected.resources).map(([key, value]) => `- ${key}: ${Math.round(value)}`),
      "",
      "## Roles and responsibilities",
      ...selected.hierarchy.map(role => `### ${role.title}\n${role.responsibilities.map(item => `- ${item}`).join("\n")}`),
      "",
      "## Current members",
      ...memberships.map(member => {
        const role = selected.hierarchy.find(item => item.id === member.roleId)?.title ?? member.roleId;
        return `- ${member.npcId}: ${role}; loyalty ${member.loyalty.toFixed(1)}; satisfaction ${member.satisfaction.toFixed(1)}`;
      }),
      "",
      "This export contains fictional game state only. It excludes hidden intelligence, private RAG documents, secrets and protected operational data.",
    ].join("\n");
    downloadText(`${slug(selected.name)}-employee-brief.md`, brief);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div>
            <h2 className="font-semibold">Fictional Syndicate Command</h2>
            <p className="text-[10px] text-muted-foreground">Deterministic factions, territory, economy, loyalty, relationships and strategy</p>
          </div>
          <div className="flex items-center gap-2">
            {selected && <Button variant="outline" size="sm" onClick={downloadEmployeeBrief}><Download className="mr-1 h-3.5 w-3.5" />Employee brief</Button>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </header>

        <div className="grid flex-1 min-h-0 grid-cols-[280px_1fr]">
          <aside className="overflow-auto border-r p-3 space-y-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs">Create faction</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div><Label className="text-[10px]">Name</Label><Input className="h-8 text-xs" value={newName} onChange={event => setNewName(event.target.value)} /></div>
                <div><Label className="text-[10px]">Fictional leader NPC</Label><Select value={leaderNpcId} onValueChange={setLeaderNpcId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="NPC" /></SelectTrigger><SelectContent>{playerNpcCandidates.map(entity => <SelectItem key={entity.id} value={entity.id}>{entity.label}</SelectItem>)}</SelectContent></Select></div>
                <Button className="w-full h-8 text-xs" onClick={createFaction}><Sparkles className="mr-1 h-3.5 w-3.5" />Create faction</Button>
              </CardContent>
            </Card>

            <div className="space-y-1">
              {(world?.syndicates ?? []).map(syndicate => <button type="button" key={syndicate.id} className={`w-full rounded border p-2 text-left text-xs ${selected?.id === syndicate.id ? "border-primary bg-primary/10" : ""}`} onClick={() => setSelectedId(syndicate.id)}><div className="font-medium">{syndicate.name}</div><div className="mt-1 text-[9px] text-muted-foreground">{syndicate.memberIds.length} members · {syndicate.controlledTerritoryIds.length} territories</div></button>)}
            </div>
          </aside>

          <main className="min-w-0 overflow-auto p-4">
            {!selected || !world ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Create or select a fictional faction.</div> : (
              <Tabs defaultValue="hierarchy" className="space-y-4">
                <TabsList className="h-auto flex-wrap justify-start">
                  {[
                    ["hierarchy", "Hierarchy"], ["territory", "Territory"], ["economy", "Economy"], ["members", "Members"], ["relationships", "Relationships"],
                    ["intelligence", "Intelligence"], ["businesses", "Businesses"], ["events", "Events"], ["reputation", "Reputation"], ["strategy", "Strategy"],
                  ].map(([value, label]) => <TabsTrigger key={value} value={value} className="text-xs">{label}</TabsTrigger>)}
                </TabsList>

                <TabsContent value="hierarchy"><HierarchyTab roles={selected.hierarchy} world={world} syndicate={selected} /></TabsContent>
                <TabsContent value="territory"><TerritoryTab world={world} syndicate={selected} onInfluence={influenceTerritory} /></TabsContent>
                <TabsContent value="economy"><EconomyTab syndicate={selected} /></TabsContent>
                <TabsContent value="members">
                  <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                    <Card><CardHeader><CardTitle className="text-xs">Recruit NPC</CardTitle></CardHeader><CardContent className="space-y-2"><Select value={recruitNpcId} onValueChange={setRecruitNpcId}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{playerNpcCandidates.filter(entity => !selected.memberIds.includes(entity.id)).map(entity => <SelectItem key={entity.id} value={entity.id}>{entity.label}</SelectItem>)}</SelectContent></Select><Select value={recruitRoleId} onValueChange={setRecruitRoleId}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{selected.hierarchy.map(role => <SelectItem key={role.id} value={role.id}>{role.title}</SelectItem>)}</SelectContent></Select><Button className="w-full h-8 text-xs" onClick={recruit}><Users className="mr-1 h-3.5 w-3.5" />Recruit</Button></CardContent></Card>
                    <MembersTab world={world} syndicate={selected} />
                  </div>
                </TabsContent>
                <TabsContent value="relationships"><RelationshipsTab syndicate={selected} /></TabsContent>
                <TabsContent value="intelligence"><MetricGrid values={{ intelligenceCapacity: selected.power.intelligenceCapacity, informationResource: selected.resources.intelligence, publicPressure: selected.publicPressure }} /></TabsContent>
                <TabsContent value="businesses"><BusinessesTab world={world} syndicate={selected} /></TabsContent>
                <TabsContent value="events"><EventsTab world={world} syndicate={selected} /></TabsContent>
                <TabsContent value="reputation"><MetricGrid values={{ ...selected.reputation, publicLegitimacy: selected.power.publicLegitimacy, socialInfluence: selected.power.socialInfluence, fear: selected.power.fear }} /></TabsContent>
                <TabsContent value="strategy"><StrategyTab syndicate={selected} evaluations={strategyEvaluations} onSelect={chooseStrategy} /></TabsContent>
              </Tabs>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function HierarchyTab({ roles, world, syndicate }: { roles: SyndicateRole[]; world: SyndicateWorldState; syndicate: Syndicate }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[...roles].sort((a, b) => b.successionPriority - a.successionPriority).map(role => { const members = world.memberships.filter(item => item.syndicateId === syndicate.id && item.roleId === role.id); return <Card key={role.id}><CardHeader className="pb-2"><div className="flex justify-between gap-2"><CardTitle className="text-xs">{role.title}</CardTitle><Badge variant="outline">L{role.accessLevel}</Badge></div></CardHeader><CardContent className="text-[10px] space-y-1"><p>{role.responsibilities.join(" · ")}</p><p className="text-muted-foreground">Upkeep {role.upkeep} · succession {role.successionPriority}</p><p>{members.length} assigned</p></CardContent></Card>; })}</div>;
}

function TerritoryTab({ world, syndicate, onInfluence }: { world: SyndicateWorldState; syndicate: Syndicate; onInfluence: (id: string) => void }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{world.territories.map(territory => <Card key={territory.id}><CardHeader className="pb-2"><div className="flex justify-between gap-2"><CardTitle className="text-xs"><Landmark className="mr-1 inline h-3.5 w-3.5" />{territory.name}</CardTitle><Badge variant="outline">{territory.visibility}</Badge></div></CardHeader><CardContent className="space-y-2 text-[10px]"><MetricBar label="Influence" value={territory.influenceByFaction[syndicate.id] ?? 0} /><MetricBar label="Loyalty" value={territory.loyaltyByFaction[syndicate.id] ?? 0} /><MetricBar label="Stability" value={territory.stability} /><p className="text-muted-foreground">Population {territory.population.toLocaleString()} · prosperity {territory.prosperity}</p><Button size="sm" variant="outline" className="h-7 w-full text-[10px]" onClick={() => onInfluence(territory.id)}>Influence through community presence</Button></CardContent></Card>)}</div>;
}

function EconomyTab({ syndicate }: { syndicate: Syndicate }) {
  return <div className="space-y-4"><MetricGrid values={syndicate.resources} /><MetricGrid values={syndicate.power} /></div>;
}

function MembersTab({ world, syndicate }: { world: SyndicateWorldState; syndicate: Syndicate }) {
  return <div className="grid gap-2 md:grid-cols-2">{world.memberships.filter(item => item.syndicateId === syndicate.id).map(member => <Card key={member.npcId}><CardContent className="p-3 text-[10px]"><div className="flex justify-between"><strong>{member.npcId}</strong><Badge variant="outline">{syndicate.hierarchy.find(role => role.id === member.roleId)?.title ?? member.roleId}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2"><MetricBar label="Loyalty" value={member.loyalty} /><MetricBar label="Trust" value={member.trust} /><MetricBar label="Heart" value={member.heart} /><MetricBar label="Competence" value={member.competence} /></div></CardContent></Card>)}</div>;
}

function RelationshipsTab({ syndicate }: { syndicate: Syndicate }) {
  const entries = Object.entries(syndicate.relationships);
  if (entries.length === 0) return <Card><CardContent className="p-6 text-xs text-muted-foreground">No faction relationships have been established.</CardContent></Card>;
  return <div className="grid gap-3 md:grid-cols-2">{entries.map(([id, relationship]) => <Card key={id}><CardHeader className="pb-2"><div className="flex justify-between"><CardTitle className="text-xs"><Handshake className="mr-1 inline h-3.5 w-3.5" />{id}</CardTitle><Badge>{relationship.status}</Badge></div></CardHeader><CardContent className="grid grid-cols-2 gap-2"><MetricBar label="Trust" value={relationship.trust} /><MetricBar label="Respect" value={relationship.respect} /><MetricBar label="Fear" value={relationship.fear} /><MetricBar label="Hostility" value={relationship.hostility} /></CardContent></Card>)}</div>;
}

function BusinessesTab({ world, syndicate }: { world: SyndicateWorldState; syndicate: Syndicate }) {
  const businesses = world.businesses.filter(item => item.ownerSyndicateId === syndicate.id);
  if (businesses.length === 0) return <Card><CardContent className="p-6 text-xs text-muted-foreground">No generic fictional businesses yet. Establishment is available through validated commands after sufficient territory influence.</CardContent></Card>;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{businesses.map(item => <Card key={item.id}><CardHeader className="pb-2"><CardTitle className="text-xs"><Building2 className="mr-1 inline h-3.5 w-3.5" />{item.name}</CardTitle></CardHeader><CardContent className="text-[10px]"><p>{item.category} · level {item.level}</p><p className="text-muted-foreground">Upkeep {item.capitalUpkeep} · workforce {item.workforceRequired}</p><p>{item.enabled ? "Active" : "Paused"}</p></CardContent></Card>)}</div>;
}

function EventsTab({ world, syndicate }: { world: SyndicateWorldState; syndicate: Syndicate }) {
  return <div className="space-y-1">{[...world.events].reverse().filter(event => event.factionIds.includes(syndicate.id)).slice(0, 100).map(event => <div key={event.id} className="grid grid-cols-[70px_150px_1fr] gap-2 rounded border p-2 text-[10px]"><span className="font-mono">T{event.tick}</span><span>{event.type}</span><span>{event.summary}</span></div>)}</div>;
}

function StrategyTab({ syndicate, evaluations, onSelect }: { syndicate: Syndicate; evaluations: ReturnType<typeof evaluateSyndicateStrategies>; onSelect: (strategy: Syndicate["activeStrategy"]) => void }) {
  return <div className="grid gap-3 md:grid-cols-2">{evaluations.map(item => <Card key={item.strategy} className={syndicate.activeStrategy === item.strategy ? "border-primary" : ""}><CardHeader className="pb-2"><div className="flex justify-between"><CardTitle className="text-xs"><Network className="mr-1 inline h-3.5 w-3.5" />{item.strategy}</CardTitle><Badge variant="outline">{item.utility.toFixed(1)}</Badge></div></CardHeader><CardContent className="space-y-2 text-[10px]"><p>{item.reasons.join(" · ")}</p><Button size="sm" variant={syndicate.activeStrategy === item.strategy ? "default" : "outline"} className="h-7 w-full text-[10px]" onClick={() => onSelect(item.strategy)}>{syndicate.activeStrategy === item.strategy ? "Active" : "Select strategy"}</Button></CardContent></Card>)}</div>;
}

function MetricGrid({ values }: { values: Record<string, number> }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(values).map(([label, value]) => <Card key={label}><CardContent className="p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{Number(value).toFixed(1)}</div></CardContent></Card>)}</div>;
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(100, value));
  return <div className="text-[9px]"><div className="mb-1 flex justify-between"><span>{label}</span><span>{normalized.toFixed(1)}</span></div><div className="h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${normalized}%` }} /></div></div>;
}

function territoriesFromBoard(board: BoardState): Territory[] {
  return board.zones.map(zone => ({
    id: `territory-${zone.id}`,
    name: zone.name,
    bounds: { type: "Polygon", coordinates: [[[zone.x, zone.y], [zone.x + zone.width, zone.y], [zone.x + zone.width, zone.y + zone.height], [zone.x, zone.y + zone.height], [zone.x, zone.y]]] },
    influenceByFaction: {},
    population: 20_000,
    prosperity: 50,
    stability: 60,
    visibility: "unknown",
    locationIds: board.entities.filter(entity => entity.zoneId === zone.id).map(entity => entity.id),
    resourceModifiers: { capital: 1, supplies: 1, workforce: 1, intelligence: 1, influence: 1 },
    loyaltyByFaction: {},
    eventPressure: 10,
    lastChangedAtTick: 0,
  }));
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "syndicate";
}
