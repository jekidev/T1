import { applyRoutineDecision, decideNpcRoutine } from "../npc/NpcRoutineEngine";
import type { SimulationSystem, SimulationSystemContext } from "./types";

export class NpcRoutineSystem implements SimulationSystem {
  readonly id = "npc-routines" as const;

  constructor(private readonly ticksPerGameMinute = 20) {
    if (!Number.isFinite(ticksPerGameMinute) || ticksPerGameMinute <= 0) {
      throw new Error("ticksPerGameMinute must be positive.");
    }
  }

  update(context: SimulationSystemContext): void {
    const entities = [...context.world.queries.npcs].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    for (const entity of entities) {
      const previousAction = entity.npc.currentAction;
      const previousLocation = entity.npc.currentLocationId;
      const decision = decideNpcRoutine(entity.identity.id, entity.npc, {
        tick: context.clock.tick,
        ticksPerGameMinute: this.ticksPerGameMinute,
      });
      entity.npc = applyRoutineDecision(entity.npc, decision);
      if (entity.npc.currentAction === previousAction && entity.npc.currentLocationId === previousLocation) continue;
      context.events.append({
        tick: context.clock.tick,
        tickDurationMs: context.clock.tickDurationMs,
        type: "npc.routine.changed",
        actorId: entity.identity.id,
        payload: {
          action: decision.action,
          locationId: decision.locationId,
          source: decision.source,
          reason: decision.reason,
        },
      });
    }
  }
}
