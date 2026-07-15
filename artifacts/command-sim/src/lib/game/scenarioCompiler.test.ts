import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBoard } from "./types";
import { compileGeneratedScenario } from "./scenarioCompiler";
import type { GeneratedGamePayload } from "./generatedGameSchema";
import type { WorldConfig } from "../world-config";

const payload: GeneratedGamePayload = {
  storyline: "A fictional high-realism campaign.",
  openingMission: "Establish the first command node.",
  tutorialSummary: "Learn the board from the real map upward.",
  factions: [
    { name: "Player Network", faction: "criminal", role: "Player faction", goal: "Build from zero." },
    { name: "Rival Network", faction: "criminal", role: "AI rival", goal: "Expand." },
    { name: "Blue Team", faction: "police", role: "Institution", goal: "Maintain public safety." },
  ],
  assets: [],
  shops: [],
  skills: [],
  sourceCases: [],
};

const world: WorldConfig = {
  country: "Danmark",
  region: "Hovedstaden",
  municipality: "København",
  city: "København",
  workAreaLabel: "København og omegn",
  workAreaRadiusKm: 25,
  supplierCountry: "Danmark",
  language: "da-DK",
  currency: "DKK",
  timezone: "Europe/Copenhagen",
  latitude: 55.6761,
  longitude: 12.5683,
  mapProvider: "openstreetmap",
};

void test("New Game starts the authenticated player as a solo boss with zero capital", () => {
  const board = compileGeneratedScenario({
    board: createEmptyBoard("custom"),
    payload,
    world,
    premise: "Test start guarantees",
    generatedBy: "test",
    playerAlignment: { side: "red", initialSpectrum: 45 },
  });

  assert.equal(board.playerWorkspace?.role, "boss");
  assert.equal(board.playerWorkspace?.startedAlone, true);
  assert.equal(board.playerWorkspace?.startingCapital, 0);
  assert.ok(board.playerWorkspace?.bossEntityId);

  const playerFaction = board.simulation?.factions.find(faction => faction.faction === "criminal");
  assert.equal(playerFaction?.treasury, 0);
  assert.equal(playerFaction?.personnel, 1);

  const playerSyndicate = board.simulation?.syndicateWorld?.syndicates[0];
  assert.equal(playerSyndicate?.resources.capital, 0);
  assert.equal(playerSyndicate?.resources.workforce, 1);
  assert.equal(playerSyndicate?.resources.supplies, 0);
  assert.equal(playerSyndicate?.resources.intelligence, 0);
  assert.equal(playerSyndicate?.resources.influence, 0);

  assert.equal(board.simulation?.teamDynamics?.userProfile.initialSpectrum, 45);
  assert.equal(board.simulation?.teamDynamics?.userProfile.currentSpectrum, 45);
});
