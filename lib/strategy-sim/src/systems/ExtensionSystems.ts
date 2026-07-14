import type { SimulationSystem, SimulationSystemContext, SystemId } from "./types";

export class DisabledExtensionSystem implements SimulationSystem {
  constructor(
    readonly id: Extract<SystemId, "tactical-intent" | "path-intent" | "collision-avoidance">,
    readonly reason: string,
  ) {}

  update(_context: SimulationSystemContext): void {
    // Phase A extension point. It performs no state changes until its module is enabled.
  }
}

export class FinalizeSystem implements SimulationSystem {
  readonly id = "finalize" as const;

  update(context: SimulationSystemContext): void {
    context.events.append({
      tick: context.clock.tick,
      tickDurationMs: context.clock.tickDurationMs,
      type: "tick.completed",
      payload: {
        entityCount: context.world.entitiesById.size,
      },
    });
  }
}
