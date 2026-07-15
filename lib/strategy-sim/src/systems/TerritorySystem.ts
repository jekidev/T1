import { distanceSquared } from "../ecs/components";
import type { SimulationSystem, SimulationSystemContext } from "./types";

export class TerritorySystem implements SimulationSystem {
  readonly id = "territory-visibility" as const;

  update(context: SimulationSystemContext): void {
    const livingUnits = [...context.world.queries.units]
      .filter(entity => entity.health.current > 0)
      .sort((a, b) => a.identity.id.localeCompare(b.identity.id));

    for (const territoryEntity of [...context.world.queries.territories].sort((a, b) => a.identity.id.localeCompare(b.identity.id))) {
      const territory = territoryEntity.territory;
      const radiusSquared = territory.radius * territory.radius;
      const strengthByFaction = new Map<string, number>();

      for (const unit of livingUnits) {
        if (distanceSquared(unit.transform.position, territoryEntity.transform.position) > radiusSquared) continue;
        const factionId = unit.faction.factionId;
        strengthByFaction.set(factionId, (strengthByFaction.get(factionId) ?? 0) + unit.unit.captureStrength);
      }

      const activeFactions = [...strengthByFaction.entries()]
        .filter(([, strength]) => strength > 0)
        .sort(([a], [b]) => a.localeCompare(b));

      if (activeFactions.length !== 1) continue;
      const [capturingFactionId, strength] = activeFactions[0]!;
      if (territory.ownerFactionId === capturingFactionId) {
        territory.captureProgress = {};
        continue;
      }

      const nextProgress = (territory.captureProgress[capturingFactionId] ?? 0) + strength;
      territory.captureProgress = { [capturingFactionId]: nextProgress };

      if (nextProgress >= territory.captureRequired) {
        const previousOwnerFactionId = territory.ownerFactionId;
        territory.ownerFactionId = capturingFactionId;
        territory.captureProgress = {};
        context.events.append({
          tick: context.clock.tick,
          tickDurationMs: context.clock.tickDurationMs,
          type: "territory.captured",
          actorId: capturingFactionId,
          payload: {
            territoryId: territoryEntity.identity.id,
            previousOwnerFactionId,
          },
        });
      }
    }
  }
}
