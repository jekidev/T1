import { nanoid } from "nanoid";
import type {
  FactionState,
  PlayerAlignmentProfile,
  PlayerAlignmentSetup,
  PlayerTurnAction,
  SimulationState,
  TeamDynamicsState,
  TeamPulse,
  TeamPulseFactor,
  TeamSide,
} from "./types";

const ACTION_EFFECTS: Record<PlayerTurnAction["type"], { alignment: number; karma: number; risk: number; morale: number }> = {
  invest: { alignment: 1, karma: 1, risk: -1, morale: 3 },
  gather_intelligence: { alignment: 0, karma: 0, risk: 3, morale: 1 },
  reduce_pressure: { alignment: 3, karma: 2, risk: -5, morale: 2 },
  expand_influence: { alignment: -2, karma: -1, risk: 5, morale: 2 },
  train: { alignment: 0, karma: 0, risk: -1, morale: 3 },
  wait: { alignment: 0, karma: 0, risk: 0, morale: -1 },
};

export function createInitialTeamDynamics(
  simulation: Pick<SimulationState, "factions" | "publicConfidence" | "mediaPressure" | "blueTeamCoordination" | "evidenceQuality" | "cityTension" | "economyIndex">,
  setup: PlayerAlignmentSetup,
): TeamDynamicsState {
  const initialSpectrum = clamp(setup.initialSpectrum);
  const userProfile: PlayerAlignmentProfile = {
    side: setup.side,
    initialSpectrum,
    currentSpectrum: initialSpectrum,
    karma: 0,
    riskIndex: 25,
    lastChange: 0,
    history: [],
  };
  return recalculateTeamDynamics(simulation, {
    userProfile,
    red: emptyPulse("red"),
    blue: emptyPulse("blue"),
    updatedAtTurn: 0,
  });
}

export function ensureTeamDynamics(simulation: SimulationState): TeamDynamicsState {
  if (simulation.teamDynamics) return simulation.teamDynamics;
  return createInitialTeamDynamics(simulation, { side: "observer", initialSpectrum: 50 });
}

export function applyPlayerTurnToTeamDynamics(
  before: SimulationState,
  after: SimulationState,
  action: PlayerTurnAction | undefined,
): TeamDynamicsState {
  const current = structuredClone(ensureTeamDynamics(before));
  if (action) {
    const effect = ACTION_EFFECTS[action.type];
    const side = resolveActionSide(after.factions, action, current.userProfile.side);
    const contextualAlignment = effect.alignment + alignmentContextAdjustment(action.type, side, after);
    const riskDelta = effect.risk + Math.max(0, after.cityTension - before.cityTension) * 0.15;
    const karmaDelta = effect.karma + karmaContextAdjustment(action.type, side, after);
    const profileInfluence = current.userProfile.side === side ? 1 : current.userProfile.side === "observer" ? 0.35 : 0.15;

    current.userProfile.currentSpectrum = clamp(current.userProfile.currentSpectrum + contextualAlignment * profileInfluence);
    current.userProfile.karma = clampRange(current.userProfile.karma + karmaDelta * profileInfluence, -100, 100);
    current.userProfile.riskIndex = clamp(current.userProfile.riskIndex + riskDelta * profileInfluence);
    current.userProfile.lastChange = round1(contextualAlignment * profileInfluence);
    current.userProfile.history.push({
      id: nanoid(10),
      turn: after.turn,
      source: "player_action",
      actionType: action.type,
      side,
      spectrumDelta: round1(contextualAlignment * profileInfluence),
      karmaDelta: round1(karmaDelta * profileInfluence),
      riskDelta: round1(riskDelta * profileInfluence),
      reason: describeActionEffect(action.type, side, contextualAlignment, karmaDelta, riskDelta),
    });
    current.userProfile.history = current.userProfile.history.slice(-100);

    const pulse = side === "red" ? current.red : current.blue;
    pulse.collectiveMorale = clamp(pulse.collectiveMorale + effect.morale);
    pulse.moralSpectrum = clamp(pulse.moralSpectrum + contextualAlignment * 0.45);
  } else {
    current.userProfile.lastChange = 0;
  }

  return recalculateTeamDynamics(after, current);
}

export function applyTeamDynamicsEvent(
  simulation: SimulationState,
  input: {
    side: TeamSide;
    source: "blackmail" | "mission" | "karma_event" | "risk_event";
    spectrumDelta: number;
    karmaDelta: number;
    riskDelta: number;
    moraleDelta: number;
    reason: string;
  },
): TeamDynamicsState {
  const state = structuredClone(ensureTeamDynamics(simulation));
  const pulse = input.side === "red" ? state.red : state.blue;
  pulse.moralSpectrum = clamp(pulse.moralSpectrum + input.spectrumDelta);
  pulse.collectiveMorale = clamp(pulse.collectiveMorale + input.moraleDelta);

  const influence = state.userProfile.side === input.side ? 1 : state.userProfile.side === "observer" ? 0.25 : 0.1;
  state.userProfile.currentSpectrum = clamp(state.userProfile.currentSpectrum + input.spectrumDelta * influence);
  state.userProfile.karma = clampRange(state.userProfile.karma + input.karmaDelta * influence, -100, 100);
  state.userProfile.riskIndex = clamp(state.userProfile.riskIndex + input.riskDelta * influence);
  state.userProfile.lastChange = round1(input.spectrumDelta * influence);
  state.userProfile.history.push({
    id: nanoid(10),
    turn: simulation.turn,
    source: input.source,
    side: input.side,
    spectrumDelta: round1(input.spectrumDelta * influence),
    karmaDelta: round1(input.karmaDelta * influence),
    riskDelta: round1(input.riskDelta * influence),
    reason: input.reason,
  });
  state.userProfile.history = state.userProfile.history.slice(-100);
  return recalculateTeamDynamics(simulation, state);
}

export function recalculateTeamDynamics(
  simulation: Pick<SimulationState, "turn" | "factions" | "publicConfidence" | "mediaPressure" | "blueTeamCoordination" | "evidenceQuality" | "cityTension" | "economyIndex">,
  input: TeamDynamicsState,
): TeamDynamicsState {
  const redFactions = simulation.factions.filter(faction => faction.faction === "criminal");
  const blueFactions = simulation.factions.filter(faction => faction.faction === "police");
  const redMorale = calculateCollectiveMorale(redFactions, input.red.collectiveMorale, simulation.cityTension, simulation.mediaPressure);
  const blueMorale = calculateCollectiveMorale(blueFactions, input.blue.collectiveMorale, 100 - simulation.publicConfidence, simulation.mediaPressure);
  const redSpectrum = calculateTeamSpectrum("red", redFactions, input.red.moralSpectrum, input.userProfile);
  const blueSpectrum = calculateTeamSpectrum("blue", blueFactions, input.blue.moralSpectrum, input.userProfile);

  const redFactors = buildRedFactors(simulation, redFactions, redMorale, redSpectrum);
  const blueFactors = buildBlueFactors(simulation, blueFactions, blueMorale, blueSpectrum);
  const redRaw = factorScore(redFactors);
  const blueRaw = factorScore(blueFactors);
  const total = Math.max(1, redRaw + blueRaw);
  const redSuccess = clampRange((redRaw / total) * 100, 5, 95);
  const blueSuccess = 100 - redSuccess;
  const confidence = calculateConfidence(simulation, redFactions, blueFactions);

  return {
    userProfile: {
      ...input.userProfile,
      currentSpectrum: clamp(input.userProfile.currentSpectrum),
      karma: clampRange(input.userProfile.karma, -100, 100),
      riskIndex: clamp(input.userProfile.riskIndex),
    },
    red: {
      side: "red",
      moralSpectrum: round1(redSpectrum),
      collectiveMorale: round1(redMorale),
      estimatedSuccess: round1(redSuccess),
      confidence: round1(confidence),
      riskPressure: round1(calculateRedRisk(simulation, redFactions)),
      alignmentCoherence: round1(alignmentCoherence(redSpectrum, input.userProfile, "red")),
      factors: redFactors,
      lastUpdatedTurn: simulation.turn,
    },
    blue: {
      side: "blue",
      moralSpectrum: round1(blueSpectrum),
      collectiveMorale: round1(blueMorale),
      estimatedSuccess: round1(blueSuccess),
      confidence: round1(confidence),
      riskPressure: round1(calculateBlueRisk(simulation, blueFactions)),
      alignmentCoherence: round1(alignmentCoherence(blueSpectrum, input.userProfile, "blue")),
      factors: blueFactors,
      lastUpdatedTurn: simulation.turn,
    },
    updatedAtTurn: simulation.turn,
  };
}

export function moralSpectrumLabel(value: number): string {
  if (value <= 15) return "Extremely destructive";
  if (value <= 35) return "Dark / self-serving";
  if (value <= 55) return "Morally mixed";
  if (value <= 75) return "Principled";
  if (value <= 90) return "Strongly prosocial";
  return "Altruistic ideal";
}

function emptyPulse(side: TeamSide): TeamPulse {
  return {
    side,
    moralSpectrum: 50,
    collectiveMorale: 50,
    estimatedSuccess: 50,
    confidence: 25,
    riskPressure: 25,
    alignmentCoherence: 50,
    factors: [],
    lastUpdatedTurn: 0,
  };
}

function calculateCollectiveMorale(
  factions: readonly FactionState[],
  previous: number,
  externalPressure: number,
  mediaPressure: number,
): number {
  if (factions.length === 0) return clamp(previous * 0.85);
  const cohesion = average(factions.map(faction => faction.cohesion));
  const legitimacy = average(factions.map(faction => faction.legitimacy));
  const resources = average(factions.map(faction => normalizeTreasury(faction.treasury)));
  const suspicionPenalty = average(factions.map(faction => faction.suspicion)) * 0.18;
  const pressurePenalty = externalPressure * 0.08 + mediaPressure * 0.05;
  return clamp(previous * 0.2 + cohesion * 0.42 + legitimacy * 0.18 + resources * 0.2 - suspicionPenalty - pressurePenalty);
}

function calculateTeamSpectrum(
  side: TeamSide,
  factions: readonly FactionState[],
  previous: number,
  user: PlayerAlignmentProfile,
): number {
  const legitimacy = factions.length > 0 ? average(factions.map(faction => faction.legitimacy)) : 50;
  const suspicion = factions.length > 0 ? average(factions.map(faction => faction.suspicion)) : 0;
  const institutionalBase = side === "blue" ? 55 : 45;
  const userWeight = user.side === side ? 0.18 : user.side === "observer" ? 0.05 : 0.02;
  const userSignal = clamp(user.currentSpectrum + user.karma * 0.15 - user.riskIndex * 0.05);
  return clamp(previous * 0.48 + institutionalBase * 0.17 + legitimacy * 0.25 - suspicion * 0.1 + userSignal * userWeight);
}

function buildRedFactors(
  simulation: Pick<SimulationState, "cityTension" | "evidenceQuality" | "economyIndex">,
  factions: readonly FactionState[],
  morale: number,
  spectrum: number,
): TeamPulseFactor[] {
  return [
    factor("Collective morale", morale, 0.24, "Cohesion, legitimacy, pressure and resources."),
    factor("Operational intelligence", averageOr(factions.map(faction => faction.intelligence), 25), 0.18, "Aggregated Red Team intelligence."),
    factor("Organizational cohesion", averageOr(factions.map(faction => faction.cohesion), 25), 0.18, "Ability to coordinate and absorb setbacks."),
    factor("Economic capacity", clamp(simulation.economyIndex), 0.1, "World economy and available operating capacity."),
    factor("City opportunity", clamp(simulation.cityTension), 0.12, "Instability can create opportunities but also exposure."),
    factor("Moral coherence", coherenceScore(spectrum), 0.08, "Consistency between claimed principles and current conduct."),
    factor("Evidence pressure", 100 - clamp(simulation.evidenceQuality), 0.1, "Lower opposing evidence improves Red Team prospects."),
  ];
}

function buildBlueFactors(
  simulation: Pick<SimulationState, "publicConfidence" | "mediaPressure" | "blueTeamCoordination" | "evidenceQuality" | "cityTension">,
  factions: readonly FactionState[],
  morale: number,
  spectrum: number,
): TeamPulseFactor[] {
  return [
    factor("Collective morale", morale, 0.22, "Cohesion, legitimacy, public pressure and resources."),
    factor("Coordination", simulation.blueTeamCoordination, 0.18, "Shared operational coordination across Blue Team."),
    factor("Evidence quality", simulation.evidenceQuality, 0.2, "Reliability and completeness of the current case picture."),
    factor("Public confidence", simulation.publicConfidence, 0.12, "Legitimacy and cooperation from the public."),
    factor("Operational intelligence", averageOr(factions.map(faction => faction.intelligence), 25), 0.13, "Aggregated Blue Team intelligence."),
    factor("Moral coherence", coherenceScore(spectrum), 0.08, "Consistency between authority, principles and conduct."),
    factor("Pressure control", 100 - clamp(simulation.cityTension * 0.65 + simulation.mediaPressure * 0.35), 0.07, "Ability to operate under city and media pressure."),
  ];
}

function calculateConfidence(
  simulation: Pick<SimulationState, "evidenceQuality" | "blueTeamCoordination" | "turn">,
  redFactions: readonly FactionState[],
  blueFactions: readonly FactionState[],
): number {
  const intelligenceCoverage = averageOr([...redFactions, ...blueFactions].map(faction => faction.intelligence), 20);
  const turnMaturity = Math.min(100, simulation.turn * 4);
  return clamp(simulation.evidenceQuality * 0.38 + simulation.blueTeamCoordination * 0.22 + intelligenceCoverage * 0.25 + turnMaturity * 0.15);
}

function calculateRedRisk(
  simulation: Pick<SimulationState, "evidenceQuality" | "mediaPressure" | "cityTension">,
  factions: readonly FactionState[],
): number {
  return clamp(averageOr(factions.map(faction => faction.suspicion), 20) * 0.45 + simulation.evidenceQuality * 0.3 + simulation.mediaPressure * 0.15 + simulation.cityTension * 0.1);
}

function calculateBlueRisk(
  simulation: Pick<SimulationState, "publicConfidence" | "mediaPressure" | "cityTension">,
  factions: readonly FactionState[],
): number {
  const legitimacy = averageOr(factions.map(faction => faction.legitimacy), 50);
  return clamp((100 - legitimacy) * 0.35 + (100 - simulation.publicConfidence) * 0.25 + simulation.mediaPressure * 0.2 + simulation.cityTension * 0.2);
}

function alignmentCoherence(teamSpectrum: number, user: PlayerAlignmentProfile, side: TeamSide): number {
  if (user.side === "observer") return coherenceScore(teamSpectrum);
  if (user.side !== side) return coherenceScore(teamSpectrum) * 0.85;
  return clamp(100 - Math.abs(teamSpectrum - user.currentSpectrum));
}

function coherenceScore(spectrum: number): number {
  return clamp(65 + Math.abs(spectrum - 50) * 0.35);
}

function resolveActionSide(
  factions: readonly FactionState[],
  action: PlayerTurnAction,
  fallback: PlayerAlignmentProfile["side"],
): TeamSide {
  const faction = action.factionId ? factions.find(item => item.id === action.factionId) : undefined;
  if (faction?.faction === "police") return "blue";
  if (faction?.faction === "criminal") return "red";
  return fallback === "blue" ? "blue" : "red";
}

function alignmentContextAdjustment(
  action: PlayerTurnAction["type"],
  side: TeamSide,
  simulation: Pick<SimulationState, "evidenceQuality" | "publicConfidence" | "cityTension">,
): number {
  if (action === "gather_intelligence") return side === "blue" && simulation.evidenceQuality < 50 ? 1 : 0;
  if (action === "reduce_pressure") return simulation.cityTension > 50 ? 1 : 0;
  if (action === "expand_influence") return simulation.publicConfidence < 35 ? -1 : 0;
  return 0;
}

function karmaContextAdjustment(
  action: PlayerTurnAction["type"],
  side: TeamSide,
  simulation: Pick<SimulationState, "publicConfidence" | "cityTension">,
): number {
  if (action === "reduce_pressure" && simulation.cityTension > 60) return 1;
  if (action === "expand_influence" && simulation.publicConfidence < 40) return -1;
  if (action === "gather_intelligence" && side === "blue") return 0.5;
  return 0;
}

function describeActionEffect(
  action: PlayerTurnAction["type"],
  side: TeamSide,
  alignment: number,
  karma: number,
  risk: number,
): string {
  return `${side.toUpperCase()} ${action}: spectrum ${signed(alignment)}, karma ${signed(karma)}, risk ${signed(risk)}.`;
}

function factor(label: string, value: number, weight: number, detail: string): TeamPulseFactor {
  const normalized = clamp(value);
  return { label, value: round1(normalized), weight, contribution: round1(normalized * weight), detail };
}

function factorScore(factors: readonly TeamPulseFactor[]): number {
  return Math.max(1, factors.reduce((sum, item) => sum + item.contribution, 0));
}

function normalizeTreasury(treasury: number): number {
  return clamp(Math.log10(Math.max(1, treasury)) * 18 - 20);
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function averageOr(values: readonly number[], fallback: number): number {
  return values.length > 0 ? average(values) : fallback;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${round1(value)}`;
}

function clamp(value: number): number {
  return clampRange(value, 0, 100);
}

function clampRange(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
