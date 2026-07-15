import test from "node:test";
import assert from "node:assert/strict";
import {
  boardNeedsPresentationMigration,
  normalizeBoardPresentation,
} from "./presentationMigration";
import { createEmptyBoard, DEFAULT_ATTRIBUTES, type BoardEntity } from "./types";

function person(overrides: Partial<BoardEntity> = {}): BoardEntity {
  return {
    id: "person-1",
    templateId: "unit-network",
    category: "unit",
    faction: "criminal",
    label: "Test Person",
    x: 100,
    y: 100,
    rotation: 0,
    scale: 1,
    zIndex: 0,
    layerId: "layer-default",
    zoneId: null,
    groupId: null,
    locked: false,
    attributes: { ...DEFAULT_ATTRIBUTES },
    notes: "Captain\nGoal: Coordinate the district team",
    ...overrides,
  };
}

void test("legacy people and environments migrate once", () => {
  const board = createEmptyBoard("custom");
  board.version = 6;
  board.environment = undefined;
  board.world = {
    country: "Denmark",
    region: "Capital Region",
    municipality: "Copenhagen",
    city: "Copenhagen",
    latitude: 55.6761,
    longitude: 12.5683,
    workAreaRadiusKm: 8,
    mapProvider: "google",
    language: "da",
    currency: "DKK",
    timezone: "Europe/Copenhagen",
  };
  board.entities = [person()];

  assert.equal(boardNeedsPresentationMigration(board), true);
  const migrated = normalizeBoardPresentation(board);
  assert.equal(migrated.version, 7);
  assert.equal(migrated.environment?.sceneName, "Copenhagen scene");
  assert.equal(migrated.environment?.mapMode, "google");
  assert.equal(migrated.entities[0]?.profile?.role, "Captain");
  assert.deepEqual(migrated.entities[0]?.profile?.experience, ["Coordinate the district team"]);
  assert.equal(migrated.entities[0]?.profile?.walletMinor, 0);
  assert.equal(boardNeedsPresentationMigration(migrated), false);
});

void test("migration preserves existing profile identity and avatar", () => {
  const board = createEmptyBoard("custom");
  board.entities = [person({
    profile: {
      personality: "Calm and deliberate",
      biography: "Existing biography",
      traits: ["patient"],
      source: "manual",
      username: "@existing",
      role: "Advisor",
      status: "online",
      lastSeen: "Now",
      experience: ["Negotiation"],
      walletMinor: 12500,
      maximumRecordedWalletMinor: 9000,
      accent: "#123456",
      avatarAssetId: "asset-1",
      avatarUrl: "/assets/asset-1",
    },
  })];

  const migrated = normalizeBoardPresentation(board);
  const profile = migrated.entities[0]?.profile;
  assert.equal(profile?.personality, "Calm and deliberate");
  assert.equal(profile?.username, "@existing");
  assert.equal(profile?.avatarAssetId, "asset-1");
  assert.equal(profile?.maximumRecordedWalletMinor, 12500);
  assert.equal(boardNeedsPresentationMigration(migrated), false);
});
