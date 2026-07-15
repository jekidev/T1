import type { SimulationSystem, SimulationSystemContext } from "./types";

export class MoraleCleanupSystem implements SimulationSystem {
  readonly id = "morale-cleanup" as const;

  update(context: SimulationSystemContext): void {
    const deadIds: string[] = [];

    for (const entity of [...context.world.queries.morale].sort((a, b) => a.identity.id.localeCompare(b.identity.id))) {
      const healthRatio = entity.health.maximum > 0 ? entity.health.current / entity.health.maximum : 0;
      const targetMorale = Math.round(entity.morale.maximum * healthRatio);
      if (entity.morale.current > targetMorale) entity.morale.current -= 1;
      if (entity.morale.current < targetMorale && healthRatio > 0.65) entity.morale.current += 1;

      if (entity.movement && entity.morale.current <= entity.morale.retreatThreshold) {
        entity.movement.status = "blocked";
        entity.movement.target = undefined;
      }

      if (entity.health.current <= 0) deadIds.push(entity.identity.id);
    }

    for (const id of deadIds.sort()) {
      context.world.remove(id);
      context.events.append({
        tick: context.clock.tick,
        tickDurationMs: context.clock.tickDurationMs,
        type: "entity.destroyed",
        actorId: id,
        payload: {},
      });
    }
  }
}
