import { cloneVector, distanceSquared } from "../ecs/components";
import type { SimulationSystem, SimulationSystemContext } from "./types";

export class CombatSystem implements SimulationSystem {
  readonly id = "combat" as const;

  update(context: SimulationSystemContext): void {
    const combatants = [...context.world.queries.combatants]
      .sort((a, b) => a.identity.id.localeCompare(b.identity.id));

    for (const attacker of combatants) {
      if (attacker.health.current <= 0) continue;
      if (attacker.combat.cooldownRemaining > 0) {
        attacker.combat.cooldownRemaining -= 1;
      }

      const targetId = attacker.combat.targetId;
      if (!targetId) continue;
      const target = context.world.get(targetId);
      if (!target?.health || !target.transform || !target.faction || target.health.current <= 0) {
        attacker.combat.targetId = undefined;
        continue;
      }
      if (target.faction.factionId === attacker.faction.factionId) {
        attacker.combat.targetId = undefined;
        continue;
      }

      const rangeSquared = attacker.combat.range * attacker.combat.range;
      if (distanceSquared(attacker.transform.position, target.transform.position) > rangeSquared) {
        if (attacker.movement) {
          attacker.movement.target = cloneVector(target.transform.position);
          attacker.movement.status = "moving";
        }
        continue;
      }

      if (attacker.combat.cooldownRemaining > 0) continue;
      target.health.current = Math.max(0, target.health.current - attacker.combat.damage);
      attacker.combat.cooldownRemaining = attacker.combat.cooldownTicks;

      context.events.append({
        tick: context.clock.tick,
        tickDurationMs: context.clock.tickDurationMs,
        type: "combat.damage",
        actorId: attacker.identity.id,
        payload: {
          targetId,
          amount: attacker.combat.damage,
          remainingHealth: target.health.current,
        },
      });
    }
  }
}
