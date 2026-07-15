import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBoard, DEFAULT_ATTRIBUTES } from "@/lib/game";
import {
  applyAdvisorBuildProposal,
  createStorylineWorkflowPrompts,
  extractAdvisorBuildProposal,
} from "./advisor-workflow";

void test("Create Storyline produces Talk Plan Build in order", () => {
  const steps = createStorylineWorkflowPrompts({
    scenarioName: "Test World",
    scenarioDescription: "A test scenario",
    moralSpectrum: 63,
  });
  assert.deepEqual(steps.map(step => step.mode), ["talk", "plan", "build"]);
  assert.ok(steps.every(step => step.prompt.includes("63/100")));
});

void test("extracts one fenced additive build proposal", () => {
  const proposal = extractAdvisorBuildProposal(`Implementation notes.\n\n\`\`\`json\n{
    "notesAppend": "New storyline slice",
    "phases": [{"name":"Act I","description":"Opening"}],
    "timelineEvents": [{"label":"Arrival","description":"The boss arrives","severity":"info"}],
    "entities": [{"label":"First Contact","category":"unit","faction":"neutral","notes":"Fictional NPC"}]
  }\n\`\`\``);
  assert.ok(proposal);
  assert.equal(proposal?.phases?.[0]?.name, "Act I");
  assert.equal(proposal?.entities?.[0]?.faction, "neutral");
});

void test("build application preserves existing board content", () => {
  const board = createEmptyBoard("google-map");
  board.notes = "Existing notes";
  board.entities.push({
    id: "existing-unit",
    templateId: "unit-network",
    category: "unit",
    faction: "criminal",
    label: "Existing Unit",
    x: 100,
    y: 100,
    rotation: 0,
    scale: 1,
    zIndex: 0,
    layerId: "layer-default",
    zoneId: null,
    groupId: null,
    locked: false,
    attributes: { ...DEFAULT_ATTRIBUTES },
    notes: "Must survive",
    sourceStatus: "fictional",
  });
  board.timelineEvents.push({
    id: "existing-event",
    phaseId: board.currentPhaseId,
    label: "Existing Event",
    description: "Must survive",
    severity: "info",
    createdAt: new Date(0).toISOString(),
    sourceStatus: "fictional",
  });

  const next = applyAdvisorBuildProposal(board, {
    notesAppend: "Added notes",
    phases: [{ name: "New Phase", description: "Added phase" }],
    timelineEvents: [{ label: "New Event", description: "Added event", severity: "caution" }],
    entities: [{ label: "New Unit", category: "unit", faction: "neutral", notes: "Added unit" }],
  });

  assert.ok(next.notes.includes("Existing notes"));
  assert.ok(next.notes.includes("Added notes"));
  assert.ok(next.entities.some(entity => entity.id === "existing-unit"));
  assert.ok(next.entities.some(entity => entity.label === "New Unit"));
  assert.ok(next.timelineEvents.some(event => event.id === "existing-event"));
  assert.ok(next.timelineEvents.some(event => event.label === "New Event"));
  assert.ok(next.phases.some(phase => phase.name === "New Phase"));
});

void test("invalid or unfenced model output is not applied", () => {
  assert.equal(extractAdvisorBuildProposal("plain text only"), null);
  assert.equal(extractAdvisorBuildProposal("```json\nnot-json\n```"), null);
});
