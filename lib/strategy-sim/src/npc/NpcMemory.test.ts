import test from "node:test";
import assert from "node:assert/strict";
import { appendNpcMemory, retrieveNpcMemories, selectReflectionCandidates } from "./NpcMemory";
import type { NPCMemoryRecord } from "./types";

const memories: NPCMemoryRecord[] = [
  { id: "m1", tick: 10, type: "interaction", summary: "Met player at the hospital", entityIds: ["player"], tags: ["hospital", "help"], importance: 0.9, emotionalValence: 0.6 },
  { id: "m2", tick: 900, type: "observation", summary: "Saw rain outside the shop", entityIds: [], tags: ["weather"], importance: 0.1, emotionalValence: 0 },
  { id: "m3", tick: 850, type: "event", summary: "Player broke a promise", entityIds: ["player"], tags: ["trust"], importance: 1, emotionalValence: -0.8 },
];

void test("retrieval combines relevance importance and recency", () => {
  const ranked = retrieveNpcMemories(memories, { tick: 1000, entityIds: ["player"], tags: ["trust"], text: "promise", limit: 2 });
  assert.equal(ranked[0]?.memory.id, "m3");
  assert.equal(ranked.length, 2);
});

void test("expired memories are removed when appending", () => {
  const next = appendNpcMemory([
    { id: "old", tick: 1, type: "observation", summary: "temporary", entityIds: [], tags: [], importance: 0.1, emotionalValence: 0, expiresAtTick: 5 },
  ], { id: "new", tick: 10, type: "event", summary: "persistent", entityIds: [], tags: [], importance: 0.5, emotionalValence: 0 });
  assert.deepEqual(next.map(memory => memory.id), ["new"]);
});

void test("reflection requires enough accumulated importance", () => {
  const selected = selectReflectionCandidates(memories, 1000, 1.5);
  assert.ok(selected.length >= 2);
  assert.equal(selectReflectionCandidates([memories[1]!], 1000, 1.5).length, 0);
});
