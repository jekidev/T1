import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Brain, Building2, Clock3, Coins, Gauge, Play, Scale, ShieldAlert, Users } from "lucide-react";
import { ensureTeamDynamics, moralSpectrumLabel, type BoardState, type PlayerTurnAction, type TeamPulse } from "@/lib/game";
import type { BoardBlackmailAction } from "@/lib/strategy/boardStrategyBridge";
import { BlackmailPanel } from "./blackmail-panel";

interface SimulationPanelProps {
  board: BoardState;
  onResolve: (action: PlayerTurnAction) => void;
  onBlackmail: (action: BoardBlackmailAction) => void;
}

const ACTIONS: Array<{ id: PlayerTurnAction["type"]; label: string; description: string }> = [
  { id: "invest", label: "Invest", description: "Spend treasury to improve organizational cohesion." },
  { id: "gather_intelligence", label: "Gather intelligence", description: "Improve intelligence while accepting additional exposure." },
  { id: "reduce_pressure", label: "Reduce pressure", description: "Spend resources to lower suspicion and stabilize legitimacy." },
  { id: "expand_influence", label: "Expand influence", description: "Increase reach with faction-specific legitimacy, spectrum and risk effects." },
  { id: "train", label: "Train", description: "Reserve the turn for skill progression, morale and preparation." },
  { id: "wait", label: "Wait", description: "Advance the world without a targeted player action." },
];

export function SimulationPanel({ board, onResolve, onBlackmail }: SimulationPanelProps) {
  const simulation = board.simulation;
  const [actionType, setActionType] = useState<PlayerTurnAction["type"]>("gather_intelligence");
  const [factionId, setFactionId] = useState(simulation?.factions[0]?.id ?? "");
  const selectedAction = useMemo(() => ACTIONS.find(action => action.id === actionType), [actionType]);

  useEffect(() => {
    if (!simulation?.factions.some(faction => faction.id === factionId)) {
      setFactionId(simulation?.factions[0]?.id ?? "");
    }
  }, [simulation, factionId]);

  if (!simulation) {
    return <Card><CardHeader><CardTitle className="text-sm">Simulation unavailable</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">This scenario predates the scenario compiler. Create a new AI game or migrate the board to initialize deterministic simulation state.</CardContent></Card>;
  }

  const dynamics = ensureTeamDynamics(simulation);
  const profile = dynamics.userProfile;

  return <div className="h-full overflow-auto p-3 space-y-3 select-text">
    <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Live simulation</h3><p className="text-[10px] text-muted-foreground">Deterministic seed {simulation.seed} · Turn {simulation.turn} · Day {simulation.day}, {String(simulation.hour).padStart(2, "0")}:00</p></div><Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />Turn engine</Badge></div>

    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-xs"><span><Gauge className="mr-1 inline h-3.5 w-3.5" />Realtime Red / Blue estimate</span><Badge variant="outline">Confidence {dynamics.red.confidence.toFixed(1)}%</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-4 overflow-hidden rounded bg-muted text-[9px] font-semibold leading-4">
          <div className="bg-destructive/80 text-destructive-foreground text-center" style={{ width: `${dynamics.red.estimatedSuccess}%` }}>Red {dynamics.red.estimatedSuccess.toFixed(1)}%</div>
          <div className="bg-primary/80 text-primary-foreground text-center" style={{ width: `${dynamics.blue.estimatedSuccess}%` }}>Blue {dynamics.blue.estimatedSuccess.toFixed(1)}%</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TeamPulseCard title="Red Team" pulse={dynamics.red} />
          <TeamPulseCard title="Blue Team" pulse={dynamics.blue} />
        </div>
        <div className="rounded border p-2 text-[10px]">
          <div className="flex items-center justify-between"><span className="font-medium">Your live spectrum</span><strong>{profile.currentSpectrum.toFixed(1)}/100</strong></div>
          <SpectrumBar value={profile.currentSpectrum} />
          <div className="mt-1 flex justify-between text-muted-foreground"><span>{profile.side} perspective</span><span>{moralSpectrumLabel(profile.currentSpectrum)}</span></div>
          <div className="mt-1 grid grid-cols-3 gap-1 text-muted-foreground"><span>Karma {profile.karma.toFixed(1)}</span><span>Risk {profile.riskIndex.toFixed(1)}</span><span>Last Δ {profile.lastChange >= 0 ? "+" : ""}{profile.lastChange.toFixed(1)}</span></div>
        </div>
      </CardContent>
    </Card>

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

    <BlackmailPanel board={board} actorFactionId={factionId} onAction={onBlackmail} />

    <div className="space-y-2"><h4 className="text-xs font-semibold">Factions</h4>{simulation.factions.map(faction => <div key={faction.id} className="rounded border p-2 text-[10px]"><div className="flex justify-between font-medium"><span>{faction.name}</span><Badge variant={faction.faction === "criminal" ? "destructive" : "outline"} className="text-[9px]">{faction.faction}</Badge></div><div className="mt-1 grid grid-cols-3 gap-1 text-muted-foreground"><span><Coins className="inline h-3 w-3" /> {faction.treasury.toLocaleString()}</span><span><Users className="inline h-3 w-3" /> {faction.personnel}</span><span>Suspicion {faction.suspicion}</span><span>Cohesion {faction.cohesion}</span><span>Intel {faction.intelligence}</span><span>Legitimacy {faction.legitimacy}</span></div></div>)}</div>

    <div className="space-y-2"><h4 className="text-xs font-semibold">Shops</h4>{simulation.shops.map(shop => <div key={shop.id} className="rounded border p-2 text-[10px]"><div className="font-medium"><Building2 className="inline mr-1 h-3 w-3" />{shop.name} · {shop.district}</div><div className="text-muted-foreground">Scarcity {shop.scarcity} · Pressure {shop.pressure} · {shop.inventory.length} inventory items</div></div>)}</div>
  </div>;
}

function TeamPulseCard({ title, pulse }: { title: string; pulse: TeamPulse }) {
  return <div className="rounded border p-2 text-[10px]">
    <div className="flex justify-between font-medium"><span>{title}</span><span>{pulse.estimatedSuccess.toFixed(1)}%</span></div>
    <div className="mt-1 grid grid-cols-2 gap-1 text-muted-foreground"><span>Morale {pulse.collectiveMorale.toFixed(1)}</span><span>Risk {pulse.riskPressure.toFixed(1)}</span><span>Spectrum {pulse.moralSpectrum.toFixed(1)}</span><span>Coherence {pulse.alignmentCoherence.toFixed(1)}</span></div>
    <SpectrumBar value={pulse.moralSpectrum} />
    <details className="mt-1"><summary className="cursor-pointer text-muted-foreground">Estimate factors</summary><div className="mt-1 space-y-1">{pulse.factors.map(factor => <div key={factor.label} className="rounded bg-muted/30 p-1"><div className="flex justify-between"><span>{factor.label}</span><span>+{factor.contribution.toFixed(1)}</span></div><div className="text-[9px] text-muted-foreground">{factor.detail}</div></div>)}</div></details>
  </div>;
}

function SpectrumBar({ value }: { value: number }) {
  return <div className="relative mt-1 h-2 overflow-hidden rounded bg-gradient-to-r from-destructive via-muted to-emerald-500"><div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `calc(${Math.max(0, Math.min(100, value))}% - 1px)` }} /><span className="sr-only"><Scale />Spectrum {value}</span></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return <div className="rounded border p-2"><div className="text-muted-foreground"><Icon className="inline mr-1 h-3 w-3" />{label}</div><div className="text-lg font-semibold">{value}</div></div>;
}
