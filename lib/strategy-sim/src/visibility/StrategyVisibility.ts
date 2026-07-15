import { distanceSquared, type StrategyEntity } from "../ecs/components";

export interface StrategyVisibilityMemoryRecord {
  entity: StrategyEntity;
  lastObservedTick: number;
}

export type StrategyVisibilityMemory = Record<string, StrategyVisibilityMemoryRecord>;

export interface StrategyFactionView {
  factionId: string;
  tick: number;
  visibleEntities: StrategyEntity[];
  rememberedEntities: StrategyVisibilityMemoryRecord[];
  omittedEntityIds: string[];
  memory: StrategyVisibilityMemory;
}

export function buildFactionView(input: {
  factionId: string;
  tick: number;
  entities: readonly StrategyEntity[];
  previousMemory?: StrategyVisibilityMemory;
}): StrategyFactionView {
  const visionProviders = input.entities.filter(entity => {
    if (entity.faction?.factionId !== input.factionId || !entity.transform) return false;
    if (entity.visibility?.providesVision === false) return false;
    return Boolean(entity.unit || entity.visibility?.visionRange);
  });
  const visibleEntities: StrategyEntity[] = [];
  const rememberedEntities: StrategyVisibilityMemoryRecord[] = [];
  const omittedEntityIds: string[] = [];
  const memory: StrategyVisibilityMemory = {};

  for (const entity of input.entities) {
    const friendly = entity.faction?.factionId === input.factionId;
    const globallyVisible = entity.identity.kind === "faction" && !entity.transform;
    const visible = friendly || globallyVisible || isDetected(entity, visionProviders);

    if (visible) {
      const clone = structuredClone(entity);
      visibleEntities.push(clone);
      if (shouldRemember(entity)) {
        memory[entity.identity.id] = { entity: clone, lastObservedTick: input.tick };
      }
      continue;
    }

    const remembered = input.previousMemory?.[entity.identity.id];
    if (remembered && shouldRemember(entity)) {
      const clone = structuredClone(remembered);
      rememberedEntities.push(clone);
      memory[entity.identity.id] = clone;
      continue;
    }

    omittedEntityIds.push(entity.identity.id);
  }

  return {
    factionId: input.factionId,
    tick: input.tick,
    visibleEntities: visibleEntities.sort(compareEntities),
    rememberedEntities: rememberedEntities.sort((a, b) => compareEntities(a.entity, b.entity)),
    omittedEntityIds: omittedEntityIds.sort(),
    memory: sortMemory(memory),
  };
}

function isDetected(entity: StrategyEntity, providers: readonly StrategyEntity[]): boolean {
  if (!entity.transform) return false;
  for (const provider of providers) {
    if (!provider.transform) continue;
    const range = provider.visibility?.visionRange ?? provider.unit?.visionRange ?? 0;
    if (range <= 0 || distanceSquared(entity.transform.position, provider.transform.position) > range * range) continue;
    if (entity.visibility?.hidden && entity.visibility.detectableByAdjacentUnits === false) continue;
    return true;
  }
  return false;
}

function shouldRemember(entity: StrategyEntity): boolean {
  if (entity.visibility) return entity.visibility.rememberWhenExplored;
  return entity.identity.kind === "building"
    || entity.identity.kind === "territory"
    || entity.identity.kind === "resource";
}

function compareEntities(a: StrategyEntity, b: StrategyEntity): number {
  return a.identity.id.localeCompare(b.identity.id);
}

function sortMemory(memory: StrategyVisibilityMemory): StrategyVisibilityMemory {
  const output: StrategyVisibilityMemory = {};
  for (const key of Object.keys(memory).sort()) output[key] = memory[key]!;
  return output;
}
