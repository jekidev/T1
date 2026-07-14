import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryRecord, filterEntitiesForFaction, visibilityStateForPoint } from "./fog";

const source = {
  id: "vision-1",
  factionId: "blue",
  coordinates: { latitude: 55.6761, longitude: 12.5683, altitude: 0 },
  radiusMeters: 500,
  heightMeters: 2,
  detectsHidden: false,
};

void test("visibility states distinguish visible explored and unexplored", () => {
  assert.equal(visibilityStateForPoint({ latitude: 55.677, longitude: 12.5683, altitude: 0 }, "blue", [source], false), "currently_visible");
  assert.equal(visibilityStateForPoint({ latitude: 55.69, longitude: 12.5683, altitude: 0 }, "blue", [source], true), "explored");
  assert.equal(visibilityStateForPoint({ latitude: 55.69, longitude: 12.5683, altitude: 0 }, "blue", [source], false), "unexplored");
});

void test("hidden enemy data is omitted instead of visually hidden", () => {
  const hiddenEnemy = {
    id: "enemy-hidden",
    factionId: "red",
    coordinates: { latitude: 55.6762, longitude: 12.5683, altitude: 0 },
    dynamic: true,
    hidden: true,
    payload: { secret: "must-not-reach-client" },
  };
  const result = filterEntitiesForFaction({
    factionId: "blue",
    tick: 10,
    entities: [hiddenEnemy],
    visionSources: [source],
  });
  assert.deepEqual(result.visibleEntities, []);
  assert.deepEqual(result.rememberedEntities, []);
  assert.deepEqual(result.omittedEntityIds, ["enemy-hidden"]);
});

void test("explored static objects may return only remembered snapshots", () => {
  const building = {
    id: "building-1",
    coordinates: { latitude: 55.69, longitude: 12.5683, altitude: 0 },
    dynamic: false,
    payload: { category: "hospital" },
  };
  const memory = new Map([[building.id, createMemoryRecord(building, 5)]]);
  const result = filterEntitiesForFaction({
    factionId: "blue",
    tick: 10,
    entities: [building],
    visionSources: [source],
    exploredEntityIds: new Set([building.id]),
    memory,
  });
  assert.equal(result.visibleEntities.length, 0);
  assert.equal(result.rememberedEntities[0]?.lastObservedTick, 5);
});
