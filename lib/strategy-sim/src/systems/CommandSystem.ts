import { cloneVector } from "../ecs/components";
import { validateCommandAuthority } from "../commands/CommandQueue";
import type { SimulationSystem, SimulationSystemContext } from "./types";

export class CommandSystem implements SimulationSystem {
  readonly id = "commands" as const;

  update(context: SimulationSystemContext): void {
    for (const command of context.readyCommands) {
      const validation = validateCommandAuthority(context.world, command, context.clock.tick);
      if (!validation.accepted) {
        context.events.append({
          tick: context.clock.tick,
          tickDurationMs: context.clock.tickDurationMs,
          type: "command.rejected",
          actorId: command.actorFactionId,
          payload: {
            commandId: command.id,
            code: validation.code,
            reason: validation.reason,
          },
        });
        continue;
      }

      const payload = command.command;
      if (payload.type === "move_units") {
        for (const entityId of payload.entityIds) {
          const entity = context.world.get(entityId)!;
          if (!entity.movement) continue;
          entity.movement.target = cloneVector(payload.target);
          entity.movement.status = "moving";
          entity.movement.commandId = command.id;
        }
      }

      if (payload.type === "attack_target") {
        const target = context.world.get(payload.targetEntityId)!;
        for (const entityId of payload.entityIds) {
          const entity = context.world.get(entityId)!;
          if (!entity.combat || !entity.movement || !target.transform) continue;
          entity.combat.targetId = payload.targetEntityId;
          entity.movement.target = cloneVector(target.transform.position);
          entity.movement.status = "moving";
          entity.movement.commandId = command.id;
        }
      }

      if (payload.type === "claim_territory") {
        const territory = context.world.get(payload.territoryId)!;
        for (const entityId of payload.entityIds) {
          const entity = context.world.get(entityId)!;
          if (!entity.movement || !territory.transform) continue;
          entity.movement.target = cloneVector(territory.transform.position);
          entity.movement.status = "moving";
          entity.movement.commandId = command.id;
        }
      }

      if (payload.type === "set_economy_rates") {
        const faction = context.world.get(command.actorFactionId)!;
        if (faction.factionState) {
          faction.factionState.productionPerTick = { ...payload.productionPerTick };
          faction.factionState.consumptionPerTick = { ...payload.consumptionPerTick };
        }
      }

      context.events.append({
        tick: context.clock.tick,
        tickDurationMs: context.clock.tickDurationMs,
        type: "command.executed",
        actorId: command.actorFactionId,
        payload: {
          commandId: command.id,
          commandType: payload.type,
        },
      });
    }
  }
}
