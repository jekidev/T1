import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLlmWorkspaceContext,
  defaultWorkspaceState,
  type UserWorkspaceState,
} from "./workspace";

function state(overrides: Partial<UserWorkspaceState> = {}): UserWorkspaceState {
  return { ...defaultWorkspaceState(), ...overrides };
}

void test("workspace includes storyline player and GitHub workflows", () => {
  const workspace = defaultWorkspaceState();
  const ids = workspace.workflows.map(workflow => workflow.id);
  assert.ok(ids.includes("workflow-create-storyline"));
  assert.ok(ids.includes("workflow-build-player"));
  assert.ok(ids.includes("workflow-integrate-github"));
  assert.equal(workspace.chatMode, "talk");
  assert.equal(workspace.llmMoralSpectrum, 50);
});

void test("Talk mode forbids authoritative changes", () => {
  const context = buildLlmWorkspaceContext(state({ chatMode: "talk", llmMoralSpectrum: 80 }));
  assert.match(context, /Active collaboration mode: TALK/);
  assert.match(context, /80\/100/);
  assert.match(context, /Do not output an apply-ready state mutation/);
});

void test("Plan mode requires validation and stops before implementation", () => {
  const context = buildLlmWorkspaceContext(state({ chatMode: "plan", llmMoralSpectrum: 35 }));
  assert.match(context, /Active collaboration mode: PLAN/);
  assert.match(context, /acceptance criteria/);
  assert.match(context, /Stop before implementation/);
});

void test("Build mode exposes additive player profile contract", () => {
  const context = buildLlmWorkspaceContext(state({ chatMode: "build", llmMoralSpectrum: 10 }));
  assert.match(context, /Active collaboration mode: BUILD/);
  assert.match(context, /playerProfile/);
  assert.match(context, /The user must press Apply/);
  assert.match(context, /Never delete or rewrite existing RAG/);
});

void test("moral spectrum is clamped to one through one hundred", () => {
  assert.match(buildLlmWorkspaceContext(state({ llmMoralSpectrum: -500 })), /1\/100/);
  assert.match(buildLlmWorkspaceContext(state({ llmMoralSpectrum: 500 })), /100\/100/);
});
