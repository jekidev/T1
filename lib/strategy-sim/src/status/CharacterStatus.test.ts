import test from "node:test";
import assert from "node:assert/strict";
import { applyCharacterStatusEvent, createDefaultCharacterStatus, replayCharacterStatusEvents } from "./CharacterStatus";

void test("health vitality and balance events are deterministic", () => {
  let status = createDefaultCharacterStatus();
  status = applyCharacterStatusEvent(status, { id: "e1", tick: 1, type: "damage", amount: 25, reason: "test", schemaVersion: 1 });
  status = applyCharacterStatusEvent(status, { id: "e2", tick: 2, type: "stress", amount: 20, reason: "test", schemaVersion: 1 });
  status = applyCharacterStatusEvent(status, { id: "e3", tick: 3, type: "rest", amount: 10, reason: "test", schemaVersion: 1 });
  assert.equal(status.health.current, 75);
  assert.equal(status.balance.stress, 20);
  assert.equal(status.balance.stability, 65);
  assert.equal(status.vitality.fatigue, 0);
});

void test("karma and faction reputation come only from versioned events", () => {
  const replay = replayCharacterStatusEvents(createDefaultCharacterStatus(), [
    { id: "b", tick: 2, type: "karma", amount: 10, reason: "helped civilian", schemaVersion: 1 },
    { id: "a", tick: 1, type: "faction_reputation", amount: 15, factionId: "civilians", reason: "helped civilian", schemaVersion: 1 },
    { id: "b", tick: 2, type: "karma", amount: 10, reason: "duplicate", schemaVersion: 1 },
  ]);
  assert.equal(replay.status.karma.score, 10);
  assert.equal(replay.status.karma.reputationByFaction.civilians, 15);
  assert.deepEqual(replay.appliedEventIds, ["a", "b"]);
});

void test("injuries require structured events and recover to removal", () => {
  let status = createDefaultCharacterStatus();
  const injury = { id: "injury-1", kind: "sprain", severity: 10, recoveryPerTick: 0.1 };
  status = applyCharacterStatusEvent(status, { id: "e1", tick: 1, type: "injury_add", amount: 0, injury, reason: "test", schemaVersion: 1 });
  status = applyCharacterStatusEvent(status, { id: "e2", tick: 2, type: "injury_recover", amount: 10, injury, reason: "test", schemaVersion: 1 });
  assert.equal(status.health.injuries.length, 0);
});
