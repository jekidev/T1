export type SyndicateRoleKind =
  | "leader"
  | "underboss"
  | "advisor"
  | "captain"
  | "operator"
  | "associate"
  | "business_manager"
  | "driver"
  | "security"
  | "negotiator"
  | "accountant"
  | "informant";

export type BusinessCategory =
  | "retail"
  | "transport"
  | "security"
  | "entertainment"
  | "construction"
  | "logistics"
  | "hospitality"
  | "technology"
  | "real_estate"
  | "media";

export type RelationshipStatus = "neutral" | "cooperative" | "allied" | "rival" | "hostile";
export type VisibilityState = "unknown" | "rumored" | "observed" | "mapped" | "controlled";
export type SyndicateStrategy =
  | "economic_expansion"
  | "territorial_consolidation"
  | "recruitment"
  | "diplomacy"
  | "public_legitimacy"
  | "intelligence_gathering"
  | "internal_stability"
  | "defensive_preparation";

export interface GeoJsonGeometry {
  type: "Polygon" | "MultiPolygon" | "Point" | "LineString";
  coordinates: unknown;
}

export interface SyndicateRole {
  id: string;
  kind: SyndicateRoleKind;
  title: string;
  responsibilities: string[];
  workAreas: string[];
  permissions: string[];
  upkeep: number;
  loyaltyRequirement: number;
  heartRequirement: number;
  competenceRequirement: number;
  influence: number;
  accessLevel: number;
  factionRelationshipModifiers: Record<string, number>;
  successionPriority: number;
}

export interface PowerProfile {
  territorialControl: number;
  economicPower: number;
  politicalInfluence: number;
  socialInfluence: number;
  intelligenceCapacity: number;
  organizationalStability: number;
  publicLegitimacy: number;
  fear: number;
}

export interface SyndicateResources {
  capital: number;
  supplies: number;
  workforce: number;
  intelligence: number;
  influence: number;
}

export interface Grievance {
  id: string;
  type: "treatment" | "payment" | "broken_promise" | "loss" | "blocked_promotion" | "relationship" | "values";
  severity: number;
  createdAtTick: number;
  resolvedAtTick?: number;
  description: string;
}

export interface FactionAgreement {
  id: string;
  type: "trade" | "non_aggression" | "territory_access" | "information" | "mutual_support";
  parties: string[];
  startsAtTick: number;
  expiresAtTick?: number;
  trustRequired: number;
  obligations: string[];
}

export interface FactionRelationship {
  trust: number;
  respect: number;
  fear: number;
  hostility: number;
  dependency: number;
  status: RelationshipStatus;
  activeAgreements: FactionAgreement[];
  grievances: Grievance[];
}

export interface SyndicateMembership {
  npcId: string;
  syndicateId: string;
  roleId: string;
  loyalty: number;
  ambition: number;
  fear: number;
  trust: number;
  satisfaction: number;
  ideologicalAlignment: number;
  heart: number;
  competence: number;
  joinedAtTick: number;
  salary: number;
  sharedHistory: number;
  promotionOpportunity: number;
  grievances: Grievance[];
}

export interface Syndicate {
  id: string;
  name: string;
  leaderNpcId: string;
  hierarchy: SyndicateRole[];
  memberIds: string[];
  controlledTerritoryIds: string[];
  businessIds: string[];
  resources: SyndicateResources;
  reputation: Record<string, number>;
  relationships: Record<string, FactionRelationship>;
  power: PowerProfile;
  influence: number;
  legitimacy: number;
  internalLoyalty: number;
  publicPressure: number;
  activeStrategy: SyndicateStrategy;
  strategySinceTick: number;
  successionCandidates: string[];
  sourceCaseIds: string[];
}

export interface Territory {
  id: string;
  name: string;
  ownerFactionId?: string;
  bounds: GeoJsonGeometry;
  influenceByFaction: Record<string, number>;
  population: number;
  prosperity: number;
  stability: number;
  visibility: VisibilityState;
  locationIds: string[];
  resourceModifiers: Record<keyof SyndicateResources, number>;
  loyaltyByFaction: Record<string, number>;
  eventPressure: number;
  lastChangedAtTick: number;
}

export interface SyndicateBusiness {
  id: string;
  name: string;
  category: BusinessCategory;
  ownerSyndicateId: string;
  territoryId: string;
  managerNpcId?: string;
  level: number;
  workforceRequired: number;
  capitalUpkeep: number;
  productionPerTick: Partial<SyndicateResources>;
  legitimacyEffect: number;
  visibilityEffect: number;
  stabilityEffect: number;
  enabled: boolean;
}

export interface SyndicateEvent {
  id: string;
  tick: number;
  type:
    | "created"
    | "member_recruited"
    | "role_changed"
    | "territory_influenced"
    | "territory_changed_owner"
    | "business_created"
    | "resources_produced"
    | "loyalty_crisis"
    | "succession_started"
    | "succession_resolved"
    | "faction_split"
    | "defection"
    | "agreement_changed"
    | "strategy_changed"
    | "world_updated";
  factionIds: string[];
  territoryId?: string;
  npcIds: string[];
  summary: string;
  deterministicKey: string;
}

export interface SyndicateSourceCase {
  id: string;
  title: string;
  institution: string;
  jurisdiction: string;
  year?: number;
  sourceUrl?: string;
  verified: boolean;
  patternTags: string[];
  fictionalizationRule: string;
}

export interface MissionRule {
  id: string;
  trigger: "tick" | "territory_owner" | "resource_threshold" | "loyalty_threshold" | "relationship_status";
  conditions: Record<string, string | number | boolean>;
  commandTemplates: string[];
  once: boolean;
  firedAtTick?: number;
}

export interface SyndicateWorldState {
  version: number;
  seed: number;
  tick: number;
  syndicates: Syndicate[];
  memberships: SyndicateMembership[];
  territories: Territory[];
  businesses: SyndicateBusiness[];
  events: SyndicateEvent[];
  missionRules: MissionRule[];
  sourceCases: SyndicateSourceCase[];
  ragRevision: string;
  updatedAtTick: number;
}

export interface StrategyEvaluation {
  strategy: SyndicateStrategy;
  utility: number;
  reasons: string[];
}
