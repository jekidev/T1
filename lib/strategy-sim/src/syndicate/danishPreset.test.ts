import test from "node:test";
import assert from "node:assert/strict";
import {
  DANISH_DECENTRALIZED_SYNDICATE_ROLES,
  FICTIONAL_DANISH_BACKGROUND_PRESETS,
  applyDanishSyndicatePreset,
} from "./danishPreset";

void test("Danish decentralized role preset keeps required role ids", () => {
  const ids = new Set(DANISH_DECENTRALIZED_SYNDICATE_ROLES.map(role => role.id));
  assert.ok(ids.has("role-leader"));
  assert.ok(ids.has("role-underboss"));
  assert.ok(ids.has("role-advisor"));
  assert.ok(ids.has("role-captain"));
  assert.ok(ids.has("role-associate"));
});

void test("identity and support backgrounds contain no behavioral modifiers", () => {
  for (const preset of FICTIONAL_DANISH_BACKGROUND_PRESETS) {
    assert.deepEqual(preset.gameplayModifiers, {});
    assert.ok(preset.contextTags.length > 0);
  }
});

void test("applying the preset does not mutate the input", () => {
  const original = { hierarchy: [], value: 7 };
  const result = applyDanishSyndicatePreset(original);
  assert.equal(original.hierarchy.length, 0);
  assert.equal(result.value, 7);
  assert.notEqual(result.hierarchy, DANISH_DECENTRALIZED_SYNDICATE_ROLES);
  assert.equal(result.hierarchy.length, DANISH_DECENTRALIZED_SYNDICATE_ROLES.length);
});
