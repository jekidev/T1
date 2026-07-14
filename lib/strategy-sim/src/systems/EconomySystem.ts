import type { SimulationSystem, SimulationSystemContext } from "./types";

export class EconomySystem implements SimulationSystem {
  readonly id = "economy" as const;

  update(context: SimulationSystemContext): void {
    for (const faction of [...context.world.queries.factions].sort((a, b) => a.identity.id.localeCompare(b.identity.id))) {
      const resourceNames = new Set([
        ...Object.keys(faction.factionState.resources),
        ...Object.keys(faction.factionState.productionPerTick),
        ...Object.keys(faction.factionState.consumptionPerTick),
      ]);

      for (const resource of [...resourceNames].sort()) {
        const current = faction.factionState.resources[resource] ?? 0;
        const produced = faction.factionState.productionPerTick[resource] ?? 0;
        const consumed = faction.factionState.consumptionPerTick[resource] ?? 0;
        faction.factionState.resources[resource] = Math.max(0, current + produced - consumed);
      }
    }

    for (const node of [...context.world.queries.resourceNodes].sort((a, b) => a.identity.id.localeCompare(b.identity.id))) {
      const ownerId = node.resourceNode.ownerFactionId;
      if (!ownerId || node.resourceNode.amount <= 0) continue;
      const faction = context.world.get(ownerId);
      if (!faction?.factionState) continue;
      const extracted = Math.min(node.resourceNode.amount, node.resourceNode.extractionPerTick);
      node.resourceNode.amount -= extracted;
      faction.factionState.resources[node.resourceNode.resourceType] =
        (faction.factionState.resources[node.resourceNode.resourceType] ?? 0) + extracted;

      context.events.append({
        tick: context.clock.tick,
        tickDurationMs: context.clock.tickDurationMs,
        type: "economy.resource_extracted",
        actorId: ownerId,
        payload: {
          nodeId: node.identity.id,
          resourceType: node.resourceNode.resourceType,
          amount: extracted,
          remaining: node.resourceNode.amount,
        },
      });
    }
  }
}
