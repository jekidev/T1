import { World } from "miniplex";
import type { StrategyEntity } from "./components";

export class StrategyWorld {
  readonly ecs = new World<StrategyEntity>();
  readonly entitiesById = new Map<string, StrategyEntity>();

  readonly queries = {
    units: this.ecs.with("identity", "unit", "transform", "faction", "health"),
    moving: this.ecs.with("identity", "unit", "transform", "movement", "health"),
    combatants: this.ecs.with("identity", "unit", "transform", "combat", "faction", "health"),
    factions: this.ecs.with("identity", "factionState"),
    blackmailFactions: this.ecs.with("identity", "factionState", "influence", "blackmail"),
    territories: this.ecs.with("identity", "transform", "territory"),
    resourceNodes: this.ecs.with("identity", "transform", "resourceNode"),
    morale: this.ecs.with("identity", "morale", "health"),
    aiControlled: this.ecs.with("identity", "ai"),
    npcs: this.ecs.with("identity", "npc"),
    characterStatuses: this.ecs.with("identity", "characterStatus"),
  };

  add(entity: StrategyEntity): StrategyEntity {
    if (this.entitiesById.has(entity.identity.id)) {
      throw new Error(`Entity id already exists: ${entity.identity.id}`);
    }
    const added = this.ecs.add(entity);
    this.entitiesById.set(entity.identity.id, added);
    return added;
  }

  get(id: string): StrategyEntity | undefined {
    return this.entitiesById.get(id);
  }

  remove(id: string): boolean {
    const entity = this.entitiesById.get(id);
    if (!entity) return false;
    this.ecs.remove(entity);
    this.entitiesById.delete(id);
    return true;
  }

  clear(): void {
    for (const id of [...this.entitiesById.keys()]) this.remove(id);
  }

  allSorted(): StrategyEntity[] {
    return [...this.entitiesById.values()].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
  }
}
