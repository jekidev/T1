import { nanoid } from "nanoid";
import type { BoardState, FactionState, PlayerTurnAction, SimulationState, TimelineEvent } from "./types";
import { applyPlayerTurnToTeamDynamics, ensureTeamDynamics } from "./teamPulse";

export interface TurnResolution {
  board: BoardState;
  summary: string;
  events: TimelineEvent[];
}

function nextRandom(seed: number): [number, number] {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0;
  return [next, next / 4294967296];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function updateFaction(faction: FactionState, action: PlayerTurnAction | undefined, random: number): FactionState {
  let treasury = faction.treasury;
  let cohesion = faction.cohesion;
  let intelligence = faction.intelligence;
  let legitimacy = faction.legitimacy;
  let suspicion = faction.suspicion;

  if (action?.factionId === faction.id) {
    const amount = Math.max(1, action.amount ?? 10);
    if (action.type === "invest") { treasury -= amount * 1000; cohesion += 3; }
    if (action.type === "gather_intelligence") { treasury -= amount * 500; intelligence += 5; suspicion += 2; }
    if (action.type === "reduce_pressure") { treasury -= amount * 750; suspicion -= 5; legitimacy += 2; }
    if (action.type === "expand_influence") { treasury -= amount * 900; legitimacy += faction.faction === "criminal" ? -1 : 2; suspicion += faction.faction === "criminal" ? 4 : 1; }
    if (action.type === "train") cohesion += 2;
  }

  const upkeep = faction.personnel * 120;
  treasury -= upkeep;
  cohesion += random > 0.7 ? 1 : random < 0.15 ? -2 : 0;
  intelligence += random > 0.8 ? 1 : 0;
  suspicion += faction.faction === "criminal" && random > 0.55 ? 1 : 0;

  return {
    ...faction,
    treasury: Math.max(0, Math.round(treasury)),
    cohesion: clamp(cohesion),
    intelligence: clamp(intelligence),
    legitimacy: clamp(legitimacy),
    suspicion: clamp(suspicion),
  };
}

export function simulateTurn(board: BoardState, action?: PlayerTurnAction): TurnResolution {
  const current = board.simulation;
  if (!current) return { board, summary: "Simulation state is not initialized.", events: [] };

  const currentWithDynamics: SimulationState = {
    ...current,
    teamDynamics: ensureTeamDynamics(current),
  };
  let seed = current.seed + current.turn + 1;
  const randomValues: number[] = [];
  for (let index = 0; index < Math.max(4, current.factions.length); index += 1) {
    const result = nextRandom(seed);
    seed = result[0];
    randomValues.push(result[1]);
  }

  const factions = current.factions.map((faction, index) => updateFaction(faction, action, randomValues[index % randomValues.length]!));
  const criminalSuspicion = factions.filter(item => item.faction === "criminal").reduce((sum, item) => sum + item.suspicion, 0);
  const policeIntelligence = factions.filter(item => item.faction === "police").reduce((sum, item) => sum + item.intelligence, 0);
  const tensionChange = criminalSuspicion / Math.max(1, factions.length * 35) + (randomValues[0]! - 0.5) * 4;
  const evidenceChange = policeIntelligence / Math.max(1, factions.length * 80) + (randomValues[1]! > 0.8 ? 2 : 0);
  const mediaChange = current.cityTension > 55 ? 3 : randomValues[2]! > 0.85 ? 2 : -1;
  const publicChange = -Math.max(0, tensionChange) * 0.5 + (randomValues[3]! > 0.75 ? 1 : 0);

  const nextBase: SimulationState = {
    ...currentWithDynamics,
    seed,
    turn: current.turn + 1,
    day: current.day + (current.hour >= 20 ? 1 : 0),
    hour: current.hour >= 20 ? 8 : current.hour + 4,
    factions,
    publicConfidence: clamp(current.publicConfidence + publicChange),
    mediaPressure: clamp(current.mediaPressure + mediaChange),
    blueTeamCoordination: clamp(current.blueTeamCoordination + (evidenceChange > 1 ? 1 : 0)),
    evidenceQuality: clamp(current.evidenceQuality + evidenceChange),
    cityTension: clamp(current.cityTension + tensionChange),
    economyIndex: clamp(current.economyIndex + (randomValues[0]! - 0.5) * 2, 60, 140),
  };
  const next: SimulationState = {
    ...nextBase,
    teamDynamics: applyPlayerTurnToTeamDynamics(currentWithDynamics, nextBase, action),
  };

  const red = next.teamDynamics.red;
  const blue = next.teamDynamics.blue;
  const summary = `Turn ${next.turn}: Red ${red.estimatedSuccess.toFixed(1)}% / Blue ${blue.estimatedSuccess.toFixed(1)}% estimated success; morale ${red.collectiveMorale.toFixed(1)} / ${blue.collectiveMorale.toFixed(1)}; confidence ${red.confidence.toFixed(1)}%.`;
  next.lastResolution = summary;
  const event: TimelineEvent = {
    id: nanoid(10),
    phaseId: board.currentPhaseId,
    label: `Turn ${next.turn} resolved`,
    description: `${summary} City tension ${next.cityTension}, evidence ${next.evidenceQuality}, public confidence ${next.publicConfidence}.`,
    severity: next.cityTension >= 70 ? "critical" : next.cityTension >= 45 ? "caution" : "info",
    createdAt: new Date().toISOString(),
    sourceStatus: "balance",
  };

  return {
    board: {
      ...board,
      simulation: next,
      timelineEvents: [...board.timelineEvents, event],
      moveHistory: [...board.moveHistory, { id: nanoid(10), summary: action ? `Player action: ${action.type}` : "No player action", actorFaction: null, createdAt: new Date().toISOString() }],
    },
    summary,
    events: [event],
  };
}
