import test from "node:test";
import assert from "node:assert/strict";
import { CodingAgentRunManager } from "./runManager";
import type {
  AgentTask,
  CodingAgentAdapter,
  CodingTaskExecutionInput,
  CodingTaskInput,
  PatchReviewInput,
  RepositoryAnalysisInput,
  RepositoryMap,
} from "./types";

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
  id: "add-test",
  objective: "Add a focused test",
  signal: "explicit_user_request",
  requestedAdapter: "aider",
  baseBranch: "main",
  requestedBy: "user",
  allowedPaths: ["lib/example/"],
  labels: [],
  limits: { maxIterations: 5, maxCommands: 20, maxFilesChanged: 5, maxPatchLines: 100, maxRuntimeMinutes: 10, maxModelTokens: 20000, maxCost: 5 },
};

class MockAdapter implements CodingAgentAdapter {
  readonly id = "aider" as const;
  constructor(private readonly passing: boolean) {}
  async analyzeRepository(_input: RepositoryAnalysisInput) { return map; }
  async planTask(_input: CodingTaskInput) {
    return { objective: "Add test", reason: "Requested", affectedModules: ["lib/example"], expectedFiles: ["lib/example/test.ts"], risks: [], validationSteps: ["pnpm test"], rollbackPlan: "Delete branch" };
  }
  async executeTask(input: CodingTaskExecutionInput) {
    return {
      patch: { id: "patch-1", runId: input.run.id, baseCommit: map.baseCommit, changedFiles: ["lib/example/test.ts"], additions: 1, deletions: 0, diff: "+test('ok', () => {});", explanation: "Add test" },
      commands: [{ command: "pnpm test", exitCode: this.passing ? 0 : 1, stdout: "", stderr: "", durationMs: 1, timedOut: false }],
      tests: [{ name: "tests", command: "pnpm test", passed: this.passing, exitCode: this.passing ? 0 : 1, durationMs: 1, summary: this.passing ? "passed" : "failed" }],
    };
  }
  async reviewPatch(_input: PatchReviewInput) {
    return { decision: { accepted: true, risk: "low" as const, codes: [], reasons: [], requiresHumanReview: true, requiresExternalReviewer: false }, notes: [] };
  }
  async stop(_runId: string) {}
}

void test("passing patches stop at human review instead of auto merge", async () => {
  const manager = new CodingAgentRunManager([new MockAdapter(true)]);
  const run = manager.createRun(task, map);
  const completed = await manager.executeRun(run.id, map);
  assert.equal(completed.status, "awaiting_review");
  assert.equal(completed.branchName, "agent/aider/add-test");
  assert.equal(completed.pullRequestUrl, undefined);
});

void test("failed tests reject the patch", async () => {
  const manager = new CodingAgentRunManager([new MockAdapter(false)]);
  const run = manager.createRun(task, map);
  const completed = await manager.executeRun(run.id, map);
  assert.equal(completed.status, "rejected");
  assert.equal(completed.policyDecision?.accepted, false);
});
