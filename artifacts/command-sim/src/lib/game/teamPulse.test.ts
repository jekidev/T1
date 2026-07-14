import test from "node:test";
import assert from "node:assert/strict";
import { applyPlayerTurnToTeamDynamics, createInitialTeamDynamics, moralSpectrumLabel } from "./teamPulse";
import type { SimulationState } from "./types";

function createSimulation(): SimulationState {
  const base: SimulationState = {
    seed: 42,
    turn: 0,
    day: 1,
    hour: 8,
    publicConfidence: 65,
    mediaPressure: 10,
    blueTeamCoordination: 35,
    evidenceQuality: 30,
    cityTension: 25,
    economyIndex: 100,
    factions: [
      { id: "red-1", name: "Red", faction: "criminal", treasury: 100000, personnel: 20, cohesion: 60, legitimacy: 35, intelligence: 55, suspicion: 15, territories: [], relationships: {}, objectives: [] },
      { id: "blue-1", name: "Blue", faction: "police", treasury: 250000, personnel: 20, cohesion: 65, legitimacy: 70, intelligence: 60, suspicion: 0, territories: [], relationships: {}, objectives: [] },
    ],
    shops: [],
    skills: [],
  };
  return { ...base, teamDynamics: createInitialTeamDynamics(base, { side: "red", initialSpectrum: 40 }) };
}

void test("Red and Blue success estimates are complementary", () => {
  const simulation = createSimulation();
  const dynamics = simulation.teamDynamics!;
  assert.equal(Math.round((dynamics.red.estimatedSuccess + dynamics.blue.estimatedSuccess) * 10) / 10, 100);
  assert.ok(dynamics.red.factors.length > 0);
  assert.ok(dynamics.blue.confidence >= 0 && dynamics.blue.confidence <= 100);
});

void test("risk-reducing actions move player spectrum and karma positively", () => {
  const before = createSimulation();
  const after = { ...before, turn: 1, cityTension: 20, publicConfidence: 67 };
  const next = applyPlayerTurnToTeamDynamics(before, after, { type: "reduce_pressure", factionId: "red-1", amount: 10 });
  assert.ok(next.userProfile.currentSpectrum > before.teamDynamics!.userProfile.currentSpectrum);
  assert.ok(next.userProfile.karma > before.teamDynamics!.userProfile.karma);
  assert.ok(next.userProfile.riskIndex < before.teamDynamics!.userProfile.riskIndex);
});

void test("aggressive influence increases risk and can lower spectrum", () => {
  const before = createSimulation();
  const after = { ...before, turn: 1, cityTension: 35, publicConfidence: 30 };
  const next = applyPlayerTurnToTeamDynamics(before, after, { type: "expand_influence", factionId: "red-1", amount: 10 });
  assert.ok(next.userProfile.currentSpectrum < before.teamDynamics!.userProfile.currentSpectrum);
  assert.ok(next.userProfile.riskIndex > before.teamDynamics!.userProfile.riskIndex);
});

void test("spectrum labels cover the full 0 to 100 scale", () => {
  assert.equal(moralSpectrumLabel(0), "Extremely destructive");
  assert.equal(moralSpectrumLabel(50), "Morally mixed");
  assert.equal(moralSpectrumLabel(100), "Altruistic ideal");
});
