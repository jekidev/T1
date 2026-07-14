import test from "node:test";
import assert from "node:assert/strict";
import { StrategySimulation } from "../StrategySimulation";
import type { StrategyEntity } from "../ecs/components";

function entity(input: Partial<StrategyEntity> & Pick<StrategyEntity, "identity">): StrategyEntity {
  return input;
}

void test("enemy units outside vision are omitted from faction view", () => {
  const simulation = new StrategySimulation({ seed: 1 });
  simulation.addEntity(entity({
    identity: { id: "blue-unit", kind: "unit", createdTick: 0 },
    faction: { factionId: "blue" },
    transform: { position: { x: 0, y: 0, z: 0 }, previousPosition: { x: 0, y: 0, z: 0 }, rotationY: 0 },
    unit: { unitType: "scout", movementSpeed: 1, visionRange: 10, captureStrength: 1 },
  }));
  simulation.addEntity(entity({
    identity: { id: "red-far", kind: "unit", createdTick: 0 },
    faction: { factionId: "red" },
    transform: { position: { x: 100, y: 0, z: 0 }, previousPosition: { x: 100, y: 0, z: 0 }, rotationY: 0 },
    unit: { unitType: "enemy", movementSpeed: 1, visionRange: 10, captureStrength: 1 },
  }));

  const view = simulation.exportFactionView("blue");
  assert.ok(view.visibleEntities.some(value => value.identity.id === "blue-unit"));
  assert.ok(!view.visibleEntities.some(value => value.identity.id === "red-far"));
  assert.deepEqual(view.omittedEntityIds, ["red-far"]);
});

void test("hidden units remain omitted when not detectable", () => {
  const simulation = new StrategySimulation({ seed: 2 });
  simulation.addEntity(entity({
    identity: { id: "blue-unit", kind: "unit", createdTick: 0 },
    faction: { factionId: "blue" },
    transform: { position: { x: 0, y: 0, z: 0 }, previousPosition: { x: 0, y: 0, z: 0 }, rotationY: 0 },
    unit: { unitType: "scout", movementSpeed: 1, visionRange: 10, captureStrength: 1 },
  }));
  simulation.addEntity(entity({
    identity: { id: "red-hidden", kind: "unit", createdTick: 0 },
    faction: { factionId: "red" },
    transform: { position: { x: 2, y: 0, z: 0 }, previousPosition: { x: 2, y: 0, z: 0 }, rotationY: 0 },
    unit: { unitType: "hidden", movementSpeed: 1, visionRange: 10, captureStrength: 1 },
    visibility: { hidden: true, detectableByAdjacentUnits: false, providesVision: true, rememberWhenExplored: false },
  }));

  const view = simulation.exportFactionView("blue");
  assert.deepEqual(view.omittedEntityIds, ["red-hidden"]);
});

void test("static explored entities return stale memory instead of live state", () => {
  const simulation = new StrategySimulation({ seed: 3 });
  simulation.addEntity(entity({
    identity: { id: "blue-unit", kind: "unit", createdTick: 0 },
    faction: { factionId: "blue" },
    transform: { position: { x: 0, y: 0, z: 0 }, previousPosition: { x: 0, y: 0, z: 0 }, rotationY: 0 },
    unit: { unitType: "scout", movementSpeed: 1, visionRange: 10, captureStrength: 1 },
  }));
  const building = simulation.addEntity(entity({
    identity: { id: "public-building", kind: "building", createdTick: 0 },
    transform: { position: { x: 5, y: 0, z: 0 }, previousPosition: { x: 5, y: 0, z: 0 }, rotationY: 0 },
    building: { buildingType: "hospital", constructionProgress: 1, operational: true },
  }));

  const observed = simulation.exportFactionView("blue");
  assert.ok(observed.memory["public-building"]);
  building.transform!.position.x = 100;
  building.building!.operational = false;

  const later = simulation.exportFactionView("blue", observed.memory);
  assert.equal(later.rememberedEntities[0]?.entity.building?.operational, true);
  assert.equal(later.rememberedEntities[0]?.entity.transform?.position.x, 5);
  assert.ok(!later.visibleEntities.some(value => value.identity.id === "public-building"));
});
