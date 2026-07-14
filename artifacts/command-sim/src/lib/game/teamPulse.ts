import {
  estimateRealtimeTeamAssessment,
  moralAlignmentLabel,
  type TeamMetricsInput,
  type TeamSide as AssessmentSide,
} from "@workspace/strategy-sim";
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

const ACTION_EFFECTS: Record<PlayerTurnAction["type"], {
  alignment: number;
  karma: number;
  risk: number;
  morale: number;
}> = {
  invest: { alignment: 1, karma: 1, risk: -1, morale: 3 },
  gather_intelligence: { alignment: 0, karma: 0, risk: 3, morale: 1 },
  reduce_pressure: { alignment: 3, karma: 2, risk: -5, morale: 2 },
  expand_influence: { alignment: -2, karma: -1, risk: 5, morale: 2 },
  train: { alignment: 0, karma: 0, risk: -1, morale: 3 },
  wait: { alignment: 0, karma: 0, risk: 0, morale: -1 },
};

export function createInitialTeamDynamics(
  simulation: Pick<SimulationState, "turn" | "factions" | "publicConfidence" | "mediaPressure" | "blueTeamCoordination" | "evidenceQuality" | "cityTension" | "economyIndex">,
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
    updatedAtTurn: simulation.turn,
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
    const contextualAlignment = effect.alignment + alignmentContextAdjustment(action.type, side, before, after);
    const riskDelta = effect.risk + Math.max(0, after.cityTension - before.cityTension) * 0.15;
    const karmaDelta = effect.karma + karmaContextAdjustment(action.type, side, before, after);
    const profileInfluence = current.userProfile.side === side
      ? 1
      : current.userProfile.side === "observer"
        ? 0.35
        : 0.15;
    const spectrumDelta = contextualAlignment * profileInfluence;

    current.userProfile.currentSpectrum = clamp(current.userProfile.currentSpectrum + spectrumDelta);
    current.userProfile.karma = clampRange(current.userProfile.karma + karmaDelta * profileInfluence, -100, 100);
    current.userProfile.riskIndex = clamp(current.userProfile.riskIndex + riskDelta * profileInfluence);
    current.userProfile.lastChange = round1(spectrumDelta);
    current.userProfile.history.push({
      id: deterministicHistoryId(after.turn, "player_action", side, action.type, current.userProfile.history.length),
      turn: after.turn,
      source: "player_action",
      actionType: action.type,
      side,
      spectrumDelta: round1(spectrumDelta),
      karmaDelta: round1(karmaDelta * profileInfluence),
      riskDelta: round1(riskDelta * profileInfluence),
      reason: describeActionEffect(action.type, side, contextualAlignment, karmaDelta, riskDelta),
    });
    current.userProfile.history = current.userProfile.history.slice(-250);

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

  const influence = state.userProfile.side === input.side
    ? 1
    : state.userProfile.side === "observer"
      ? 0.25
      : 0.1;
  state.userProfile.currentSpectrum = clamp(state.userProfile.currentSpectrum + input.spectrumDelta * influence);
  state.userProfile.karma = clampRange(state.userProfile.karma + input.karmaDelta * influence, -100, 100);
  state.userProfile.riskIndex = clamp(state.userProfile.riskIndex + input.riskDelta * influence);
  state.userProfile.lastChange = round1(input.spectrumDelta * influence);
  state.userProfile.history.push({
    id: deterministicHistoryId(simulation.turn, input.source, input.side, "event", state.userProfile.history.length),
    turn: simulation.turn,
    source: input.source,
    side: input.side,
    spectrumDelta: round1(input.spectrumDelta * influence),
    karmaDelta: round1(input.karmaDelta * influence),
    riskDelta: round1(input.riskDelta * influence),
    reason: input.reason.slice(0, 500),
  });
  state.userProfile.history = state.userProfile.history.slice(-250);
  return recalculateTeamDynamics(simulation, state);
}

export function recalculateTeamDynamics(
  simulation: Pick<SimulationState, "turn" | "factions" | "publicConfidence" | "mediaPressure" | "blueTeamCoordination" | "evidenceQuality" | "cityTension" | "economyIndex">,
  input: TeamDynamicsState,
): TeamDynamicsState {
  const redFactions = simulation.factions.filter(faction => faction.faction === "criminal");
  const blueFactions = simulation.factions.filter(faction => faction.faction === "police");
  const redMoraleSignal = calculateCollectiveMorale(redFactions, input.red.collectiveMorale, simulation.cityTension, simulation.mediaPressure);
  const blueMoraleSignal = calculateCollectiveMorale(blueFactions, input.blue.collectiveMorale, 100 - simulation.publicConfidence, simulation.mediaPressure);
  const redSpectrum = calculateTeamSpectrum("red", redFactions, input.red.moralSpectrum, input.userProfile);
  const blueSpectrum = calculateTeamSpectrum("blue", blueFactions, input.blue.moralSpectrum, input.userProfile);
  const redRisk = calculateRedRisk(simulation, redFactions);
  const blueRisk = calculateBlueRisk(simulation, blueFactions);
  const territoryTotal = [...redFactions, ...blueFactions].reduce((sum, faction) => sum + faction.territories.length, 0);

  const assessment = estimateRealtimeTeamAssessment({
    red: buildMetrics({
      side: "red",
      factions: redFactions,
      morale: redMoraleSignal,
      spectrum: redSpectrum,
      risk: redRisk,
      territoryTotal,
      userProfile: input.userProfile,
    }),
    blue: buildMetrics({
      side: "blue",
      factions: blueFactions,
      morale: blueMoraleSignal,
      spectrum: blueSpectrum,
      risk: blueRisk,
      territoryTotal,
      userProfile: input.userProfile,
    }),
    context: {
      publicConfidence: simulation.publicConfidence,
      mediaPressure: simulation.mediaPressure,
      evidenceQuality: simulation.evidenceQuality,
      cityTension: simulation.cityTension,
      blueTeamCoordination: simulation.blueTeamCoordination,
      economyIndex: simulation.economyIndex,
      turn: simulation.turn,
    },
  });

  return {
    userProfile: {
      ...input.userProfile,
      initialSpectrum: clamp(input.userProfile.initialSpectrum),
      currentSpectrum: clamp(input.userProfile.currentSpectrum),
      karma: clampRange(input.userProfile.karma, -100, 100),
      riskIndex: clamp(input.userProfile.riskIndex),
      lastChange: round1(input.userProfile.lastChange),
      history: input.userProfile.history.slice(-250),
    },
    red: mapAssessmentToPulse(assessment.red, redRisk, input.userProfile),
    blue: mapAssessmentToPulse(assessment.blue, blueRisk, input.userProfile),
    updatedAtTurn: simulation.turn,
  };
}

export function moralSpectrumLabel(value: number): string {
  return moralAlignmentLabel(value);
}

function buildMetrics(input: {
  side: AssessmentSide;
  factions: readonly FactionState[];
  morale: number;
  spectrum: number;
  risk: number;
  territoryTotal: number;
  userProfile: PlayerAlignmentProfile;
}): TeamMetricsInput {
  const territoryCount = input.factions.reduce((sum, faction) => sum + faction.territories.length, 0);
  const karma = input.userProfile.side === input.side
    ? input.userProfile.karma
    : input.userProfile.side === "observer"
      ? input.userProfile.karma * 0.15
      : 0;
  const recentMomentum = clamp(
    input.morale * 0.45
    + averageOr(input.factions.map(faction => faction.cohesion), 50) * 0.25
    + averageOr(input.factions.map(faction => faction.intelligence), 50) * 0.15
    + (100 - input.risk) * 0.15,
  );

  return {
    side: input.side,
    cohesion: averageOr(input.factions.map(faction => faction.cohesion), 50),
    legitimacy: averageOr(input.factions.map(faction => faction.legitimacy), 50),
    intelligence: averageOr(input.factions.map(faction => faction.intelligence), 50),
    suspicion: averageOr(input.factions.map(faction => faction.suspicion), 20),
    resources: input.factions.reduce((sum, faction) => sum + Math.max(0, faction.treasury), 0),
    personnel: input.factions.reduce((sum, faction) => sum + Math.max(0, faction.personnel), 0),
    territoryControl: input.territoryTotal > 0 ? territoryCount / input.territoryTotal * 100 : 50,
    unitMorale: input.morale,
    moralAlignment: input.spectrum,
    karma,
    riskExposure: input.risk,
    recentMomentum,
  };
}

function mapAssessmentToPulse(
  assessment: ReturnType<typeof estimateRealtimeTeamAssessment>[TeamSide],
  riskPressure: number,
  user: PlayerAlignmentProfile,
): TeamPulse {
  return {
    side: assessment.side,
    moralSpectrum: round1(assessment.moralAlignment),
    collectiveMorale: round1(assessment.collectiveMorale),
    estimatedSuccess: round1(assessment.estimatedSuccessPercent),
    confidence: round1(assessment.confidence),
    riskPressure: round1(riskPressure),
    alignmentCoherence: round1(alignmentCoherence(assessment.moralAlignment, user, assessment.side)),
    factors: assessment.factors.map<TeamPulseFactor>(factor => ({
      label: factor.label,
      value: factor.normalizedValue,
      weight: factor.weight,
      contribution: factor.contribution,
      detail: factor.explanation,
    })),
    lastUpdatedTurn: assessment.calculatedAtTurn,
  };
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

function calculateRedRisk(
  simulation: Pick<SimulationState, "evidenceQuality" | "mediaPressure" | "cityTension">,
  factions: readonly FactionState[],
): number {
  return clamp(
    averageOr(factions.map(faction => faction.suspicion), 20) * 0.45
    + simulation.evidenceQuality * 0.3
    + simulation.mediaPressure * 0.15
    + simulation.cityTension * 0.1,
  );
}

function calculateBlueRisk(
  simulation: Pick<SimulationState, "publicConfidence" | "mediaPressure" | "cityTension">,
  factions: readonly FactionState[],
): number {
  const legitimacy = averageOr(factions.map(faction => faction.legitimacy), 50);
  return clamp(
    (100 - legitimacy) * 0.35
    + (100 - simulation.publicConfidence) * 0.25
    + simulation.mediaPressure * 0.2
    + simulation.cityTension * 0.2,
  );
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
  before: Pick<SimulationState, "publicConfidence" | "cityTension">,
  after: Pick<SimulationState, "evidenceQuality" | "publicConfidence" | "cityTension">,
): number {
  const tensionDelta = after.cityTension - before.cityTension;
  const publicDelta = after.publicConfidence - before.publicConfidence;
  if (action === "gather_intelligence") return side === "blue" && after.evidenceQuality < 50 ? 1 : 0;
  if (action === "reduce_pressure") return after.cityTension > 50 || tensionDelta < 0 ? 1 : 0;
  if (action === "expand_influence") return publicDelta < 0 ? -1 : 0;
  return 0;
}

function karmaContextAdjustment(
  action: PlayerTurnAction["type"],
  side: TeamSide,
  before: Pick<SimulationState, "publicConfidence" | "cityTension">,
  after: Pick<SimulationState, "publicConfidence" | "cityTension">,
): number {
  const tensionDelta = after.cityTension - before.cityTension;
  const publicDelta = after.publicConfidence - before.publicConfidence;
  if (action === "reduce_pressure" && tensionDelta < 0) return 1;
  if (action === "expand_influence" && publicDelta < 0) return -1;
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

function deterministicHistoryId(
  turn: number,
  source: string,
  side: TeamSide,
  action: string,
  sequence: number,
): string {
  return `alignment-${turn}-${source}-${side}-${action}-${sequence}`.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180);
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
