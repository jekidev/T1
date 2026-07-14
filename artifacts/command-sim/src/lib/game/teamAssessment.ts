import {
  applyMoralAlignmentEvent,
  createMoralAlignmentProfile,
  estimateRealtimeTeamAssessment,
  type MoralAlignmentEvent,
  type MoralAlignmentProfile,
  type RealtimeTeamAssessment,
  type TeamMetricsInput,
  type TeamSide,
} from "@workspace/strategy-sim";
import type { BoardState, Faction, FactionState, PlayerTurnAction, SimulationState } from "./types";

export interface EthicsTurnResult {
  simulation: SimulationState;
  event?: MoralAlignmentEvent;
}

export function initializePlayerMoralProfile(input: {
  factions: readonly FactionState[];
  initialAlignment: number;
  preferredSide?: TeamSide;
}): MoralAlignmentProfile {
  const preferredSide = input.preferredSide ?? "red";
  const targetFaction = input.factions.find(faction => sideForFaction(faction.faction) === preferredSide)
    ?? input.factions.find(faction => faction.faction !== "neutral");
  return createMoralAlignmentProfile({
    initialAlignment: input.initialAlignment,
    side: targetFaction ? sideForFaction(targetFaction.faction) ?? preferredSide : preferredSide,
    ...(targetFaction ? { factionId: targetFaction.id } : {}),
  });
}

export function computeBoardTeamAssessment(
  board: Pick<BoardState, "entities">,
  simulation: SimulationState,
): RealtimeTeamAssessment {
  const blue = aggregateTeamMetrics("blue", board, simulation);
  const red = aggregateTeamMetrics("red", board, simulation);
  return estimateRealtimeTeamAssessment({
    blue,
    red,
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
}

export function applyPlayerTurnEthics(input: {
  board: Pick<BoardState, "entities">;
  previous: SimulationState;
  next: SimulationState;
  action?: PlayerTurnAction;
}): EthicsTurnResult {
  const existingProfile = input.previous.playerMoralProfile
    ?? initializePlayerMoralProfile({ factions: input.previous.factions, initialAlignment: 50, preferredSide: "red" });
  if (!input.action) {
    const simulation = synchronizeAssessment(input.board, {
      ...input.next,
      playerMoralProfile: existingProfile,
    });
    return { simulation };
  }

  const actionFaction = input.action.factionId
    ? input.next.factions.find(faction => faction.id === input.action!.factionId)
    : input.next.factions.find(faction => faction.id === existingProfile.factionId);
  const profile = actionProfile(input.action.type, actionFaction?.faction ?? factionForSide(existingProfile.side));
  const publicDelta = input.next.publicConfidence - input.previous.publicConfidence;
  const tensionDelta = input.next.cityTension - input.previous.cityTension;
  const legitimacyDelta = actionFaction
    ? actionFaction.legitimacy - (input.previous.factions.find(faction => faction.id === actionFaction.id)?.legitimacy ?? actionFaction.legitimacy)
    : 0;
  const event: MoralAlignmentEvent = {
    id: `turn-${input.next.turn}-${input.action.type}-${actionFaction?.id ?? existingProfile.factionId ?? "player"}`,
    tick: input.next.turn,
    actionType: input.action.type,
    prosocialImpact: profile.prosocialImpact + publicDelta * 4 - Math.max(0, tensionDelta) * 2,
    integrityImpact: profile.integrityImpact + legitimacyDelta * 3,
    civilianImpact: profile.civilianImpact + Math.max(0, tensionDelta) * 4,
    proportionality: profile.proportionality - Math.max(0, input.action.amount ?? 0) * profile.amountRiskScale,
    riskDelta: profile.riskDelta + Math.max(0, tensionDelta) * 1.5,
    karmaDelta: profile.karmaDelta + publicDelta * 0.8 - Math.max(0, tensionDelta) * 0.6,
    explanation: profile.explanation,
  };
  const playerMoralProfile = applyMoralAlignmentEvent(existingProfile, event);
  const factions = input.next.factions.map(faction => {
    if (faction.id !== playerMoralProfile.factionId) return faction;
    return {
      ...faction,
      moralAlignment: playerMoralProfile.currentAlignment,
      karma: playerMoralProfile.karma,
      riskExposure: playerMoralProfile.riskExposure,
    };
  });
  const simulation = synchronizeAssessment(input.board, {
    ...input.next,
    factions,
    playerMoralProfile,
  });
  return { simulation, event };
}

export function synchronizeAssessment(
  board: Pick<BoardState, "entities">,
  simulation: SimulationState,
): SimulationState {
  const teamAssessment = computeBoardTeamAssessment(board, simulation);
  const factions = simulation.factions.map(faction => {
    const side = sideForFaction(faction.faction);
    if (!side) return faction;
    const assessment = teamAssessment[side];
    return {
      ...faction,
      collectiveMorale: assessment.collectiveMorale,
    };
  });
  return { ...simulation, factions, teamAssessment };
}

function aggregateTeamMetrics(
  side: TeamSide,
  board: Pick<BoardState, "entities">,
  simulation: SimulationState,
): TeamMetricsInput {
  const factionType: Faction = factionForSide(side);
  const factions = simulation.factions.filter(faction => faction.faction === factionType);
  const sideEntities = board.entities.filter(entity => entity.faction === factionType);
  const allControlledTerritories = simulation.factions
    .filter(faction => faction.faction !== "neutral")
    .reduce((sum, faction) => sum + faction.territories.length, 0);
  const sideTerritories = factions.reduce((sum, faction) => sum + faction.territories.length, 0);
  const defaults = defaultMetrics(side);

  return {
    side,
    cohesion: average(factions.map(faction => faction.cohesion), defaults.cohesion),
    legitimacy: average(factions.map(faction => faction.legitimacy), defaults.legitimacy),
    intelligence: average(factions.map(faction => faction.intelligence), defaults.intelligence),
    suspicion: average(factions.map(faction => faction.suspicion), defaults.suspicion),
    resources: factions.reduce((sum, faction) => sum + Math.max(0, faction.treasury), 0),
    personnel: factions.reduce((sum, faction) => sum + Math.max(0, faction.personnel), 0),
    territoryControl: allControlledTerritories > 0 ? sideTerritories / allControlledTerritories * 100 : 50,
    unitMorale: average([
      ...factions.map(faction => faction.collectiveMorale ?? faction.cohesion),
      ...sideEntities.map(entity => entity.attributes.morale),
    ], defaults.unitMorale),
    moralAlignment: weightedFactionAverage(factions, "moralAlignment", defaults.moralAlignment),
    karma: average(factions.map(faction => faction.karma ?? 0), 0),
    riskExposure: average(factions.map(faction => faction.riskExposure ?? faction.suspicion), defaults.riskExposure),
    recentMomentum: average(factions.map(faction => faction.recentMomentum ?? 50), 50),
  };
}

function actionProfile(type: PlayerTurnAction["type"], faction: Faction) {
  const profiles: Record<PlayerTurnAction["type"], {
    prosocialImpact: number;
    integrityImpact: number;
    civilianImpact: number;
    proportionality: number;
    riskDelta: number;
    karmaDelta: number;
    amountRiskScale: number;
    explanation: string;
  }> = {
    invest: {
      prosocialImpact: 12,
      integrityImpact: 8,
      civilianImpact: 0,
      proportionality: 12,
      riskDelta: 2,
      karmaDelta: 2,
      amountRiskScale: 0.05,
      explanation: "Investering styrkede langsigtet kapacitet med begrænset direkte skade.",
    },
    gather_intelligence: {
      prosocialImpact: 3,
      integrityImpact: faction === "police" ? 4 : -2,
      civilianImpact: 4,
      proportionality: 2,
      riskDelta: 6,
      karmaDelta: 0,
      amountRiskScale: 0.08,
      explanation: "Informationsindsamling gav strategisk værdi, men øgede eksponering og mulig påvirkning af andre.",
    },
    reduce_pressure: {
      prosocialImpact: 32,
      integrityImpact: 22,
      civilianImpact: -12,
      proportionality: 30,
      riskDelta: -10,
      karmaDelta: 8,
      amountRiskScale: 0.02,
      explanation: "Deeskalering reducerede pres, risiko og sandsynlig skade på omgivelserne.",
    },
    expand_influence: {
      prosocialImpact: faction === "criminal" ? -12 : 6,
      integrityImpact: faction === "criminal" ? -8 : 3,
      civilianImpact: faction === "criminal" ? 12 : 5,
      proportionality: faction === "criminal" ? -10 : 2,
      riskDelta: faction === "criminal" ? 14 : 7,
      karmaDelta: faction === "criminal" ? -5 : 1,
      amountRiskScale: 0.12,
      explanation: "Udvidelse af indflydelse gav momentum, men skabte nye magt-, risiko- og legitimitetskonsekvenser.",
    },
    train: {
      prosocialImpact: 5,
      integrityImpact: 5,
      civilianImpact: 0,
      proportionality: 8,
      riskDelta: 3,
      karmaDelta: 1,
      amountRiskScale: 0.03,
      explanation: "Træning forbedrede beredskab uden direkte ændring af omverdenen.",
    },
    wait: {
      prosocialImpact: 0,
      integrityImpact: 0,
      civilianImpact: 0,
      proportionality: 0,
      riskDelta: -1,
      karmaDelta: 0,
      amountRiskScale: 0,
      explanation: "Ingen aktiv handling; eksisterende udvikling fortsatte.",
    },
  };
  return profiles[type];
}

function defaultMetrics(side: TeamSide) {
  return side === "blue"
    ? { cohesion: 60, legitimacy: 65, intelligence: 55, suspicion: 10, unitMorale: 60, moralAlignment: 60, riskExposure: 20 }
    : { cohesion: 58, legitimacy: 40, intelligence: 52, suspicion: 25, unitMorale: 58, moralAlignment: 40, riskExposure: 35 };
}

function weightedFactionAverage(
  factions: readonly FactionState[],
  key: "moralAlignment",
  fallback: number,
): number {
  if (factions.length === 0) return fallback;
  let totalWeight = 0;
  let total = 0;
  for (const faction of factions) {
    const weight = Math.max(1, faction.personnel);
    totalWeight += weight;
    total += (faction[key] ?? fallback) * weight;
  }
  return total / totalWeight;
}

function average(values: readonly number[], fallback: number): number {
  const finiteValues = values.filter(Number.isFinite);
  return finiteValues.length > 0
    ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
    : fallback;
}

function sideForFaction(faction: Faction): TeamSide | undefined {
  if (faction === "police") return "blue";
  if (faction === "criminal") return "red";
  return undefined;
}

function factionForSide(side: TeamSide): Faction {
  return side === "blue" ? "police" : "criminal";
}
