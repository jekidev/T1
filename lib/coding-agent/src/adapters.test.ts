import test from "node:test";
import assert from "node:assert/strict";
import { OpenHandsAdapter } from "./adapters";
import type {
  AgentPatch,
  AgentRun,
  AgentTask,
  CodingTaskPlan,
  RepositoryMap,
} from "./types";

const token = "test-token-with-at-least-24-characters";
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
const task: AgentTask = {
  id: "review-test",
  objective: "Add a focused test",
  signal: "explicit_user_request",
  requestedAdapter: "openhands",
  baseBranch: "main",
  requestedBy: "user",
  allowedPaths: ["lib/example/"],
  labels: [],
  createPullRequest: true,
  limits: { maxIterations: 5, maxCommands: 20, maxFilesChanged: 5, maxPatchLines: 100, maxRuntimeMinutes: 10, maxModelTokens: 20000, maxCost: 5 },
};
const plan: CodingTaskPlan = {
  objective: task.objective,
  reason: "Requested",
  affectedModules: ["lib/example"],
  expectedFiles: ["lib/example/test.ts"],
  risks: [],
  validationSteps: ["pnpm test"],
  rollbackPlan: "Delete branch",
};
const patch: AgentPatch = {
  id: "patch-1",
  runId: "agent-run-review-test",
  baseCommit: map.baseCommit,
  changedFiles: ["lib/example/test.ts"],
  additions: 1,
  deletions: 0,
  diff: "+test('ok', () => {});",
  explanation: "Add a test",
};
const run: AgentRun = {
  id: "agent-run-review-test",
  task,
  adapterId: "openhands",
  status: "validating",
  baseCommit: map.baseCommit,
  branchName: "agent/openhands/review-test",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  plan,
  patch,
  policyDecision: { accepted: true, risk: "low", codes: [], reasons: [], requiresHumanReview: true, requiresExternalReviewer: false },
  commands: [],
  tests: [],
  auditEvents: [],
};

void test("remote reviewer may reject but cannot bypass deterministic validation", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    decision: {
      accepted: false,
      risk: "high",
      codes: ["review.regression_risk"],
      reasons: ["Independent reviewer found a regression risk."],
      requiresHumanReview: true,
      requiresExternalReviewer: false,
    },
    notes: ["Reject candidate."],
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const adapter = new OpenHandsAdapter({ baseUrl: "http://localhost:8080/", token });
    const result = await adapter.reviewPatch({ task, repositoryMap: map, plan, patch });
    assert.equal(result.decision.accepted, false);
    assert.equal(result.decision.risk, "high");
    assert.ok(result.decision.codes.includes("review.regression_risk"));
  } finally {
    globalThis.fetch = original;
  }
});

void test("execute rejects a sandbox that publishes before validation", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    patch,
    commands: [],
    tests: [],
    pullRequestUrl: "https://github.com/example/repo/pull/1",
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const adapter = new OpenHandsAdapter({ baseUrl: "http://localhost:8080/", token });
    await assert.rejects(
      () => adapter.executeTask({ run, repositoryMap: map, plan }),
      /publishing before deterministic patch validation/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

void test("publish rejects an unexpected branch name", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    branchName: "main",
    pullRequestUrl: "https://github.com/example/repo/pull/1",
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const adapter = new OpenHandsAdapter({ baseUrl: "http://localhost:8080/", token });
    await assert.rejects(
      () => adapter.publishPullRequest({ run, repositoryMap: map, plan, patch }),
      /unexpected branch name/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
