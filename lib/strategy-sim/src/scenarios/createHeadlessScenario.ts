import { StrategySimulation } from "../StrategySimulation";
import {
  createFactionEntity,
  createResourceNodeEntity,
  createTerritoryEntity,
  createUnitEntity,
} from "../ecs/entityFactory";

export interface HeadlessScenario {
  simulation: StrategySimulation;
  redFactionId: string;
  blueFactionId: string;
  redUnitIds: string[];
  blueUnitIds: string[];
  westTerritoryId: string;
  eastTerritoryId: string;
}

export function createHeadlessScenario(options?: {
  seed?: number;
  unitsPerFaction?: number;
  enableLocalAI?: boolean;
}): HeadlessScenario {
  const unitsPerFaction = options?.unitsPerFaction ?? 50;
  const simulation = new StrategySimulation({
    seed: options?.seed ?? 1337,
    tickRate: 20,
    localStrategyDecisionIntervalTicks: 20,
  });

  const redFactionId = "faction-red";
  const blueFactionId = "faction-blue";

  simulation.addEntity(createFactionEntity({
    id: redFactionId,
    name: "Red Faction",
    tick: 0,
    resources: { credits: 1_000, supplies: 250 },
    productionPerTick: { credits: 4, supplies: 2 },
    consumptionPerTick: { credits: 1, supplies: 1 },
    aiPolicyId: options?.enableLocalAI ? "local-capture-v1" : undefined,
  }));

  simulation.addEntity(createFactionEntity({
    id: blueFactionId,
    name: "Blue Faction",
    tick: 0,
    resources: { credits: 1_000, supplies: 250 },
    productionPerTick: { credits: 5, supplies: 1 },
    consumptionPerTick: { credits: 1, supplies: 1 },
    aiPolicyId: options?.enableLocalAI ? "local-capture-v1" : undefined,
  }));

  const redUnitIds: string[] = [];
  const blueUnitIds: string[] = [];

  for (let index = 0; index < unitsPerFaction; index += 1) {
    const row = Math.floor(index / 10);
    const column = index % 10;
    const redId = `red-unit-${String(index + 1).padStart(3, "0")}`;
    const blueId = `blue-unit-${String(index + 1).padStart(3, "0")}`;
    redUnitIds.push(redId);
    blueUnitIds.push(blueId);

    simulation.addEntity(createUnitEntity({
      id: redId,
      factionId: redFactionId,
      tick: 0,
      position: { x: -12 - column * 0.4, y: 0, z: -2 + row * 0.7 },
      unitType: index < 5 ? "scout" : "infantry",
      movementSpeed: index < 5 ? 4.5 : 3,
      captureStrength: 1,
    }));

    simulation.addEntity(createUnitEntity({
      id: blueId,
      factionId: blueFactionId,
      tick: 0,
      position: { x: 12 + column * 0.4, y: 0, z: -2 + row * 0.7 },
      unitType: index < 5 ? "scout" : "infantry",
      movementSpeed: index < 5 ? 4.5 : 3,
      captureStrength: 1,
    }));
  }

  const westTerritoryId = "territory-west";
  const eastTerritoryId = "territory-east";
  simulation.addEntity(createTerritoryEntity({
    id: westTerritoryId,
    name: "West District",
    tick: 0,
    position: { x: -12, y: 0, z: 0 },
    radius: 7,
    ownerFactionId: blueFactionId,
    captureRequired: 100,
  }));
  simulation.addEntity(createTerritoryEntity({
    id: eastTerritoryId,
    name: "East District",
    tick: 0,
    position: { x: 12, y: 0, z: 0 },
    radius: 7,
    ownerFactionId: redFactionId,
    captureRequired: 100,
  }));

  simulation.addEntity(createResourceNodeEntity({
    id: "resource-west-supplies",
    tick: 0,
    position: { x: -14, y: 0, z: 3 },
    resourceType: "supplies",
    amount: 10_000,
    extractionPerTick: 3,
    ownerFactionId: redFactionId,
  }));
  simulation.addEntity(createResourceNodeEntity({
    id: "resource-east-supplies",
    tick: 0,
    position: { x: 14, y: 0, z: 3 },
    resourceType: "supplies",
    amount: 10_000,
    extractionPerTick: 3,
    ownerFactionId: blueFactionId,
  }));

  return {
    simulation,
    redFactionId,
    blueFactionId,
    redUnitIds,
    blueUnitIds,
    westTerritoryId,
    eastTerritoryId,
  };
}
