import { nanoid } from "nanoid";
import type {
  BoardEntity,
  BoardState,
  BoardWorldState,
  FactionState,
  GeneratedGameContent,
  ShopState,
  SimulationState,
  SkillState,
} from "./types";
import { DEFAULT_ATTRIBUTES } from "./types";
import type { GeneratedGamePayload } from "./generatedGameSchema";

function seededOffset(index: number, axis: "x" | "y"): number {
  const value = Math.sin((index + 1) * (axis === "x" ? 12.9898 : 78.233)) * 43758.5453;
  return Math.abs(value % 1);
}

function boardToGeo(x: number, y: number, world: BoardWorldState) {
  const latDelta = Math.max(0.02, world.workAreaRadiusKm / 111);
  const lngDelta = Math.max(0.02, world.workAreaRadiusKm / (111 * Math.max(0.2, Math.cos(world.latitude * Math.PI / 180))));
  return {
    latitude: world.latitude + (0.5 - y / 1000) * latDelta * 2,
    longitude: world.longitude + (x / 1000 - 0.5) * lngDelta * 2,
    precision: "generated" as const,
  };
}

function toTemplateId(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized.includes("vehicle")) return "vehicle-car";
  if (normalized.includes("evidence")) return "evidence-document";
  if (normalized.includes("surveillance")) return "surveillance-camera";
  if (normalized.includes("objective")) return "objective-primary";
  if (normalized.includes("resource")) return "resource-supply";
  return "location-building";
}

function compileEntities(payload: GeneratedGamePayload, world: BoardWorldState): BoardEntity[] {
  const factionByName = new Map(payload.factions.map(item => [item.name.toLowerCase(), item.faction]));
  const factionEntities = payload.factions.map((item, index): BoardEntity => {
    const x = 120 + seededOffset(index, "x") * 760;
    const y = 120 + seededOffset(index, "y") * 760;
    return {
      id: nanoid(10),
      templateId: item.faction === "police" ? "unit-police" : item.faction === "criminal" ? "unit-network" : "unit-civilian",
      category: "unit",
      faction: item.faction,
      label: item.name,
      x,
      y,
      geo: boardToGeo(x, y, world),
      rotation: 0,
      scale: 1,
      zIndex: index,
      layerId: "layer-default",
      zoneId: null,
      groupId: null,
      locked: false,
      attributes: {
        ...DEFAULT_ATTRIBUTES,
        legalAuthority: item.faction === "police" ? 80 : 0,
        influence: item.faction === "neutral" ? 65 : 55,
        risk: item.faction === "criminal" ? 50 : 30,
      },
      notes: `${item.role}\nGoal: ${item.goal}`,
      sourceStatus: "fictional",
    };
  });

  const assetEntities = payload.assets.map((asset, index): BoardEntity => {
    const absoluteIndex = payload.factions.length + index;
    const x = 100 + seededOffset(absoluteIndex, "x") * 800;
    const y = 100 + seededOffset(absoluteIndex, "y") * 800;
    const matchingFaction = [...factionByName.entries()].find(([name]) => asset.description.toLowerCase().includes(name));
    return {
      id: nanoid(10),
      templateId: toTemplateId(asset.type),
      category: asset.type.toLowerCase().includes("evidence") ? "evidence" : asset.type.toLowerCase().includes("resource") ? "resource" : "location",
      faction: matchingFaction?.[1] ?? "neutral",
      label: asset.name,
      x,
      y,
      geo: boardToGeo(x, y, world),
      rotation: 0,
      scale: 1,
      zIndex: absoluteIndex,
      layerId: "layer-default",
      zoneId: null,
      groupId: null,
      locked: false,
      attributes: { ...DEFAULT_ATTRIBUTES, resources: 60, readiness: 55 },
      notes: `${asset.description}${asset.district ? `\nDistrict: ${asset.district}` : ""}`,
      sourceStatus: "fictional",
    };
  });

  return [...factionEntities, ...assetEntities];
}

function compileFactions(payload: GeneratedGamePayload): FactionState[] {
  return payload.factions.map((item, index) => ({
    id: `faction-${nanoid(8)}`,
    name: item.name,
    faction: item.faction,
    treasury: item.faction === "police" ? 250000 : item.faction === "criminal" ? 100000 : 75000,
    personnel: item.faction === "neutral" ? 12 : 20,
    cohesion: 55 + (index % 4) * 8,
    legitimacy: item.faction === "police" ? 70 : item.faction === "neutral" ? 65 : 35,
    intelligence: 45 + (index % 5) * 7,
    suspicion: item.faction === "criminal" ? 12 : 0,
    territories: [],
    relationships: {},
    objectives: [item.goal],
  }));
}

function compileShops(payload: GeneratedGamePayload, world: BoardWorldState): ShopState[] {
  const source = payload.shops.length > 0 ? payload.shops : [{ name: "Regional Vendor Network", district: world.city, description: "Default generated vendor", inventory: ["Basic supplies"] }];
  return source.map((shop, index) => ({
    id: `shop-${nanoid(8)}`,
    name: shop.name,
    district: shop.district,
    reputationRequired: Math.min(70, index * 5),
    scarcity: 20 + (index % 5) * 10,
    pressure: 10 + (index % 3) * 5,
    inventory: (shop.inventory?.length ? shop.inventory : ["General supplies", "Information", "Transport access"]).map((name, itemIndex) => ({
      id: `item-${nanoid(8)}`,
      name,
      price: 500 + itemIndex * 750 + index * 200,
      stock: 3 + ((index + itemIndex) % 8),
      quality: 50 + ((index + itemIndex) % 5) * 10,
    })),
  }));
}

function compileSkills(payload: GeneratedGamePayload): SkillState[] {
  return payload.skills.map(skill => ({ id: `skill-${nanoid(8)}`, name: skill.name, level: 1, experience: 0, description: skill.description }));
}

export function compileGeneratedScenario(args: {
  board: BoardState;
  payload: GeneratedGamePayload;
  world: BoardWorldState;
  premise: string;
  generatedBy: string;
  rawModelOutput?: string;
  validationWarnings?: string[];
}): BoardState {
  const { board, payload, world, premise, generatedBy, rawModelOutput, validationWarnings } = args;
  const generatedContent: GeneratedGameContent = {
    generatedAt: new Date().toISOString(),
    generatedBy,
    premise,
    ...payload,
    rawModelOutput,
    validationWarnings,
  };
  const simulation: SimulationState = {
    seed: Math.abs([...premise].reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) | 0, 17)),
    turn: 0,
    day: 1,
    hour: 8,
    publicConfidence: 65,
    mediaPressure: 10,
    blueTeamCoordination: 15,
    evidenceQuality: 10,
    cityTension: 20,
    economyIndex: 100,
    factions: compileFactions(payload),
    shops: compileShops(payload, world),
    skills: compileSkills(payload),
    lastResolution: "New Game compiled successfully.",
  };

  return {
    ...board,
    version: 3,
    world,
    generatedContent,
    simulation,
    entities: compileEntities(payload, world),
    notes: `${payload.storyline}\n\nOpening mission: ${payload.openingMission}`,
    phases: [
      { id: "phase-onboarding", name: "Guided Start", description: payload.tutorialSummary, order: 0 },
      { id: "phase-act-1", name: "Act I — Zero State", description: payload.openingMission, order: 1 },
      { id: "phase-act-2", name: "Act II — Signals", description: "Factions and institutions begin reacting to accumulated patterns.", order: 2 },
      { id: "phase-act-3", name: "Act III — Networks", description: "Economy, relationships, cases and territory interact.", order: 3 },
      { id: "phase-act-4", name: "Act IV — Fracture", description: "Pressure exposes weak alliances and disputed memories.", order: 4 },
      { id: "phase-act-5", name: "Act V — Resolution", description: "The simulation resolves from evidence, influence, legitimacy and survival.", order: 5 },
    ],
    currentPhaseId: "phase-onboarding",
    timelineEvents: [
      ...board.timelineEvents,
      {
        id: nanoid(10),
        phaseId: "phase-onboarding",
        label: "AI world compiled",
        description: `${payload.openingMission} (${payload.factions.length} factions, ${payload.assets.length} assets, ${simulation.shops.length} shops).`,
        severity: "info",
        createdAt: new Date().toISOString(),
        sourceStatus: "fictional",
      },
    ],
  };
}
