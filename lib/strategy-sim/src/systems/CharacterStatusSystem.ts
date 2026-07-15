import { progressCharacterStatusTick } from "../status/CharacterStatus";
import type { SimulationSystem, SimulationSystemContext } from "./types";

export class CharacterStatusSystem implements SimulationSystem {
  readonly id = "character-status" as const;

  update(context: SimulationSystemContext): void {
    const entities = [...context.world.queries.characterStatuses].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    for (const entity of entities) {
      entity.characterStatus = progressCharacterStatusTick(entity.characterStatus);
      if (entity.health) {
        entity.health.current = entity.characterStatus.health.current;
        entity.health.maximum = entity.characterStatus.health.maximum;
      }
    }
  }
}
