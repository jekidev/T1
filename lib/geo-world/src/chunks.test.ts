import test from "node:test";
import assert from "node:assert/strict";
import { chunkId, chunksForBounds, coordinateToTile, selectStreamingChunks, tileBounds } from "./chunks";

void test("coordinates map to stable slippy tile chunks", () => {
  const tile = coordinateToTile({ latitude: 55.6761, longitude: 12.5683, altitude: 0 }, 15);
  assert.equal(chunkId(tile), `${tile.zoom}/${tile.x}/${tile.y}`);
  const bounds = tileBounds(tile);
  assert.ok(55.6761 >= bounds.south && 55.6761 <= bounds.north);
  assert.ok(12.5683 >= bounds.west && 12.5683 <= bounds.east);
});

void test("bounded region creates a deterministic chunk list", () => {
  const chunks = chunksForBounds({ south: 55.67, west: 12.55, north: 55.68, east: 12.57 }, 15);
  assert.ok(chunks.length > 0);
  assert.deepEqual(chunks.map(chunk => chunk.id), [...chunks.map(chunk => chunk.id)].sort((a, b) => {
    const [za, xa, ya] = a.split("/").map(Number);
    const [zb, xb, yb] = b.split("/").map(Number);
    return za! - zb! || ya! - yb! || xa! - xb!;
  }));
});

void test("streaming selection distinguishes visible and sleeping chunks", () => {
  const chunks = selectStreamingChunks({ latitude: 55.6761, longitude: 12.5683, altitude: 0 }, 15, 1, 2);
  assert.equal(chunks.filter(chunk => chunk.priority === "visible").length, 9);
  assert.equal(chunks.filter(chunk => chunk.priority === "nearby").length, 16);
  assert.equal(chunks[0]?.distance, 0);
});

void test("excessive world regions are rejected", () => {
  assert.throws(() => chunksForBounds({ south: 54, west: 10, north: 58, east: 15 }, 15, 100), /maximum is 100/);
});
