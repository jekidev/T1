import type {
  StrategyEntity,
  Vector3Data,
} from "./components";
import { cloneVector } from "./components";

export class DeterministicIdFactory {
  private counters = new Map<string, number>();

  next(prefix: string): string {
    const value = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, value);
    return `${prefix}-${String(value).padStart(5, "0")}`;
  }

  exportState(): Record<string, number> {
    return Object.fromEntries([...this.counters.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }

  importState(state: Record<string, number>): void {
    this.counters.clear();
    for (const [key, value] of Object.entries(state)) this.counters.set(key, value);
  }
}

export function createFactionEntity(input: {
  id: string;
  name: string;
  tick: number;
  treasury?: number;
  resources?: Record<string, number>;
  productionPerTick?: Record<string, number>;
  consumptionPerTick?: Record<string, number>;
  aiPolicyId?: string;
}): StrategyEntity {
  return {
    identity: { id: input.id, kind: "faction", createdTick: input.tick },
    factionState: {
      name: input.name,
      treasury: input.treasury ?? 100_000,
      resources: { credits: 0, supplies: 0, ...input.resources },
      productionPerTick: { credits: 5, supplies: 1, ...input.productionPerTick },
      consumptionPerTick: { credits: 0, supplies: 0, ...input.consumptionPerTick },
      relations: {},
    },
    ai: input.aiPolicyId
      ? { policyId: input.aiPolicyId, enabled: true }
      : undefined,
  };
}

export function createUnitEntity(input: {
  id: string;
  factionId: string;
  tick: number;
  position: Vector3Data;
  unitType?: string;
  movementSpeed?: number;
  visionRange?: number;
  captureStrength?: number;
  health?: number;
  damage?: number;
  range?: number;
  cooldownTicks?: number;
  morale?: number;
}): StrategyEntity {
  const maximumHealth = input.health ?? 100;
  const maximumMorale = input.morale ?? 100;
  return {
    identity: { id: input.id, kind: "unit", createdTick: input.tick },
    transform: {
      position: cloneVector(input.position),
      previousPosition: cloneVector(input.position),
      rotationY: 0,
    },
    faction: { factionId: input.factionId },
    unit: {
      unitType: input.unitType ?? "infantry",
      movementSpeed: input.movementSpeed ?? 3,
      visionRange: input.visionRange ?? 20,
      captureStrength: input.captureStrength ?? 1,
    },
    health: { current: maximumHealth, maximum: maximumHealth },
    movement: { speed: input.movementSpeed ?? 3, status: "idle" },
    combat: {
      damage: input.damage ?? 8,
      range: input.range ?? 3,
      cooldownTicks: input.cooldownTicks ?? 5,
      cooldownRemaining: 0,
    },
    morale: {
      current: maximumMorale,
      maximum: maximumMorale,
      retreatThreshold: 20,
    },
  };
}

export function createTerritoryEntity(input: {
  id: string;
  name: string;
  tick: number;
  position: Vector3Data;
  radius?: number;
  ownerFactionId?: string;
  captureRequired?: number;
}): StrategyEntity {
  return {
    identity: { id: input.id, kind: "territory", createdTick: input.tick },
    transform: {
      position: cloneVector(input.position),
      previousPosition: cloneVector(input.position),
      rotationY: 0,
    },
    territory: {
      name: input.name,
      radius: input.radius ?? 8,
      ownerFactionId: input.ownerFactionId,
      captureProgress: {},
      captureRequired: input.captureRequired ?? 100,
    },
  };
}

export function createResourceNodeEntity(input: {
  id: string;
  tick: number;
  position: Vector3Data;
  resourceType: string;
  amount: number;
  extractionPerTick: number;
  ownerFactionId?: string;
}): StrategyEntity {
  return {
    identity: { id: input.id, kind: "resource", createdTick: input.tick },
    transform: {
      position: cloneVector(input.position),
      previousPosition: cloneVector(input.position),
      rotationY: 0,
    },
    resourceNode: {
      resourceType: input.resourceType,
      amount: input.amount,
      extractionPerTick: input.extractionPerTick,
      ownerFactionId: input.ownerFactionId,
    },
  };
}
