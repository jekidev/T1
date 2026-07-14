import test from "node:test";
import assert from "node:assert/strict";
import { createFactionEntity, createUnitEntity } from "./entityFactory";
import { StrategyWorld } from "./world";
import { SYSTEM_ORDER } from "../systems/types";

void test("Miniplex world creates and queries strategy entities", () => {
  const world = new StrategyWorld();
  world.add(createFactionEntity({ id: "faction-a", name: "Faction A", tick: 0 }));

  for (let index = 0; index < 100; index += 1) {
    world.add(createUnitEntity({
      id: `unit-${String(index).padStart(3, "0")}`,
      factionId: "faction-a",
      tick: 0,
      position: { x: index, y: 0, z: 0 },
    }));
  }

  assert.equal(world.entitiesById.size, 101);
  assert.equal([...world.queries.factions].length, 1);
  assert.equal([...world.queries.units].length, 100);
  assert.equal([...world.queries.moving].length, 100);
  assert.equal(world.get("unit-050")?.faction?.factionId, "faction-a");

  assert.equal(world.remove("unit-050"), true);
  assert.equal(world.remove("unit-050"), false);
  assert.equal([...world.queries.units].length, 99);
});

void test("system order is stable and documented", () => {
  assert.deepEqual(SYSTEM_ORDER, [
    "commands",
    "local-strategy",
    "tactical-intent",
    "path-intent",
    "movement",
    "collision-avoidance",
    "combat",
    "economy",
    "production-construction",
    "territory-visibility",
    "morale-cleanup",
    "finalize",
  ]);
});
