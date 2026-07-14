import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMoralAlignmentEvent,
  createMoralAlignmentProfile,
  estimateRealtimeTeamAssessment,
  moralAlignmentLabel,
} from "./TeamAssessment";

void test("Blue and Red success probabilities sum to 100", () => {
  const result = estimateRealtimeTeamAssessment({
    blue: {
      side: "blue",
      cohesion: 70,
      legitimacy: 75,
      intelligence: 80,
      suspicion: 10,
      resources: 250_000,
      personnel: 40,
      territoryControl: 55,
      unitMorale: 72,
      moralAlignment: 65,
      karma: 30,
      riskExposure: 20,
      recentMomentum: 60,
    },
    red: {
      side: "red",
      cohesion: 65,
      legitimacy: 45,
      intelligence: 62,
      suspicion: 35,
      resources: 120_000,
      personnel: 28,
      territoryControl: 45,
      unitMorale: 64,
      moralAlignment: 40,
      karma: -10,
      riskExposure: 42,
      recentMomentum: 48,
    },
    context: {
      publicConfidence: 68,
      mediaPressure: 25,
      evidenceQuality: 58,
      cityTension: 46,
      blueTeamCoordination: 62,
      economyIndex: 100,
      turn: 12,
    },
  });

  assert.equal(result.blue.estimatedSuccessPercent + result.red.estimatedSuccessPercent, 100);
  assert.equal(result.leadingSide, "blue");
  assert.ok(result.blue.collectiveMorale > result.red.collectiveMorale);
  assert.ok(result.blue.factors.length > 5);
});

void test("equal team metrics produce near parity", () => {
  const shared = {
    cohesion: 60,
    legitimacy: 60,
    intelligence: 60,
    suspicion: 25,
    resources: 150_000,
    personnel: 30,
    territoryControl: 50,
    unitMorale: 60,
    moralAlignment: 50,
    karma: 0,
    riskExposure: 25,
    recentMomentum: 50,
  };
  const result = estimateRealtimeTeamAssessment({
    blue: { side: "blue", ...shared },
    red: { side: "red", ...shared },
    context: {
      publicConfidence: 50,
      mediaPressure: 50,
      evidenceQuality: 50,
      cityTension: 50,
      blueTeamCoordination: 50,
      economyIndex: 100,
      turn: 1,
    },
  });
  assert.ok(result.blue.estimatedSuccessPercent >= 40 && result.blue.estimatedSuccessPercent <= 60);
  assert.equal(result.blue.estimatedSuccessPercent + result.red.estimatedSuccessPercent, 100);
});

void test("alignment starts at user selected value and moves gradually", () => {
  const profile = createMoralAlignmentProfile({ initialAlignment: 42, side: "red", factionId: "player-red" });
  const updated = applyMoralAlignmentEvent(profile, {
    id: "action-1",
    tick: 1,
    actionType: "protect_civilians",
    prosocialImpact: 80,
    integrityImpact: 60,
    civilianImpact: -40,
    proportionality: 70,
    riskDelta: 15,
    karmaDelta: 25,
    explanation: "Player accepted personal risk to protect civilians.",
  });
  assert.equal(profile.currentAlignment, 42);
  assert.ok(updated.currentAlignment > 42);
  assert.ok(updated.currentAlignment <= 50);
  assert.equal(updated.history.length, 1);
  assert.equal(updated.karma, 25);
});

void test("duplicate alignment events are idempotent", () => {
  const event = {
    id: "same-event",
    tick: 2,
    actionType: "betrayal",
    prosocialImpact: -50,
    integrityImpact: -80,
    civilianImpact: 30,
    proportionality: -50,
    riskDelta: 10,
    karmaDelta: -20,
    explanation: "Broke an explicit promise.",
  };
  const first = applyMoralAlignmentEvent(createMoralAlignmentProfile({ initialAlignment: 50, side: "red" }), event);
  const second = applyMoralAlignmentEvent(first, event);
  assert.deepEqual(second, first);
});

void test("moral labels cover both sides without assigning one team as good", () => {
  assert.match(moralAlignmentLabel(5), /destruktiv/i);
  assert.match(moralAlignmentLabel(50), /blandet/i);
  assert.match(moralAlignmentLabel(95), /altruistisk/i);
});
