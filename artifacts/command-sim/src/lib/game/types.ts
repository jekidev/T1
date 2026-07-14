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
  mobility: number; // 0-100 how fast/freely this entity can relocate
  visibility: number; // 0-100 how exposed/detectable this entity is
  intelligence: number; // 0-100 information-gathering capability
  influence: number; // 0-100 social/political/network leverage
  resources: number; // 0-100 available material/financial backing
  readiness: number; // 0-100 operational preparedness
  legalAuthority: number; // 0-100 lawful power to act (police-only concept, 0 for criminal)
  risk: number; // 0-100 exposure to danger or exposure/compromise
  morale: number; // 0-100 willingness/confidence to act
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
  templateId: string; // references EntityTemplate.id in the catalog
  category: EntityCategory;
  faction: Faction;
  label: string;
  x: number; // 0-1000 normalized board coordinate
  y: number; // 0-1000 normalized board coordinate
  rotation: number; // degrees
  scale: number; // 1 = default size
  zIndex: number;
  layerId: string;
  zoneId: string | null;
  groupId: string | null;
  locked: boolean;
  attributes: EntityAttributes;
  notes: string;
}

export type ZoneKind =
  | "jurisdiction"
  | "risk"
  | "visibility"
  | "operational"
  | "custom";

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
  createdAt: string; // ISO timestamp
}

export interface MoveLogEntry {
  id: string;
  summary: string;
  actorFaction: Faction | null;
  createdAt: string; // ISO timestamp
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
}

export function createEmptyBoard(mapTemplateId: string): BoardState {
  const defaultLayerId = "layer-default";
  const planningPhaseId = "phase-planning";
  return {
    version: 1,
    mapTemplateId,
    zones: [],
    entities: [],
    layers: [
      { id: defaultLayerId, name: "Ground", visible: true, locked: false, order: 0 },
    ],
    phases: [
      {
        id: planningPhaseId,
        name: "Planning",
        description: "Initial scenario setup and force disposition.",
        order: 0,
      },
    ],
    currentPhaseId: planningPhaseId,
    timelineEvents: [],
    moveHistory: [],
    notes: "",
  };
}

// ---- Explainable scoring ----

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
  contribution: number; // signed delta applied to the base score
  detail: string;
}

export interface ScoreResult {
  key: ScoreKey;
  label: string;
  value: number; // 0-100 clamped
  summary: string;
  factors: ScoreFactor[];
}

// ---- AI advisor ----

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
  {
    id: "neutral_analyst",
    name: "Neutral Analyst",
    tagline: "Balanced, data-driven read of the board",
    description:
      "Weighs both sides objectively and explains what the current board state implies for risk, coverage, and likely outcomes.",
  },
  {
    id: "police_commander",
    name: "Police Incident Commander",
    tagline: "Operational lead for the Blue Team",
    description:
      "Advises on lawful tactical deployment, resource allocation, jurisdiction, and public-safety tradeoffs from a command perspective.",
  },
  {
    id: "investigator",
    name: "Investigator",
    tagline: "Evidence and case-building focus",
    description:
      "Focuses on evidence quality, chain of custody, witness reliability, and how to strengthen the case against the network.",
  },
  {
    id: "legal_reviewer",
    name: "Legal / Ethics Reviewer",
    tagline: "Oversight and legitimacy check",
    description:
      "Flags legal authority gaps, proportionality concerns, civil-rights exposure, and legitimacy risks in the current plan.",
  },
  {
    id: "story_director",
    name: "Story Director",
    tagline: "Narrative consequences and pacing",
    description:
      "Narrates how the scenario is unfolding, surfaces dramatic stakes, and proposes narrative complications consistent with the board.",
  },
  {
    id: "red_team_risk_model",
    name: "Red-Team Risk Model",
    tagline: "Abstract adversarial vulnerability check",
    description:
      "Identifies vulnerabilities and plausible adversarial reactions in the abstract, for defensive planning only. Never provides real-world evasion, concealment, trafficking, or violence instructions.",
  },
];
