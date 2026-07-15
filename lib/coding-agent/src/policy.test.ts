import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentNetworkAuthorization,
  validateAgentNetworkAudit,
} from "./networkPolicy";
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
    networkPolicy: { mode: "ask_first", approvedHosts: [], approvedCapabilities: [] },
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

void test("Ask First defaults to a deny authorization", () => {
  const authorization = buildAgentNetworkAuthorization(task(), new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(authorization.mode, "deny");
  assert.deepEqual(authorization.allowedHosts, []);
  assert.deepEqual(authorization.allowedCapabilities, []);
});

void test("Ask First accepts only explicitly approved public hosts and capabilities", () => {
  const current = task({
    networkPolicy: {
      mode: "ask_first",
      approvedHosts: ["docs.example.com"],
      approvedCapabilities: ["source_docs"],
      approvedBy: "user",
      approvedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  const decision = evaluateTaskPolicy(current, map);
  const authorization = buildAgentNetworkAuthorization(current, new Date("2026-01-01T00:01:00.000Z"));
  assert.equal(decision.accepted, true);
  assert.equal(authorization.mode, "allowlisted");
  assert.deepEqual(authorization.allowedHosts, ["docs.example.com"]);
  assert.deepEqual(authorization.allowedCapabilities, ["source_docs"]);
});

void test("private or wildcard Ask First hosts are rejected", () => {
  const privateDecision = evaluateTaskPolicy(task({
    networkPolicy: { mode: "ask_first", approvedHosts: ["localhost"], approvedCapabilities: ["web_fetch"] },
  }), map);
  const wildcardDecision = evaluateTaskPolicy(task({
    networkPolicy: { mode: "ask_first", approvedHosts: ["*.example.com"], approvedCapabilities: ["web_fetch"] },
  }), map);
  assert.equal(privateDecision.accepted, false);
  assert.equal(wildcardDecision.accepted, false);
});

void test("Ultra requires explicit user approval metadata", () => {
  const missing = evaluateTaskPolicy(task({
    networkPolicy: { mode: "ultra", approvedHosts: [], approvedCapabilities: [] },
  }), map);
  const approved = evaluateTaskPolicy(task({
    networkPolicy: {
      mode: "ultra",
      approvedHosts: [],
      approvedCapabilities: [],
      approvedBy: "user",
      approvedAt: "2026-01-01T00:00:00.000Z",
    },
  }), map);
  assert.equal(missing.accepted, false);
  assert.equal(approved.accepted, true);
  assert.equal(approved.risk, "high");
});

void test("sandbox network audit rejects access while authorization is deny", () => {
  const authorization = buildAgentNetworkAuthorization(task(), new Date("2026-01-01T00:00:00.000Z"));
  const result = validateAgentNetworkAudit({
    authorization,
    audit: {
      mode: "deny",
      enforcement: "sandbox_firewall",
      requests: [{
        at: "2026-01-01T00:00:01.000Z",
        capability: "web_fetch",
        method: "GET",
        origin: "https://example.com",
        path: "/docs",
        allowed: true,
        reason: "Unexpected request",
      }],
      privateNetworkBlocked: true,
      metadataEndpointsBlocked: true,
      redirectsRevalidated: true,
    },
  });
  assert.equal(result.accepted, false);
  assert.ok(result.codes.includes("network.request_while_denied"));
});
