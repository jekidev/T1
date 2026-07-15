import test from "node:test";
import assert from "node:assert/strict";
import {
  applySyndicateCommand,
  createSyndicateWorld,
  evaluateSyndicateStrategies,
} from "./SyndicateSystem";
import type { Territory } from "./types";

const territory: Territory = {
  id: "territory-north",
  name: "North District",
  bounds: { type: "Polygon", coordinates: [[[12.5, 55.6], [12.6, 55.6], [12.6, 55.7], [12.5, 55.7], [12.5, 55.6]]] },
  influenceByFaction: {},
  population: 50_000,
  prosperity: 55,
  stability: 60,
  visibility: "unknown",
  locationIds: [],
  resourceModifiers: { capital: 1, supplies: 1, workforce: 1, intelligence: 1, influence: 1 },
  loyaltyByFaction: {},
  eventPressure: 5,
  lastChangedAtTick: 0,
};

function createBase() {
  return applySyndicateCommand(createSyndicateWorld(42, [territory]), {
    type: "create_syndicate",
    commandId: "create-alpha",
    tick: 0,
    syndicateId: "alpha",
    name: "Alpha Network",
    leaderNpcId: "npc-leader",
  });
}

void test("creates a fictional faction and leader through a validated command", () => {
  const state = createBase();
  assert.equal(state.syndicates.length, 1);
  assert.equal(state.memberships.length, 1);
  assert.equal(state.memberships[0]?.roleId, "role-leader");
  assert.match(state.events[0]?.summary ?? "", /fictional gameplay faction/i);
});

void test("duplicate command ids are idempotent", () => {
  const state = createBase();
  const command = {
    type: "recruit_member" as const,
    commandId: "recruit-1",
    tick: 1,
    syndicateId: "alpha",
    npcId: "npc-2",
    roleId: "role-associate",
    salary: 30,
    loyalty: 50,
    ambition: 50,
    fear: 20,
    trust: 50,
    satisfaction: 50,
    ideologicalAlignment: 50,
    heart: 50,
    competence: 50,
  };
  const once = applySyndicateCommand(state, command);
  const twice = applySyndicateCommand(once, command);
  assert.deepEqual(twice, once);
});

void test("territory control uses influence thresholds instead of a direct owner write", () => {
  let state = createBase();
  state = applySyndicateCommand(state, {
    type: "influence_territory",
    commandId: "influence-1",
    tick: 1,
    syndicateId: "alpha",
    territoryId: "territory-north",
    approach: "commerce",
    resourceSpend: { capital: 90_000, supplies: 40, workforce: 8, intelligence: 8, influence: 8 },
  });
  assert.ok((state.territories[0]?.influenceByFaction.alpha ?? 0) > 0);
  assert.notEqual(state.territories[0]?.visibility, "unknown");
  assert.ok(state.syndicates[0]!.resources.capital < 100_000);
});

void test("businesses consume upkeep and produce generic resources deterministically", () => {
  let state = createBase();
  state.territories[0]!.influenceByFaction.alpha = 30;
  state = applySyndicateCommand(state, {
    type: "establish_business",
    commandId: "business-1",
    tick: 1,
    syndicateId: "alpha",
    businessId: "business-tech",
    territoryId: "territory-north",
    category: "technology",
    name: "Fictional Technology Cooperative",
    managerNpcId: "npc-leader",
  });
  const before = state.syndicates[0]!.resources.intelligence;
  const advanced = applySyndicateCommand(state, {
    type: "advance_tick",
    commandId: "advance-1",
    tick: 1,
    ticks: 4,
  });
  assert.ok(advanced.syndicates[0]!.resources.intelligence > before);
  assert.equal(advanced.tick, 5);
});

void test("strategy utility is deterministic and covers all eight strategies", () => {
  const first = evaluateSyndicateStrategies(createBase(), "alpha");
  const second = evaluateSyndicateStrategies(createBase(), "alpha");
  assert.deepEqual(second, first);
  assert.equal(first.length, 8);
  assert.ok(first[0]!.utility >= first[1]!.utility);
});

void test("role assignment enforces loyalty heart and competence requirements", () => {
  let state = createBase();
  state = applySyndicateCommand(state, {
    type: "recruit_member",
    commandId: "recruit-low",
    tick: 1,
    syndicateId: "alpha",
    npcId: "npc-low",
    roleId: "role-associate",
    salary: 30,
    loyalty: 20,
    ambition: 90,
    fear: 20,
    trust: 30,
    satisfaction: 40,
    ideologicalAlignment: 40,
    heart: 20,
    competence: 20,
  });
  assert.throws(() => applySyndicateCommand(state, {
    type: "assign_role",
    commandId: "promote-low",
    tick: 2,
    syndicateId: "alpha",
    npcId: "npc-low",
    roleId: "role-captain",
    reason: "Test promotion",
  }), /does not meet/);
});
