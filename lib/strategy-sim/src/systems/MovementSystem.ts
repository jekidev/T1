import type { SimulationSystem, SimulationSystemContext } from "./types";

const ARRIVAL_DISTANCE = 0.05;

export class MovementSystem implements SimulationSystem {
  readonly id = "movement" as const;

  update(context: SimulationSystemContext): void {
    const deltaSeconds = context.clock.tickDurationSeconds;
    const movingEntities = [...context.world.queries.moving]
      .sort((a, b) => a.identity.id.localeCompare(b.identity.id));

    for (const entity of movingEntities) {
      if (entity.health.current <= 0 || !entity.movement.target) continue;

      const current = entity.transform.position;
      const target = entity.movement.target;
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dz = target.z - current.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      entity.transform.previousPosition = { ...current };

      if (distance <= ARRIVAL_DISTANCE) {
        entity.transform.position = { ...target };
        entity.movement.target = undefined;
        entity.movement.status = "arrived";
        context.events.append({
          tick: context.clock.tick,
          tickDurationMs: context.clock.tickDurationMs,
          type: "movement.arrived",
          actorId: entity.identity.id,
          payload: { commandId: entity.movement.commandId },
        });
        continue;
      }

      const step = Math.min(distance, entity.movement.speed * deltaSeconds);
      const inverse = 1 / distance;
      entity.transform.position = {
        x: current.x + dx * inverse * step,
        y: current.y + dy * inverse * step,
        z: current.z + dz * inverse * step,
      };
      entity.transform.rotationY = Math.atan2(dx, dz);
      entity.movement.status = "moving";
    }
  }
}
