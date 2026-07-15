import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentNetworkAuthorization,
  evaluateAgentNetworkPolicy,
  validateAgentNetworkAudit,
} from "./networkPolicy";
import type { AgentTask } from "./types";

function task(overrides: Partial<AgentTask["networkPolicy"]> = {}): AgentTask {
  return {
    id: "network-test",
    objective: "Test network policy",
    signal: "explicit_user_request",
    requestedAdapter: "openhands",
    baseBranch: "main",
    requestedBy: "test",
    allowedPaths: ["lib/example/"],
    labels: [],
    createPullRequest: true,
    networkPolicy: {
      mode: "ask_first",
      approvedHosts: [],
      approvedCapabilities: [],
      ...overrides,
    },
    limits: {
      maxIterations: 5,
      maxCommands: 20,
      maxFilesChanged: 5,
      maxPatchLines: 100,
      maxRuntimeMinutes: 10,
      maxModelTokens: 20_000,
      maxCost: 5,
    },
  };
}

void test("Ask First without approvals becomes deny-all", () => {
  const current = task();
  const decision = evaluateAgentNetworkPolicy(current);
  const authorization = buildAgentNetworkAuthorization(current, new Date("2026-07-15T00:00:00.000Z"));
  assert.equal(decision.accepted, true);
  assert.equal(authorization.mode, "deny");
  assert.deepEqual(authorization.allowedHosts, []);
  assert.deepEqual(authorization.allowedCapabilities, []);
});

void test("Ask First binds access to explicit hosts and capabilities", () => {
  const current = task({ approvedHosts: ["docs.example.com"], approvedCapabilities: ["source_docs", "web_fetch"] });
  const authorization = buildAgentNetworkAuthorization(current, new Date("2026-07-15T00:00:00.000Z"));
  assert.equal(authorization.mode, "allowlisted");
  assert.deepEqual(authorization.allowedHosts, ["docs.example.com"]);
  assert.deepEqual(authorization.allowedCapabilities, ["source_docs", "web_fetch"]);
});

void test("Ultra requires explicit approver and timestamp", () => {
  const rejected = evaluateAgentNetworkPolicy(task({ mode: "ultra" }));
  assert.equal(rejected.accepted, false);
  const approvedTask = task({ mode: "ultra", approvedBy: "coding-agent-admin", approvedAt: "2026-07-15T00:00:00.000Z" });
  const accepted = evaluateAgentNetworkPolicy(approvedTask);
  const authorization = buildAgentNetworkAuthorization(approvedTask, new Date("2026-07-15T00:00:30.000Z"));
  assert.equal(accepted.accepted, true);
  assert.equal(authorization.mode, "ultra");
});

void test("firewall audit rejects an unapproved allowed request", () => {
  const authorization = buildAgentNetworkAuthorization(task({ approvedHosts: ["docs.example.com"], approvedCapabilities: ["source_docs"] }));
  const result = validateAgentNetworkAudit({
    authorization,
    audit: {
      mode: "allowlisted",
      enforcement: "sandbox_firewall",
      privateNetworkBlocked: true,
      metadataEndpointsBlocked: true,
      redirectsRevalidated: true,
      requests: [{
        at: new Date().toISOString(),
        capability: "web_fetch",
        method: "GET",
        origin: "https://other.example.com",
        path: "/guide",
        allowed: true,
        reason: "test",
      }],
    },
  });
  assert.equal(result.accepted, false);
  assert.ok(result.codes.includes("network.capability_not_approved"));
  assert.ok(result.codes.includes("network.host_not_approved"));
});

void test("matching deny audit is accepted", () => {
  const authorization = buildAgentNetworkAuthorization(task());
  const result = validateAgentNetworkAudit({
    authorization,
    audit: {
      mode: "deny",
      enforcement: "sandbox_firewall",
      privateNetworkBlocked: true,
      metadataEndpointsBlocked: true,
      redirectsRevalidated: true,
      requests: [],
    },
  });
  assert.equal(result.accepted, true);
});
