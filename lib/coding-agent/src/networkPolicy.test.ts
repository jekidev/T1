import test from "node:test";
import assert from "node:assert/strict";
import {
  isNetworkDomainAllowed,
  networkModeFromLabels,
  networkPolicyLabels,
  resolveAgentNetworkPolicy,
} from "./networkPolicy";

void test("ask first is the default and blocks unapproved browsing", () => {
  const policy = resolveAgentNetworkPolicy([]);
  assert.equal(policy.mode, "ask_first");
  assert.equal(isNetworkDomainAllowed(policy, "openrouter.ai", "model"), true);
  assert.equal(isNetworkDomainAllowed(policy, "example.com", "agent"), false);
});

void test("ask first allows only explicitly approved domains", () => {
  const labels = networkPolicyLabels({ mode: "ask_first", approvedDomains: ["docs.example.com"] });
  const policy = resolveAgentNetworkPolicy(labels);
  assert.equal(isNetworkDomainAllowed(policy, "docs.example.com", "agent"), true);
  assert.equal(isNetworkDomainAllowed(policy, "sub.docs.example.com", "agent"), true);
  assert.equal(isNetworkDomainAllowed(policy, "other.example.com", "agent"), false);
});

void test("ultra requires the explicit confirmed label and permits all domains", () => {
  assert.equal(networkModeFromLabels(["network-ultra-confirmed"]), "ultra");
  const policy = resolveAgentNetworkPolicy(["network-ultra-confirmed"]);
  assert.equal(isNetworkDomainAllowed(policy, "arbitrary.example", "agent"), true);
});

void test("offline blocks agent browsing but keeps model transport separate", () => {
  const policy = resolveAgentNetworkPolicy(["network-offline"]);
  assert.equal(isNetworkDomainAllowed(policy, "example.com", "agent"), false);
  assert.equal(isNetworkDomainAllowed(policy, "api.openai.com", "model"), true);
});
