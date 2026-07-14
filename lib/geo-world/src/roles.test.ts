import test from "node:test";
import assert from "node:assert/strict";
import { deriveDefaultGameplayRole, validateGameplayLocationRole } from "./roles";
import type { ImportedPlace } from "./types";

const residence: ImportedPlace = {
  sourceId: "osm:way:1",
  source: "osm",
  publicCategory: "residence",
  coordinates: { latitude: 55.676, longitude: 12.568, altitude: 0 },
  publicTags: { building: "residential" },
};

const warehouse: ImportedPlace = {
  sourceId: "osm:way:2",
  source: "osm",
  publicCategory: "warehouse",
  coordinates: { latitude: 55.677, longitude: 12.569, altitude: 0 },
  publicTags: { building: "warehouse" },
};

void test("default gameplay role follows only the public category", () => {
  assert.equal(deriveDefaultGameplayRole(warehouse).role, "warehouse");
  assert.equal(deriveDefaultGameplayRole(residence).role, "residence");
});

void test("real residences cannot be marked as stashhouses", () => {
  assert.throws(() => validateGameplayLocationRole(residence, {
    placeId: residence.sourceId,
    role: "stashhouse",
    fictionalized: true,
    assignedBy: "player",
  }), /real residential place/);
});

void test("fictional scenario roles remain separate from public category", () => {
  const role = validateGameplayLocationRole(warehouse, {
    placeId: warehouse.sourceId,
    role: "safehouse",
    fictionalized: true,
    assignedBy: "scenario",
  });
  assert.equal(role.role, "safehouse");
  assert.equal(warehouse.publicCategory, "warehouse");
});

void test("fiction-only roles require an explicit fictionalized flag", () => {
  assert.throws(() => validateGameplayLocationRole(warehouse, {
    placeId: warehouse.sourceId,
    role: "safehouse",
    fictionalized: false,
    assignedBy: "generator",
  }), /must be explicitly fictionalized/);
});
