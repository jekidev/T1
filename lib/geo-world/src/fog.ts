import { distanceMeters } from "./coordinates";
import type { Coordinates, ExplorationCell, VisibilityState, VisionSource } from "./types";

export interface FogEntity {
  id: string;
  factionId?: string;
  coordinates: Coordinates;
  dynamic: boolean;
  hidden?: boolean;
  payload: unknown;
}

export interface FogMemoryRecord {
  entityId: string;
  coordinates: Coordinates;
  lastObservedTick: number;
  payload: unknown;
}

export interface FogVisibilityResult {
  visibleEntities: FogEntity[];
  rememberedEntities: FogMemoryRecord[];
  omittedEntityIds: string[];
}

export function visibilityStateForPoint(
  point: Coordinates,
  factionId: string,
  visionSources: readonly VisionSource[],
  previouslyExplored: boolean,
): VisibilityState {
  const visible = visionSources.some(source => source.factionId === factionId && distanceMeters(source.coordinates, point) <= source.radiusMeters);
  if (visible) return "currently_visible";
  return previouslyExplored ? "explored" : "unexplored";
}

export function updateExplorationCell(
  cell: ExplorationCell,
  factionId: string,
  visible: boolean,
  tick: number,
): ExplorationCell {
  const exploredBy = new Set(cell.exploredBy);
  const visibleBy = new Set(cell.visibleBy);
  if (visible) {
    exploredBy.add(factionId);
    visibleBy.add(factionId);
  } else {
    visibleBy.delete(factionId);
  }
  return {
    ...cell,
    exploredBy: [...exploredBy].sort(),
    visibleBy: [...visibleBy].sort(),
    lastObservedTick: visible ? tick : cell.lastObservedTick,
  };
}

export function filterEntitiesForFaction(input: {
  factionId: string;
  tick: number;
  entities: readonly FogEntity[];
  visionSources: readonly VisionSource[];
  exploredEntityIds?: ReadonlySet<string>;
  memory?: ReadonlyMap<string, FogMemoryRecord>;
}): FogVisibilityResult {
  const visibleEntities: FogEntity[] = [];
  const rememberedEntities: FogMemoryRecord[] = [];
  const omittedEntityIds: string[] = [];

  for (const entity of input.entities) {
    const friendly = entity.factionId === input.factionId;
    const observingSources = input.visionSources.filter(source => source.factionId === input.factionId);
    const visibleSource = observingSources.find(source => distanceMeters(source.coordinates, entity.coordinates) <= source.radiusMeters);
    const detected = Boolean(visibleSource) && (!entity.hidden || visibleSource?.detectsHidden === true);

    if (friendly || detected) {
      visibleEntities.push(entity);
      continue;
    }

    const explored = input.exploredEntityIds?.has(entity.id) ?? false;
    const remembered = input.memory?.get(entity.id);
    if (!entity.dynamic && explored && remembered) {
      rememberedEntities.push(remembered);
      continue;
    }

    omittedEntityIds.push(entity.id);
  }

  return {
    visibleEntities: [...visibleEntities].sort((a, b) => a.id.localeCompare(b.id)),
    rememberedEntities: [...rememberedEntities].sort((a, b) => a.entityId.localeCompare(b.entityId)),
    omittedEntityIds: omittedEntityIds.sort(),
  };
}

export function createMemoryRecord(entity: FogEntity, tick: number): FogMemoryRecord {
  return {
    entityId: entity.id,
    coordinates: { ...entity.coordinates },
    lastObservedTick: tick,
    payload: structuredClone(entity.payload),
  };
}
