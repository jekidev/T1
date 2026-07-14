import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBoard, type BoardState, type SimulationState } from "../game/types";
import {
  advanceBoardStrategy,
  getBoardBlackmailTargets,
  runBoardBlackmailAction,
} from "./boardStrategyBridge";

function createBoard(): BoardState {
  const simulation: SimulationState = {
    seed: 1,
    turn: 0,
    day: 1,
    hour: 8,
    publicConfidence: 65,
    mediaPressure: 10,
    blueTeamCoordination: 15,
    evidenceQuality: 10,
    cityTension: 20,
    economyIndex: 100,
    factions: [
      {
        id: "faction-player",
        name: "Player Faction",
        faction: "criminal",
        treasury: 1_000,
        personnel: 10,
        cohesion: 0,
        legitimacy: 100,
        intelligence: 100,
        suspicion: 0,
        territories: [],
        relationships: {},
        objectives: [],
      },
      {
        id: "faction-target",
        name: "Target Faction",
        faction: "police",
        treasury: 1_000,
        personnel: 10,
        cohesion: 0,
        legitimacy: 70,
        intelligence: 0,
        suspicion: 0,
        territories: [],
        relationships: {},
        objectives: [],
      },
    ],
    shops: [],
    skills: [],
  };

  return {
    ...createEmptyBoard("custom"),
    simulation,
  };
}

void test("board bridge gathers evidence and persists strategy snapshot", () => {
  const board = createBoard();
  const initialTargets = getBoardBlackmailTargets(board, "faction-player");
  assert.equal(initialTargets.length, 1);
  assert.equal(initialTargets[0]!.evidenceQuality, 0);

  const gathered = runBoardBlackmailAction(board, {
    type: "gather",
    actorFactionId: "faction-player",
    targetFactionId: "faction-target",
  });

  assert.equal(gathered.accepted, true);
  assert.ok(gathered.board.strategySnapshot);
  assert.equal(gathered.board.simulation?.turn, 0, "blackmail does not replace the existing turn engine");
  assert.ok(gathered.board.timelineEvents.some(event => event.label === "Leverage evidence updated"));

  const updatedTarget = getBoardBlackmailTargets(gathered.board, "faction-player")[0];
  assert.ok(updatedTarget!.evidenceQuality >= 20);
  assert.equal(updatedTarget!.canExecute, true);
});

void test("board bridge executes blackmail and advances cooldown with normal turns", () => {
  const gathered = runBoardBlackmailAction(createBoard(), {
    type: "gather",
    actorFactionId: "faction-player",
    targetFactionId: "faction-target",
  });
  const executed = runBoardBlackmailAction(gathered.board, {
    type: "execute",
    actorFactionId: "faction-player",
    targetFactionId: "faction-target",
    approach: "fear",
  });

  assert.equal(executed.accepted, true);
  const afterExecution = getBoardBlackmailTargets(executed.board, "faction-player")[0]!;
  assert.equal(afterExecution.evidenceQuality, 0);
  assert.equal(afterExecution.cooldownTicks, 200);
  assert.ok(executed.board.timelineEvents.some(event => event.label === "Blackmail succeeded"));

  const advanced = advanceBoardStrategy(executed.board, 20);
  const afterTurn = getBoardBlackmailTargets(advanced, "faction-player")[0]!;
  assert.equal(afterTurn.cooldownTicks, 180);
});
