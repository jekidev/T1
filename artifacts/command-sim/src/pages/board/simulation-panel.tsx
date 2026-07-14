import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Brain, Building2, Clock3, Coins, Play, ShieldAlert, Users } from "lucide-react";
import type { BoardState, PlayerTurnAction } from "@/lib/game";

interface SimulationPanelProps {
  board: BoardState;
  onResolve: (action: PlayerTurnAction) => void;
}

const ACTIONS: Array<{ id: PlayerTurnAction["type"]; label: string; description: string }> = [
  { id: "invest", label: "Invest", description: "Spend treasury to improve organizational cohesion." },
  { id: "gather_intelligence", label: "Gather intelligence", description: "Improve intelligence while accepting additional exposure." },
  { id: "reduce_pressure", label: "Reduce pressure", description: "Spend resources to lower suspicion and stabilize legitimacy." },
  { id: "expand_influence", label: "Expand influence", description: "Increase reach with faction-specific legitimacy and suspicion effects." },
  { id: "train", label: "Train", description: "Reserve the turn for skill progression and preparation." },
  { id: "wait", label: "Wait", description: "Advance the world without a targeted player action." },
];

export function SimulationPanel({ board, onResolve }: SimulationPanelProps) {
  const simulation = board.simulation;
  const [actionType, setActionType] = useState<PlayerTurnAction["type"]>("gather_intelligence");
  const [factionId, setFactionId] = useState(simulation?.factions[0]?.id ?? "");
  const selectedAction = useMemo(() => ACTIONS.find(action => action.id === actionType), [actionType]);

  if (!simulation) {
    return <Card><CardHeader><CardTitle className="text-sm">Simulation unavailable</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">This scenario predates the scenario compiler. Create a new AI game or migrate the board to initialize deterministic simulation state.</CardContent></Card>;
  }

  return <div className="h-full overflow-auto p-3 space-y-3 select-text">
    <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Live simulation</h3><p className="text-[10px] text-muted-foreground">Deterministic seed {simulation.seed} · Turn {simulation.turn} · Day {simulation.day}, {String(simulation.hour).padStart(2, "0")}:00</p></div><Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />Turn engine</Badge></div>

    <div className="grid grid-cols-2 gap-2 text-xs">
      <Metric icon={Activity} label="City tension" value={simulation.cityTension} />
      <Metric icon={Brain} label="Evidence" value={simulation.evidenceQuality} />
      <Metric icon={Users} label="Public confidence" value={simulation.publicConfidence} />
      <Metric icon={ShieldAlert} label="Blue coordination" value={simulation.blueTeamCoordination} />
    </div>

    <Card><CardHeader className="pb-2"><CardTitle className="text-xs">Resolve next turn</CardTitle></CardHeader><CardContent className="space-y-2">
      <Select value={actionType} onValueChange={value => setActionType(value as PlayerTurnAction["type"])}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{ACTIONS.map(action => <SelectItem key={action.id} value={action.id}>{action.label}</SelectItem>)}</SelectContent></Select>
      <Select value={factionId} onValueChange={setFactionId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Faction" /></SelectTrigger><SelectContent>{simulation.factions.map(faction => <SelectItem key={faction.id} value={faction.id}>{faction.name}</SelectItem>)}</SelectContent></Select>
      <p className="text-[10px] text-muted-foreground">{selectedAction?.description}</p>
      <Button className="w-full h-8 text-xs" onClick={() => onResolve({ type: actionType, factionId, amount: 10 })}><Play className="mr-2 h-3 w-3" />Resolve turn</Button>
    </CardContent></Card>

    <div className="space-y-2"><h4 className="text-xs font-semibold">Factions</h4>{simulation.factions.map(faction => <div key={faction.id} className="rounded border p-2 text-[10px]"><div className="flex justify-between font-medium"><span>{faction.name}</span><Badge variant={faction.faction === "criminal" ? "destructive" : "outline"} className="text-[9px]">{faction.faction}</Badge></div><div className="mt-1 grid grid-cols-3 gap-1 text-muted-foreground"><span><Coins className="inline h-3 w-3" /> {faction.treasury.toLocaleString()}</span><span><Users className="inline h-3 w-3" /> {faction.personnel}</span><span>Suspicion {faction.suspicion}</span><span>Cohesion {faction.cohesion}</span><span>Intel {faction.intelligence}</span><span>Legitimacy {faction.legitimacy}</span></div></div>)}</div>

    <div className="space-y-2"><h4 className="text-xs font-semibold">Shops</h4>{simulation.shops.map(shop => <div key={shop.id} className="rounded border p-2 text-[10px]"><div className="font-medium"><Building2 className="inline mr-1 h-3 w-3" />{shop.name} · {shop.district}</div><div className="text-muted-foreground">Scarcity {shop.scarcity} · Pressure {shop.pressure} · {shop.inventory.length} inventory items</div></div>)}</div>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return <div className="rounded border p-2"><div className="text-muted-foreground"><Icon className="inline mr-1 h-3 w-3" />{label}</div><div className="text-lg font-semibold">{value}</div></div>;
}
