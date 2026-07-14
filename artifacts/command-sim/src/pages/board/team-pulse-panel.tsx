import { useMemo } from "react";
import { Activity, Gauge, HeartPulse, Scale, Shield, Swords, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureTeamDynamics, moralSpectrumLabel, type SimulationState, type TeamPulse } from "@/lib/game";

export function TeamPulsePanel({ simulation }: { simulation: SimulationState }) {
  const dynamics = useMemo(() => ensureTeamDynamics(simulation), [simulation]);
  const leader = Math.abs(dynamics.red.estimatedSuccess - dynamics.blue.estimatedSuccess) < 0.2
    ? "Even"
    : dynamics.red.estimatedSuccess > dynamics.blue.estimatedSuccess
      ? "Red leads"
      : "Blue leads";
  const user = dynamics.userProfile;

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xs">
            <Activity className="h-4 w-4" />Realtime Blue / Red assessment
          </CardTitle>
          <Badge variant="outline" className="text-[9px]">{leader} · turn {dynamics.updatedAtTurn}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          <TeamCard pulse={dynamics.red} />
          <TeamCard pulse={dynamics.blue} />
        </div>

        <div className="rounded border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-2 font-medium">
              <Scale className="h-3.5 w-3.5" />Player account spectrum
              <Badge variant="outline" className="text-[9px]">{user.side}</Badge>
            </div>
            <span className="font-mono font-bold">{user.currentSpectrum.toFixed(1)}/100</span>
          </div>
          <SpectrumBar value={user.currentSpectrum} />
          <div className="mt-1 flex flex-wrap justify-between gap-2 text-[9px] text-muted-foreground">
            <span>{moralSpectrumLabel(user.currentSpectrum)}</span>
            <span>Start {user.initialSpectrum.toFixed(1)} · Karma {signed(user.karma)} · Risk {user.riskIndex.toFixed(1)} · Last {signed(user.lastChange)}</span>
          </div>
          {user.history.at(-1) && (
            <p className="mt-2 border-l-2 border-border pl-2 text-[9px] text-muted-foreground">
              {user.history.at(-1)!.reason}
            </p>
          )}
        </div>

        <p className="text-[9px] leading-relaxed text-muted-foreground">
          Estimates are deterministic game probabilities, not certainty. Blue and Red sum to 100%; moral alignment affects coherence and morale but does not automatically make either side win.
        </p>
      </CardContent>
    </Card>
  );
}

function TeamCard({ pulse }: { pulse: TeamPulse }) {
  const red = pulse.side === "red";
  const Icon = red ? Swords : Shield;
  const accent = red ? "text-red-400" : "text-blue-400";
  const fill = red ? "bg-red-500" : "bg-blue-500";
  const sortedFactors = [...pulse.factors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 4);

  return (
    <div className="rounded border bg-background/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 text-xs font-semibold ${accent}`}><Icon className="h-4 w-4" />{red ? "Red Team" : "Blue Team"}</div>
        <span className="font-mono text-lg font-bold">{pulse.estimatedSuccess.toFixed(1)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-muted"><div className={`h-full ${fill} transition-[width] duration-500`} style={{ width: `${pulse.estimatedSuccess}%` }} /></div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
        <Metric icon={HeartPulse} label="Collective morale" value={pulse.collectiveMorale} />
        <Metric icon={Scale} label="Moral spectrum" value={pulse.moralSpectrum} />
        <Metric icon={Gauge} label="Risk pressure" value={pulse.riskPressure} />
        <Metric icon={TrendingUp} label="Model confidence" value={pulse.confidence} />
      </div>
      <SpectrumBar value={pulse.moralSpectrum} />
      <div className="mt-1 flex justify-between gap-2 text-[9px] text-muted-foreground">
        <span>{moralSpectrumLabel(pulse.moralSpectrum)}</span>
        <span>Coherence {pulse.alignmentCoherence.toFixed(1)}</span>
      </div>
      {sortedFactors.length > 0 && (
        <div className="mt-2 space-y-1 border-t pt-2">
          {sortedFactors.map(factor => (
            <div key={factor.label} className="grid grid-cols-[1fr_auto] gap-2 text-[9px]">
              <span className="truncate text-muted-foreground" title={factor.detail}>{factor.label}</span>
              <span className="font-mono">{factor.value.toFixed(1)} × {Math.round(factor.weight * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return (
    <div className="rounded border p-1.5">
      <div className="flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="mt-0.5 font-mono font-semibold">{value.toFixed(1)}</div>
    </div>
  );
}

function SpectrumBar({ value }: { value: number }) {
  return (
    <div className="relative mt-2 h-2 overflow-hidden rounded bg-gradient-to-r from-red-950 via-zinc-500 to-emerald-500">
      <div className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-white shadow" style={{ left: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}
