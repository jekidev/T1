export type TeamSide = "blue" | "red";

export interface AssessmentFactor {
  id: string;
  label: string;
  normalizedValue: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface TeamMetricsInput {
  side: TeamSide;
  cohesion: number;
  legitimacy: number;
  intelligence: number;
  suspicion: number;
  resources: number;
  personnel: number;
  territoryControl: number;
  unitMorale: number;
  moralAlignment: number;
  karma: number;
  riskExposure: number;
  recentMomentum: number;
}

export interface TeamAssessmentContext {
  publicConfidence: number;
  mediaPressure: number;
  evidenceQuality: number;
  cityTension: number;
  blueTeamCoordination: number;
  economyIndex: number;
  turn: number;
}

export interface TeamAssessmentResult {
  side: TeamSide;
  estimatedSuccessPercent: number;
  successRange: { minimum: number; maximum: number };
  collectiveMorale: number;
  moralAlignment: number;
  moralLabel: string;
  confidence: number;
  momentum: number;
  rawStrength: number;
  factors: AssessmentFactor[];
  calculatedAtTurn: number;
}

export interface RealtimeTeamAssessment {
  blue: TeamAssessmentResult;
  red: TeamAssessmentResult;
  parity: number;
  leadingSide: TeamSide | "tied";
  calculatedAtTurn: number;
}

export interface MoralAlignmentEvent {
  id: string;
  tick: number;
  actionType: string;
  prosocialImpact: number;
  integrityImpact: number;
  civilianImpact: number;
  proportionality: number;
  riskDelta: number;
  karmaDelta: number;
  explanation: string;
}

export interface MoralAlignmentHistoryEntry {
  eventId: string;
  tick: number;
  previousAlignment: number;
  nextAlignment: number;
  alignmentDelta: number;
  karmaDelta: number;
  riskDelta: number;
  explanation: string;
}

export interface MoralAlignmentProfile {
  initialAlignment: number;
  currentAlignment: number;
  karma: number;
  riskExposure: number;
  side: TeamSide;
  factionId?: string;
  history: MoralAlignmentHistoryEntry[];
}

const BLUE_WEIGHTS = {
  cohesion: 0.13,
  legitimacy: 0.12,
  intelligence: 0.15,
  operationalSecurity: 0.06,
  resources: 0.10,
  personnel: 0.07,
  territoryControl: 0.07,
  morale: 0.09,
  publicConfidence: 0.07,
  evidenceQuality: 0.09,
  coordination: 0.05,
} as const;

const RED_WEIGHTS = {
  cohesion: 0.14,
  legitimacy: 0.06,
  intelligence: 0.12,
  operationalSecurity: 0.14,
  resources: 0.11,
  personnel: 0.08,
  territoryControl: 0.10,
  morale: 0.10,
  tensionLeverage: 0.05,
  economyResilience: 0.04,
  momentum: 0.06,
} as const;

export function createMoralAlignmentProfile(input: {
  initialAlignment: number;
  side: TeamSide;
  factionId?: string;
}): MoralAlignmentProfile {
  const initialAlignment = clamp(input.initialAlignment);
  return {
    initialAlignment,
    currentAlignment: initialAlignment,
    karma: 0,
    riskExposure: 0,
    side: input.side,
    ...(input.factionId ? { factionId: input.factionId } : {}),
    history: [],
  };
}

export function applyMoralAlignmentEvent(
  profileInput: MoralAlignmentProfile,
  eventInput: MoralAlignmentEvent,
  maximumHistory = 250,
): MoralAlignmentProfile {
  const profile = structuredClone(profileInput);
  const event = normalizeAlignmentEvent(eventInput);
  if (profile.history.some(entry => entry.eventId === event.id)) return profile;

  const ethicalSignal = (
    event.prosocialImpact * 0.30
    + event.integrityImpact * 0.25
    - event.civilianImpact * 0.20
    + event.proportionality * 0.15
    + event.karmaDelta * 0.10
  );
  const riskPressure = Math.max(0, event.riskDelta) * 0.04;
  const alignmentDelta = roundTo(clampSigned(ethicalSignal / 18 - riskPressure, 8), 2);
  const previousAlignment = profile.currentAlignment;
  const nextAlignment = roundTo(clamp(previousAlignment + alignmentDelta), 2);

  profile.currentAlignment = nextAlignment;
  profile.karma = roundTo(clampRange(profile.karma + event.karmaDelta, -10_000, 10_000), 2);
  profile.riskExposure = roundTo(clamp(profile.riskExposure + event.riskDelta), 2);
  profile.history.push({
    eventId: event.id,
    tick: event.tick,
    previousAlignment,
    nextAlignment,
    alignmentDelta: roundTo(nextAlignment - previousAlignment, 2),
    karmaDelta: event.karmaDelta,
    riskDelta: event.riskDelta,
    explanation: event.explanation,
  });
  profile.history = profile.history
    .sort((a, b) => a.tick - b.tick || a.eventId.localeCompare(b.eventId))
    .slice(-Math.max(1, maximumHistory));
  return profile;
}

export function estimateRealtimeTeamAssessment(input: {
  blue: TeamMetricsInput;
  red: TeamMetricsInput;
  context: TeamAssessmentContext;
}): RealtimeTeamAssessment {
  if (input.blue.side !== "blue" || input.red.side !== "red") {
    throw new Error("Blue and Red metrics must use their matching side identifiers.");
  }

  const blueModel = computeRawTeamAssessment(input.blue, input.context);
  const redModel = computeRawTeamAssessment(input.red, input.context);
  const blueProbability = normalizedProbability(blueModel.rawStrength, redModel.rawStrength);
  const redProbability = roundTo(100 - blueProbability, 1);
  const blue = finalizeTeamAssessment(blueModel, blueProbability, input.context.turn);
  const red = finalizeTeamAssessment(redModel, redProbability, input.context.turn);
  const difference = Math.abs(blueProbability - redProbability);

  return {
    blue,
    red,
    parity: roundTo(100 - difference, 1),
    leadingSide: difference < 0.2 ? "tied" : blueProbability > redProbability ? "blue" : "red",
    calculatedAtTurn: input.context.turn,
  };
}

export function moralAlignmentLabel(value: number): string {
  const normalized = clamp(value);
  if (normalized < 15) return "Ekstremt destruktiv";
  if (normalized < 35) return "Selvcentreret / hård";
  if (normalized < 48) return "Pragmatisk mørk";
  if (normalized <= 52) return "Moralsk blandet";
  if (normalized <= 65) return "Pragmatisk principfast";
  if (normalized <= 85) return "Prosocial / principfast";
  return "Ekstremt altruistisk";
}

function computeRawTeamAssessment(metricsInput: TeamMetricsInput, contextInput: TeamAssessmentContext): {
  metrics: TeamMetricsInput;
  rawStrength: number;
  collectiveMorale: number;
  confidence: number;
  factors: AssessmentFactor[];
} {
  const metrics = normalizeMetrics(metricsInput);
  const context = normalizeContext(contextInput);
  const factors = metrics.side === "blue"
    ? blueFactors(metrics, context)
    : redFactors(metrics, context);
  const weightedStrength = factors.reduce((sum, factor) => sum + factor.contribution, 0);
  const moralCoherence = 100 - Math.abs(metrics.moralAlignment - 50) * 0.35;
  const karmaSignal = clamp(50 + metrics.karma / 20);
  const collectiveMorale = clamp(
    metrics.cohesion * 0.30
    + metrics.unitMorale * 0.25
    + metrics.legitimacy * 0.10
    + metrics.recentMomentum * 0.15
    + resourceReadiness(metrics.resources) * 0.10
    + moralCoherence * 0.05
    + karmaSignal * 0.05
    - metrics.riskExposure * 0.12,
  );
  const volatility = (
    metrics.riskExposure * 0.30
    + context.cityTension * 0.20
    + context.mediaPressure * 0.15
    + Math.abs(metrics.recentMomentum - 50) * 0.10
  );
  const confidence = clampRange(92 - volatility * 0.45, 45, 92);
  const rawStrength = clamp(
    weightedStrength
    + (collectiveMorale - 50) * 0.12
    + (metrics.recentMomentum - 50) * 0.08,
  );
  return { metrics, rawStrength, collectiveMorale, confidence, factors };
}

function blueFactors(metrics: TeamMetricsInput, context: TeamAssessmentContext): AssessmentFactor[] {
  return [
    factor("cohesion", "Sammenhold", metrics.cohesion, BLUE_WEIGHTS.cohesion, "Intern koordinering og evne til at følge en samlet plan."),
    factor("legitimacy", "Legitimitet", metrics.legitimacy, BLUE_WEIGHTS.legitimacy, "Offentlig og institutionel accept af Blue Teams handlinger."),
    factor("intelligence", "Efterretning", metrics.intelligence, BLUE_WEIGHTS.intelligence, "Kvalitet og aktualitet af Blue Teams informationsbillede."),
    factor("operational-security", "Operativ sikkerhed", 100 - metrics.suspicion, BLUE_WEIGHTS.operationalSecurity, "Lav intern eksponering og færre kompromitterede planer."),
    factor("resources", "Ressourceberedskab", resourceReadiness(metrics.resources), BLUE_WEIGHTS.resources, "Tilgængelige midler i forhold til et professionelt beredskab."),
    factor("personnel", "Personeldækning", personnelReadiness(metrics.personnel), BLUE_WEIGHTS.personnel, "Tilstrækkeligt personale uden lineær fordel ved ekstrem størrelse."),
    factor("territory", "Områdekontrol", metrics.territoryControl, BLUE_WEIGHTS.territoryControl, "Kontrol over relevante områder, adgang og tilstedeværelse."),
    factor("morale", "Kollektiv morale", metrics.unitMorale, BLUE_WEIGHTS.morale, "Enhedernes kampvilje, udholdenhed og tillid."),
    factor("public-confidence", "Offentlig tillid", context.publicConfidence, BLUE_WEIGHTS.publicConfidence, "Samarbejde, informationsdeling og politisk råderum."),
    factor("evidence", "Beviskvalitet", context.evidenceQuality, BLUE_WEIGHTS.evidenceQuality, "Dokumentationens styrke og anvendelighed."),
    factor("coordination", "Blue Team-koordinering", context.blueTeamCoordination, BLUE_WEIGHTS.coordination, "Samarbejde mellem Blue Team-enheder og institutioner."),
  ];
}

function redFactors(metrics: TeamMetricsInput, context: TeamAssessmentContext): AssessmentFactor[] {
  return [
    factor("cohesion", "Sammenhold", metrics.cohesion, RED_WEIGHTS.cohesion, "Intern loyalitet, disciplin og fælles retning."),
    factor("legitimacy", "Social legitimitet", metrics.legitimacy, RED_WEIGHTS.legitimacy, "Lokal accept, relationer og evne til at bevare støtte."),
    factor("intelligence", "Informationsfordel", metrics.intelligence, RED_WEIGHTS.intelligence, "Kendskab til omgivelser, modparter og ændringer i presset."),
    factor("operational-security", "Lav eksponering", 100 - metrics.suspicion, RED_WEIGHTS.operationalSecurity, "Evne til at undgå kompromittering og forudsigelighed."),
    factor("resources", "Ressourceberedskab", resourceReadiness(metrics.resources), RED_WEIGHTS.resources, "Likviditet, forsyninger og adgang til nødvendige assets."),
    factor("personnel", "Personelkapacitet", personnelReadiness(metrics.personnel), RED_WEIGHTS.personnel, "Kapacitet til at gennemføre samtidige mål."),
    factor("territory", "Områdekontrol", metrics.territoryControl, RED_WEIGHTS.territoryControl, "Kontrol, mobilitet og lokal tilstedeværelse."),
    factor("morale", "Kollektiv morale", metrics.unitMorale, RED_WEIGHTS.morale, "Vilje til at fortsætte trods pres og tab."),
    factor("tension", "Spændingsudnyttelse", context.cityTension, RED_WEIGHTS.tensionLeverage, "Høj spænding kan skabe åbninger, men øger samtidig volatilitet."),
    factor("economy", "Økonomisk robusthed", economyReadiness(context.economyIndex), RED_WEIGHTS.economyResilience, "Hvor godt netværket kan fungere under den aktuelle økonomi."),
    factor("momentum", "Momentum", metrics.recentMomentum, RED_WEIGHTS.momentum, "Seneste udvikling, mål og konsekvenser."),
  ];
}

function finalizeTeamAssessment(
  model: ReturnType<typeof computeRawTeamAssessment>,
  probability: number,
  turn: number,
): TeamAssessmentResult {
  const uncertainty = (100 - model.confidence) * 0.18 + 2;
  return {
    side: model.metrics.side,
    estimatedSuccessPercent: probability,
    successRange: {
      minimum: roundTo(clamp(probability - uncertainty), 1),
      maximum: roundTo(clamp(probability + uncertainty), 1),
    },
    collectiveMorale: roundTo(model.collectiveMorale, 1),
    moralAlignment: roundTo(model.metrics.moralAlignment, 1),
    moralLabel: moralAlignmentLabel(model.metrics.moralAlignment),
    confidence: roundTo(model.confidence, 1),
    momentum: roundTo(model.metrics.recentMomentum, 1),
    rawStrength: roundTo(model.rawStrength, 2),
    factors: model.factors,
    calculatedAtTurn: turn,
  };
}

function normalizedProbability(blueStrength: number, redStrength: number): number {
  const temperature = 18;
  const blueExp = Math.exp((blueStrength - 50) / temperature);
  const redExp = Math.exp((redStrength - 50) / temperature);
  return roundTo(clamp(blueExp / (blueExp + redExp) * 100), 1);
}

function factor(
  id: string,
  label: string,
  value: number,
  weight: number,
  explanation: string,
): AssessmentFactor {
  const normalizedValue = clamp(value);
  return {
    id,
    label,
    normalizedValue: roundTo(normalizedValue, 1),
    weight,
    contribution: roundTo(normalizedValue * weight, 2),
    explanation,
  };
}

function normalizeMetrics(input: TeamMetricsInput): TeamMetricsInput {
  return {
    side: input.side,
    cohesion: clamp(input.cohesion),
    legitimacy: clamp(input.legitimacy),
    intelligence: clamp(input.intelligence),
    suspicion: clamp(input.suspicion),
    resources: Math.max(0, finite(input.resources)),
    personnel: Math.max(0, finite(input.personnel)),
    territoryControl: clamp(input.territoryControl),
    unitMorale: clamp(input.unitMorale),
    moralAlignment: clamp(input.moralAlignment),
    karma: clampRange(finite(input.karma), -10_000, 10_000),
    riskExposure: clamp(input.riskExposure),
    recentMomentum: clamp(input.recentMomentum),
  };
}

function normalizeContext(input: TeamAssessmentContext): TeamAssessmentContext {
  return {
    publicConfidence: clamp(input.publicConfidence),
    mediaPressure: clamp(input.mediaPressure),
    evidenceQuality: clamp(input.evidenceQuality),
    cityTension: clamp(input.cityTension),
    blueTeamCoordination: clamp(input.blueTeamCoordination),
    economyIndex: clampRange(input.economyIndex, 0, 200),
    turn: Math.max(0, Math.trunc(input.turn)),
  };
}

function normalizeAlignmentEvent(input: MoralAlignmentEvent): MoralAlignmentEvent {
  if (!input.id.trim()) throw new Error("Moral alignment event id is required.");
  if (!Number.isInteger(input.tick) || input.tick < 0) throw new Error("Moral alignment event tick must be non-negative.");
  return {
    ...input,
    id: input.id.slice(0, 180),
    actionType: input.actionType.slice(0, 120),
    prosocialImpact: clampRange(finite(input.prosocialImpact), -100, 100),
    integrityImpact: clampRange(finite(input.integrityImpact), -100, 100),
    civilianImpact: clampRange(finite(input.civilianImpact), -100, 100),
    proportionality: clampRange(finite(input.proportionality), -100, 100),
    riskDelta: clampRange(finite(input.riskDelta), -100, 100),
    karmaDelta: clampRange(finite(input.karmaDelta), -100, 100),
    explanation: input.explanation.slice(0, 500),
  };
}

function resourceReadiness(resources: number): number {
  return clamp(100 * (1 - Math.exp(-resources / 180_000)));
}

function personnelReadiness(personnel: number): number {
  return clamp(100 * (1 - Math.exp(-personnel / 35)));
}

function economyReadiness(index: number): number {
  return clamp(50 + (index - 100) * 0.5);
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number): number {
  return clampRange(finite(value), 0, 100);
}

function clampRange(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampSigned(value: number, maximumMagnitude: number): number {
  return clampRange(value, -maximumMagnitude, maximumMagnitude);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
