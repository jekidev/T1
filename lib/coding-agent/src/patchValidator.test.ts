import test from "node:test";
import assert from "node:assert/strict";
import { validateAgentPatch } from "./patchValidator";
import type { AgentPatch, AgentTask, RepositoryMap } from "./types";

const task: AgentTask = {
  id: "safe-patch",
  objective: "Add a test",
  signal: "explicit_user_request",
  requestedAdapter: "aider",
  baseBranch: "main",
  requestedBy: "user",
  allowedPaths: ["lib/strategy-sim/"],
  labels: [],
  limits: { maxIterations: 5, maxCommands: 20, maxFilesChanged: 5, maxPatchLines: 100, maxRuntimeMinutes: 10, maxModelTokens: 20000, maxCost: 5 },
};

const map: RepositoryMap = {
  baseCommit: "abcdef1234567890",
  files: [],
  modules: [],
  dependencies: [],
  entryPoints: [],
  protectedPaths: [],
  testCommands: ["pnpm test"],
  buildCommands: ["pnpm build"],
  ownershipRules: [],
  generatedAt: new Date(0).toISOString(),
};

function patch(overrides: Partial<AgentPatch> = {}): AgentPatch {
  return {
    id: "patch-1",
    runId: "run-1",
    baseCommit: map.baseCommit,
    changedFiles: ["lib/strategy-sim/src/example.test.ts"],
    additions: 2,
    deletions: 0,
    diff: "+test('works', () => {})\n+export const x = 1;",
    explanation: "Add coverage",
    ...overrides,
  };
}

void test("safe scoped patches pass deterministic validation", () => {
  const result = validateAgentPatch({ task, repositoryMap: map, patch: patch() });
  assert.equal(result.decision.accepted, true);
  assert.equal(result.decision.requiresHumanReview, true);
});

void test("hard coded credentials reject patches", () => {
  const result = validateAgentPatch({ task, repositoryMap: map, patch: patch({ diff: "+const apiKey = 'sk-abcdefghijklmnopqrstuvwxyz123456';" }) });
  assert.equal(result.decision.accepted, false);
  assert.ok(result.decision.codes.includes("secret.openai_key"));
});

void test("dynamic evaluation rejects patches", () => {
  const result = validateAgentPatch({ task, repositoryMap: map, patch: patch({ diff: "+const result = eval(source);" }) });
  assert.equal(result.decision.accepted, false);
  assert.ok(result.decision.codes.includes("code.dynamic_eval"));
});

void test("patch budgets are enforced", () => {
  const result = validateAgentPatch({ task, repositoryMap: map, patch: patch({ additions: 101 }) });
  assert.equal(result.decision.accepted, false);
  assert.ok(result.decision.codes.includes("limits.patch_lines"));
});
