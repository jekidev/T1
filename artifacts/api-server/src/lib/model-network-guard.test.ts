import test from "node:test";
import assert from "node:assert/strict";
import { modelHasIntegratedWebAccess } from "./model-network-guard";

void test("ordinary inference models are allowed", () => {
  assert.equal(modelHasIntegratedWebAccess("openai/gpt-5-mini"), false);
  assert.equal(modelHasIntegratedWebAccess("deepseek/deepseek-chat"), false);
  assert.equal(modelHasIntegratedWebAccess("anthropic/claude-sonnet-4"), false);
});

void test("online and provider-search models are blocked", () => {
  assert.equal(modelHasIntegratedWebAccess("openai/gpt-5-mini:online"), true);
  assert.equal(modelHasIntegratedWebAccess("perplexity/sonar-pro"), true);
  assert.equal(modelHasIntegratedWebAccess("openai/gpt-4o-search-preview"), true);
  assert.equal(modelHasIntegratedWebAccess("vendor/grounded-search-model"), true);
});
