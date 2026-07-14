import test from "node:test";
import assert from "node:assert/strict";
import { createAssetJob, failAssetJob, transitionAssetJob } from "./jobMachine";

const request = {
  kind: "image_to_3d" as const,
  sourceAssetId: "source-1",
  generatorPreference: ["hunyuan3d-2" as const, "instantmesh" as const],
  assetType: "prop" as const,
  targetPolygonCount: 50_000,
  lodCount: 3,
  removeBackground: true,
  licenseStatus: "unverified" as const,
  publishAfterValidation: false,
};

void test("asset jobs follow the production pipeline in order", () => {
  let job = createAssetJob({ id: "job-1", request }, new Date("2026-01-01T00:00:00.000Z"));
  job = transitionAssetJob(job, "validating_input");
  job = transitionAssetJob(job, "preprocessing");
  job = transitionAssetJob(job, "generating");
  job = transitionAssetJob(job, "blender_processing");
  job = transitionAssetJob(job, "validating_output");
  job = transitionAssetJob(job, "awaiting_review");
  job = transitionAssetJob(job, "published");

  assert.equal(job.status, "published");
  assert.equal(job.progress, 1);
  assert.ok(job.startedAt);
  assert.ok(job.completedAt);
});

void test("invalid job transitions are rejected", () => {
  const job = createAssetJob({ id: "job-2", request });
  assert.throws(() => transitionAssetJob(job, "published"), /Invalid asset job transition/);
});

void test("failed jobs retain the failed stage and can be retried", () => {
  const validating = transitionAssetJob(createAssetJob({ id: "job-3", request }), "validating_input");
  const failed = failAssetJob(validating, {
    code: "input.invalid",
    message: "Invalid source image.",
    retryable: true,
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.error?.stage, "validating_input");

  const retried = transitionAssetJob(failed, "queued");
  assert.equal(retried.status, "queued");
  assert.equal(retried.error, undefined);
});
