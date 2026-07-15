import type { SimulationSystem, SimulationSystemContext } from "./types";

export class ProductionSystem implements SimulationSystem {
  readonly id = "production-construction" as const;

  update(context: SimulationSystemContext): void {
    const buildings = context.world.allSorted().filter(entity => entity.building && entity.faction);
    for (const buildingEntity of buildings) {
      const building = buildingEntity.building!;
      const factionId = buildingEntity.faction!.factionId;
      const faction = context.world.get(factionId);
      if (!faction?.factionState) continue;

      if (!building.operational) {
        const credits = faction.factionState.resources.credits ?? 0;
        if (credits >= 2) {
          faction.factionState.resources.credits = credits - 2;
          building.constructionProgress = Math.min(100, building.constructionProgress + 1);
          if (building.constructionProgress >= 100) {
            building.operational = true;
            context.events.append({
              tick: context.clock.tick,
              tickDurationMs: context.clock.tickDurationMs,
              type: "construction.completed",
              actorId: factionId,
              payload: { buildingId: buildingEntity.identity.id },
            });
          }
        }
        continue;
      }

      if (building.buildingType === "supply_depot") {
        faction.factionState.resources.supplies = (faction.factionState.resources.supplies ?? 0) + 2;
      }
    }
  }
}
