import type { BoardState } from "@/lib/game";

interface PlayerStatusMeterProps {
  board: BoardState;
  compact?: boolean;
}

export function PlayerStatusMeter({ board, compact = false }: PlayerStatusMeterProps) {
  const profile = board.simulation?.teamDynamics?.userProfile;
  const entityMorale = average(board.entities.map(entity => entity.attributes.morale), 70);
  const factionCohesion = average(board.simulation?.factions.map(faction => faction.cohesion) ?? [], entityMorale);
  const health = clamp(entityMorale * 0.55 + factionCohesion * 0.3 + clamp((board.simulation?.economyIndex ?? 100) / 1.25) * 0.15);
  const risk = profile?.riskIndex ?? average(board.entities.map(entity => entity.attributes.risk), 25);
  const action = clamp(100 - risk * 0.55 + average(board.entities.map(entity => entity.attributes.readiness), 50) * 0.55);
  const karmaSigned = clampRange(profile?.karma ?? 0, -100, 100);
  const karma = clamp((karmaSigned + 100) / 2);
  const morals = clampRange(profile?.currentSpectrum ?? 50, 1, 100);

  return (
    <div className={`grid grid-cols-2 gap-1.5 rounded-md border border-border bg-muted/20 p-2 ${compact ? "w-[230px]" : "w-full"}`} aria-label="Player status meters">
      <Meter label="Health" value={health} detail="physical and organizational condition" />
      <Meter label="Action" value={action} detail="current capacity to act" />
      <Meter label="Karma" value={karma} display={`${karmaSigned >= 0 ? "+" : ""}${Math.round(karmaSigned)}`} detail="event-based consequences" />
      <Meter label="Morals" value={morals} display={`${Math.round(morals)}/100`} detail="1 evil → 100 good" spectrum />
    </div>
  );
}

function Meter({ label, value, display, detail, spectrum = false }: { label: string; value: number; display?: string; detail: string; spectrum?: boolean }) {
  const safe = clamp(value);
  return (
    <div className="rounded border border-border/70 bg-background/70 px-2 py-1" title={detail}>
      <div className="flex items-center justify-between text-[9px]"><span className="font-medium">{label}</span><span className="font-mono text-muted-foreground">{display ?? Math.round(safe)}</span></div>
      <div className={`relative mt-1 h-1.5 overflow-hidden rounded-full ${spectrum ? "bg-gradient-to-r from-destructive via-muted to-emerald-500" : "bg-muted"}`}>
        {spectrum ? <span className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground" style={{ left: `${safe}%` }} /> : <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${safe}%` }} />}
      </div>
    </div>
  );
}

function average(values: readonly number[], fallback: number): number {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) / finite.length : fallback;
}

function clamp(value: number): number {
  return clampRange(value, 0, 100);
}

function clampRange(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}
