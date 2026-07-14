import { distanceSquared } from "../ecs/components";
import type { SimulationSystem, SimulationSystemContext } from "./types";

export class LocalStrategySystem implements SimulationSystem {
  readonly id = "local-strategy" as const;

  constructor(private readonly decisionIntervalTicks = 20) {}

  update(context: SimulationSystemContext): void {
    if (context.clock.tick === 0 || context.clock.tick % this.decisionIntervalTicks !== 0) return;

    const territories = [...context.world.queries.territories]
      .sort((a, b) => a.identity.id.localeCompare(b.identity.id));

    for (const faction of [...context.world.queries.aiControlled].sort((a, b) => a.identity.id.localeCompare(b.identity.id))) {
      if (!faction.ai.enabled || !faction.factionState) continue;
      const units = [...context.world.queries.units]
        .filter(unit => unit.faction.factionId === faction.identity.id && unit.health.current > 0)
        .sort((a, b) => a.identity.id.localeCompare(b.identity.id));
      if (units.length === 0) continue;

      const availableTerritories = territories.filter(entity => entity.territory.ownerFactionId !== faction.identity.id);
      if (availableTerritories.length === 0) continue;

      const anchor = units[0]!.transform.position;
      const target = availableTerritories
        .map(entity => ({ entity, distance: distanceSquared(anchor, entity.transform.position) }))
        .sort((a, b) => a.distance - b.distance || a.entity.identity.id.localeCompare(b.entity.identity.id))[0]!.entity;

      const entityIds = units.slice(0, Math.min(12, units.length)).map(unit => unit.identity.id);
      const commandId = context.nextCommandId("local-strategy");
      const result = context.submitCommand({
        id: commandId,
        submittedTick: context.clock.tick + 1,
        actorFactionId: faction.identity.id,
        command: {
          type: "claim_territory",
          entityIds,
          territoryId: target.identity.id,
        },
      });

      context.events.append({
        tick: context.clock.tick,
        tickDurationMs: context.clock.tickDurationMs,
        type: result.accepted ? "ai.local_decision" : "ai.local_decision_rejected",
        actorId: faction.identity.id,
        payload: {
          policyId: faction.ai.policyId,
          commandId,
          targetTerritoryId: target.identity.id,
          accepted: result.accepted,
        },
      });
    }
  }
}
