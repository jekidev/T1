import test from "node:test";
import assert from "node:assert/strict";
import { canPublishAsset, validateGeneratedAssetMetadata } from "./validation";
import type { GeneratedAssetMetadata } from "./types";

function validMetadata(overrides: Partial<GeneratedAssetMetadata> = {}): GeneratedAssetMetadata {
  return {
    id: "asset-1",
    sourceType: "image",
    sourceProvider: "grok-image",
    generator: "hunyuan3d-2",
    generatorVersion: "2.0",
    seed: 42,
    licenseStatus: "verified",
    assetType: "prop",
    polygonCount: 50_000,
    textureMemoryBytes: 32 * 1024 * 1024,
    lodCount: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

void test("verified optimized metadata passes publication validation", () => {
  const metadata = validMetadata();
  const validation = validateGeneratedAssetMetadata(metadata);
  assert.equal(validation.valid, true);
  assert.deepEqual(canPublishAsset(metadata, validation), { allowed: true, reasons: [] });
});

void test("unknown license blocks automatic publication", () => {
  const metadata = validMetadata({ licenseStatus: "unverified" });
  const validation = validateGeneratedAssetMetadata(metadata);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some(issue => issue.code === "license.not_verified"));
  assert.equal(canPublishAsset(metadata, validation).allowed, false);
});

void test("characters require the project skeleton", () => {
  const metadata = validMetadata({
    assetType: "character",
    skeletonId: "foreign-skeleton",
    lodCount: 4,
  });
  const validation = validateGeneratedAssetMetadata(metadata);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some(issue => issue.code === "skeleton.incompatible"));
});

void test("polygon and texture budgets are enforced", () => {
  const validation = validateGeneratedAssetMetadata(validMetadata({
    polygonCount: 500_000,
    textureMemoryBytes: 512 * 1024 * 1024,
  }));
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some(issue => issue.code === "mesh.polygon_budget_exceeded"));
  assert.ok(validation.issues.some(issue => issue.code === "texture.memory_budget_exceeded"));
});
