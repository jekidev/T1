import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePatchPaths, evaluateTaskPolicy, expectedAgentBranch } from "./policy";
import type { AgentPatch, AgentTask, RepositoryMap } from "./types";

const map: RepositoryMap = {
  baseCommit: "abcdef1234567890",
  files: [],
  modules: [],
  dependencies: [],
  entryPoints: [],
  protectedPaths: ["deployment/", ".github/workflows/"],
  testCommands: ["pnpm test"],
  buildCommands: ["pnpm build"],
  ownershipRules: [],
  generatedAt: new Date(0).toISOString(),
};

function task(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: "fix-map",
    objective: "Fix map bug",
    signal: "explicit_user_request",
    requestedAdapter: "openhands",
    baseBranch: "main",
    requestedBy: "user",
    allowedPaths: ["artifacts/command-sim/"],
    labels: [],
    createPullRequest: true,
    limits: { maxIterations: 12, maxCommands: 80, maxFilesChanged: 40, maxPatchLines: 8000, maxRuntimeMinutes: 45, maxModelTokens: 250000, maxCost: 25 },
    ...overrides,
  };
}

void test("agent branch naming is isolated and deterministic", () => {
  assert.equal(expectedAgentBranch(task()), "agent/openhands/fix-map");
});

void test("protected paths cannot be requested", () => {
  const result = evaluateTaskPolicy(task({ allowedPaths: ["deployment/"] }), map);
  assert.equal(result.accepted, false);
  assert.ok(result.codes.includes("paths.protected_requested"));
});

void test("self modification requires label and external review", () => {
  const current = task({ allowedPaths: ["lib/coding-agent/"] });
  const taskDecision = evaluateTaskPolicy(current, map);
  assert.equal(taskDecision.requiresExternalReviewer, true);

  const patch: AgentPatch = {
    id: "patch-1",
    runId: "run-1",
    baseCommit: map.baseCommit,
    changedFiles: ["lib/coding-agent/src/types.ts"],
    additions: 1,
    deletions: 0,
    diff: "+export const value = 1;",
    explanation: "test",
  };
  const result = evaluatePatchPaths(current, map, patch);
  assert.equal(result.accepted, false);
  assert.ok(result.codes.includes("patch.self_modification_label_missing"));
});
