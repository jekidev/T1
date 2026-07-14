import type { StrategySimulationSnapshot } from "@workspace/strategy-sim";

// Core domain types for the Nordlys Command tactical simulation engine.
// The persisted Scenario.board JSON must match BoardState.

export type Faction = "police" | "criminal" | "neutral";
export type FactStatus = "verified" | "corroborated" | "assessed" | "disputed" | "unverified" | "fictional" | "balance";

export interface SourceReference {
  id: string;
  title: string;
  url?: string;
  publisher?: string;
  publishedAt?: string;
  status: FactStatus;
  confidence: number;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  placeId?: string;
  address?: string;
  precision: "exact" | "approximate" | "district" | "generated";
}

export type EntityCategory = "unit" | "location" | "resource" | "barrier" | "objective" | "evidence" | "vehicle" | "surveillance" | "civilian" | "event";

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

export const DEFAULT_ATTRIBUTES: EntityAttributes = { mobility: 50, visibility: 50, intelligence: 50, influence: 50, resources: 50, readiness: 50, legalAuthority: 0, risk: 30, morale: 60 };

export interface BoardEntity {
  id: string;
  templateId: string;
  category: EntityCategory;
  faction: Faction;
  label: string;
  x: number;
  y: number;
  geo?: GeoPosition;
  rotation: number;
  scale: number;
  zIndex: number;
  layerId: string;
  zoneId: string | null;
  groupId: string | null;
  locked: boolean;
  attributes: EntityAttributes;
  notes: string;
  sourceStatus?: FactStatus;
  sourceIds?: string[];
}

export type ZoneKind = "jurisdiction" | "risk" | "visibility" | "operational" | "custom";
export interface BoardZone { id: string; name: string; kind: ZoneKind; x: number; y: number; width: number; height: number; color: string; notes: string; geoBounds?: { north: number; south: number; east: number; west: number }; sourceStatus?: FactStatus; }
export interface BoardLayer { id: string; name: string; visible: boolean; locked: boolean; order: number; }
export interface ScenarioPhase { id: string; name: string; description: string; order: number; }
export type TimelineEventSeverity = "info" | "caution" | "critical";
export interface TimelineEvent { id: string; phaseId: string | null; label: string; description: string; severity: TimelineEventSeverity; createdAt: string; sourceStatus?: FactStatus; }
export interface MoveLogEntry { id: string; summary: string; actorFaction: Faction | null; createdAt: string; }

export interface GeneratedFaction { name: string; faction: Faction; role: string; goal: string; }
export interface GeneratedAsset { name: string; type: string; description: string; district?: string; }
export interface GeneratedShop { name: string; district: string; description: string; inventory?: string[]; }
export interface GeneratedSkill { name: string; description: string; }

export interface GeneratedGameContent {
  generatedAt: string;
  generatedBy: string;
  premise: string;
  storyline: string;
  openingMission: string;
  tutorialSummary: string;
  factions: GeneratedFaction[];
  assets: GeneratedAsset[];
  shops: GeneratedShop[];
  skills: GeneratedSkill[];
  sourceCases: string[];
  rawModelOutput?: string;
  validationWarnings?: string[];
}

export interface BoardWorldState { country: string; region: string; municipality: string; city: string; latitude: number; longitude: number; workAreaRadiusKm: number; mapProvider: "google" | "openstreetmap"; language: string; currency: string; timezone: string; }

export interface FactionState {
  id: string;
  name: string;
  faction: Faction;
  treasury: number;
  personnel: number;
  cohesion: number;
  legitimacy: number;
  intelligence: number;
  suspicion: number;
  territories: string[];
  relationships: Record<string, number>;
  objectives: string[];
}

export interface ShopState { id: string; name: string; district: string; reputationRequired: number; scarcity: number; pressure: number; inventory: Array<{ id: string; name: string; price: number; stock: number; quality: number }>; }
export interface SkillState { id: string; name: string; level: number; experience: number; description: string; }
export interface SimulationState { seed: number; turn: number; day: number; hour: number; publicConfidence: number; mediaPressure: number; blueTeamCoordination: number; evidenceQuality: number; cityTension: number; economyIndex: number; factions: FactionState[]; shops: ShopState[]; skills: SkillState[]; lastResolution?: string; }

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
  simulation?: SimulationState;
  strategySnapshot?: StrategySimulationSnapshot;
  sources?: SourceReference[];
  tutorialCompleted?: boolean;
}

export function createEmptyBoard(mapTemplateId: string): BoardState {
  const planningPhaseId = "phase-planning";
  return { version: 3, mapTemplateId, zones: [], entities: [], layers: [{ id: "layer-default", name: "Ground", visible: true, locked: false, order: 0 }], phases: [{ id: planningPhaseId, name: "Planning", description: "Initial scenario setup and force disposition.", order: 0 }], currentPhaseId: planningPhaseId, timelineEvents: [], moveHistory: [], notes: "", sources: [], tutorialCompleted: false };
}

export type ScoreKey = "publicSafety" | "evidenceQuality" | "operationalRisk" | "detection" | "civilianImpact" | "resourceUse" | "legitimacy" | "networkDisruption" | "missionObjectives";
export interface ScoreFactor { label: string; contribution: number; detail: string; }
export interface ScoreResult { key: ScoreKey; label: string; value: number; summary: string; factors: ScoreFactor[]; }

export type AdvisorRole = "neutral_analyst" | "police_commander" | "investigator" | "legal_reviewer" | "story_director" | "red_team_risk_model";
export interface AdvisorRoleMeta { id: AdvisorRole; name: string; tagline: string; description: string; }
export const ADVISOR_ROLES: AdvisorRoleMeta[] = [
  { id: "neutral_analyst", name: "Neutral Analyst", tagline: "Balanced, data-driven read of the board", description: "Weighs all factions objectively and explains risk, coverage and likely outcomes." },
  { id: "police_commander", name: "Police Incident Commander", tagline: "Operational lead for the Blue Team", description: "Advises on lawful deployment, resources, jurisdiction and public-safety tradeoffs." },
  { id: "investigator", name: "Investigator", tagline: "Evidence and case-building focus", description: "Focuses on evidence quality, sources, witnesses and case progression." },
  { id: "legal_reviewer", name: "Legal / Ethics Reviewer", tagline: "Oversight and legitimacy check", description: "Flags authority gaps, proportionality, rights exposure and unsupported claims." },
  { id: "story_director", name: "Story Director", tagline: "Narrative consequences and pacing", description: "Builds coherent storylines and complications from the validated game state." },
  { id: "red_team_risk_model", name: "Red-Team Game Director", tagline: "Red Team systems, progression and counterplay", description: "Designs Red Team factions, tools, shops, skills, missions, consequences and Blue Team counterplay as game systems." }
];
