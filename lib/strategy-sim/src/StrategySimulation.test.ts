import test from "node:test";
import assert from "node:assert/strict";
import { StrategySimulation } from "./StrategySimulation";
import { createHeadlessScenario } from "./scenarios/createHeadlessScenario";

function configureScenario(seed = 42) {
  const scenario = createHeadlessScenario({ seed, unitsPerFaction: 50, enableLocalAI: false });
  const { simulation, redFactionId, blueFactionId, redUnitIds, blueUnitIds } = scenario;

  assert.equal(simulation.world.entitiesById.size, 106);
  assert.equal([...simulation.world.queries.units].length, 100);

  const rejected = simulation.submitCommand({
    id: "command-invalid-control",
    submittedTick: 1,
    actorFactionId: blueFactionId,
    command: {
      type: "move_units",
      entityIds: [redUnitIds[0]!],
      target: { x: 0, y: 0, z: 0 },
    },
  });
  assert.equal(rejected.accepted, true, "schema-valid commands enter the authoritative queue before tick validation");

  const attack = simulation.submitCommand({
    id: "command-red-attack",
    submittedTick: 1,
    actorFactionId: redFactionId,
    command: {
      type: "attack_target",
      entityIds: redUnitIds.slice(0, 5),
      targetEntityId: blueUnitIds[0]!,
    },
  });
  assert.equal(attack.accepted, true);

  return scenario;
}

void test("100-unit simulation is deterministic and independent of rendering", () => {
  const first = configureScenario(1234);
  const second = configureScenario(1234);

  first.simulation.step(320);
  second.simulation.step(320);

  assert.equal(first.simulation.canonicalSnapshot(), second.simulation.canonicalSnapshot());

  const redFaction = first.simulation.world.get(first.redFactionId)?.factionState;
  const blueFaction = first.simulation.world.get(first.blueFactionId)?.factionState;
  assert.ok(redFaction);
  assert.ok(blueFaction);
  assert.ok((redFaction.resources.supplies ?? 0) > 250);
  assert.ok((blueFaction.resources.supplies ?? 0) > 250);

  const events = first.simulation.events.all();
  assert.ok(events.some(event => event.type === "command.rejected"));
  assert.ok(events.some(event => event.type === "combat.damage"));
  assert.ok(events.some(event => event.type === "territory.captured"));
  assert.ok(events.some(event => event.type === "economy.resource_extracted"));
  assert.equal(first.simulation.subsystemStatus.find(item => item.id === "path-intent")?.enabled, false);
  assert.equal(first.simulation.subsystemStatus.find(item => item.id === "tactical-intent")?.enabled, false);
});

void test("save and load preserve deterministic continuation", () => {
  const original = configureScenario(9876).simulation;
  original.step(120);
  const saved = original.exportSnapshot();

  const restored = new StrategySimulation({ seed: 1, tickRate: 20 });
  restored.importSnapshot(saved);

  original.step(180);
  restored.step(180);

  assert.equal(original.canonicalSnapshot(), restored.canonicalSnapshot());
});

void test("local strategy fallback continues without an LLM provider", () => {
  const scenario = createHeadlessScenario({ seed: 777, unitsPerFaction: 50, enableLocalAI: true });
  scenario.simulation.step(45);

  const decisions = scenario.simulation.events.all().filter(event => event.type === "ai.local_decision");
  assert.ok(decisions.length >= 2);
  assert.ok(scenario.simulation.submittedCommands.some(command => command.id.startsWith("local-strategy-")));
});
