// Core domain types for the Nordlys Command tactical simulation engine.
// This module is the single source of truth for board/entity/scoring shapes.
// The `board` JSON blob persisted via the API (Scenario.board) must match `BoardState`.

export type Faction = "police" | "criminal" | "neutral";

export type EntityCategory =
  | "unit"
  | "location"
  | "resource"
  | "barrier"
  | "objective"
  | "evidence"
  | "vehicle"
  | "surveillance"
  | "civilian"
  | "event";

export interface EntityAttributes {
  mobility: number;
  visibility: number;
  intelligence: number;
  influence: number;
  resources: number;
  readiness: number;
  legalAuthority: number;
  risk: number;
  morale: number;
}

export const DEFAULT_ATTRIBUTES: EntityAttributes = {
  mobility: 50,
  visibility: 50,
  intelligence: 50,
  influence: 50,
  resources: 50,
  readiness: 50,
  legalAuthority: 0,
  risk: 30,
  morale: 60,
};

export interface BoardEntity {
  id: string;
  templateId: string;
  category: EntityCategory;
  faction: Faction;
  label: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
  layerId: string;
  zoneId: string | null;
  groupId: string | null;
  locked: boolean;
  attributes: EntityAttributes;
  notes: string;
}

export type ZoneKind = "jurisdiction" | "risk" | "visibility" | "operational" | "custom";

export interface BoardZone {
  id: string;
  name: string;
  kind: ZoneKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  notes: string;
}

export interface BoardLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface ScenarioPhase {
  id: string;
  name: string;
  description: string;
  order: number;
}

export type TimelineEventSeverity = "info" | "caution" | "critical";

export interface TimelineEvent {
  id: string;
  phaseId: string | null;
  label: string;
  description: string;
  severity: TimelineEventSeverity;
  createdAt: string;
}

export interface MoveLogEntry {
  id: string;
  summary: string;
  actorFaction: Faction | null;
  createdAt: string;
}

export interface GeneratedGameContent {
  generatedAt: string;
  generatedBy: string;
  premise: string;
  storyline: string;
  openingMission: string;
  tutorialSummary: string;
  factions: Array<{ name: string; faction: Faction; role: string; goal: string }>;
  assets: Array<{ name: string; type: string; description: string }>;
  shops: Array<{ name: string; district: string; description: string }>;
  skills: Array<{ name: string; description: string }>;
  sourceCases: string[];
  rawModelOutput?: string;
}

export interface BoardWorldState {
  country: string;
  region: string;
  municipality: string;
  city: string;
  latitude: number;
  longitude: number;
  workAreaRadiusKm: number;
  mapProvider: "google" | "openstreetmap";
  language: string;
  currency: string;
  timezone: string;
}

export interface BoardState {
  version: number;
  mapTemplateId: string;
  zones: BoardZone[];
  entities: BoardEntity[];
  layers: BoardLayer[];
  phases: ScenarioPhase[];
  currentPhaseId: string | null;
  timelineEvents: TimelineEvent[];
  moveHistory: MoveLogEntry[];
  notes: string;
  world?: BoardWorldState;
  generatedContent?: GeneratedGameContent;
  tutorialCompleted?: boolean;
}

export function createEmptyBoard(mapTemplateId: string): BoardState {
  const defaultLayerId = "layer-default";
  const planningPhaseId = "phase-planning";
  return {
    version: 2,
    mapTemplateId,
    zones: [],
    entities: [],
    layers: [{ id: defaultLayerId, name: "Ground", visible: true, locked: false, order: 0 }],
    phases: [{ id: planningPhaseId, name: "Planning", description: "Initial scenario setup and force disposition.", order: 0 }],
    currentPhaseId: planningPhaseId,
    timelineEvents: [],
    moveHistory: [],
    notes: "",
    tutorialCompleted: false,
  };
}

export type ScoreKey =
  | "publicSafety"
  | "evidenceQuality"
  | "operationalRisk"
  | "detection"
  | "civilianImpact"
  | "resourceUse"
  | "legitimacy"
  | "networkDisruption"
  | "missionObjectives";

export interface ScoreFactor {
  label: string;
  contribution: number;
  detail: string;
}

export interface ScoreResult {
  key: ScoreKey;
  label: string;
  value: number;
  summary: string;
  factors: ScoreFactor[];
}

export type AdvisorRole =
  | "neutral_analyst"
  | "police_commander"
  | "investigator"
  | "legal_reviewer"
  | "story_director"
  | "red_team_risk_model";

export interface AdvisorRoleMeta {
  id: AdvisorRole;
  name: string;
  tagline: string;
  description: string;
}

export const ADVISOR_ROLES: AdvisorRoleMeta[] = [
  { id: "neutral_analyst", name: "Neutral Analyst", tagline: "Balanced, data-driven read of the board", description: "Weighs both sides objectively and explains what the current board state implies for risk, coverage, and likely outcomes." },
  { id: "police_commander", name: "Police Incident Commander", tagline: "Operational lead for the Blue Team", description: "Advises on lawful tactical deployment, resource allocation, jurisdiction, and public-safety tradeoffs from a command perspective." },
  { id: "investigator", name: "Investigator", tagline: "Evidence and case-building focus", description: "Focuses on evidence quality, chain of custody, witness reliability, and how to strengthen the case against the network." },
  { id: "legal_reviewer", name: "Legal / Ethics Reviewer", tagline: "Oversight and legitimacy check", description: "Flags legal authority gaps, proportionality concerns, civil-rights exposure, and legitimacy risks in the current plan." },
  { id: "story_director", name: "Story Director", tagline: "Narrative consequences and pacing", description: "Narrates how the scenario is unfolding, surfaces dramatic stakes, and proposes narrative complications consistent with the board." },
  { id: "red_team_risk_model", name: "Red-Team Game Director", tagline: "Red Team systems, progression and counterplay", description: "Designs and analyzes Red Team factions, tools, shops, skills, missions, risk, consequences, and Blue Team counterplay as game systems." },
];
