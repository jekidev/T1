import type { BlackmailApproach } from "../blackmail/config";
import type { NPCComponent } from "../npc/types";
import type { CharacterStatus } from "../status/CharacterStatus";

export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}

export type StrategyEntityKind = "faction" | "unit" | "territory" | "resource" | "building" | "effect";

export interface IdentityComponent {
  id: string;
  kind: StrategyEntityKind;
  createdTick: number;
}

export interface TransformComponent {
  position: Vector3Data;
  previousPosition: Vector3Data;
  rotationY: number;
}

export interface FactionComponent {
  factionId: string;
}

export interface FactionStateComponent {
  name: string;
  treasury: number;
  resources: Record<string, number>;
  productionPerTick: Record<string, number>;
  consumptionPerTick: Record<string, number>;
  relations: Record<string, number>;
}

export interface InfluenceComponent {
  reputation: number;
  operationalSecurity: number;
  suspicion: number;
  points: number;
}

export interface BlackmailDossier {
  evidenceQuality: number;
  cooldownTicks: number;
  compromised: boolean;
  lastAttemptTick?: number;
}

export interface PendingBlackmailAction {
  commandId: string;
  type: "gather" | "execute";
  targetFactionId: string;
  approach?: BlackmailApproach;
}

export interface BlackmailComponent {
  resistance: number;
  dossiers: Record<string, BlackmailDossier>;
  compromisedBy: Record<string, boolean>;
  pendingActions: PendingBlackmailAction[];
  intimidatedUntilTick?: number;
  isolatedUntilTick?: number;
}

export interface UnitComponent {
  unitType: string;
  movementSpeed: number;
  visionRange: number;
  captureStrength: number;
}

export interface VisibilityComponent {
  hidden: boolean;
  detectableByAdjacentUnits: boolean;
  providesVision: boolean;
  visionRange?: number;
  rememberWhenExplored: boolean;
}

export interface HealthComponent {
  current: number;
  maximum: number;
}

export interface MovementComponent {
  target?: Vector3Data;
  speed: number;
  status: "idle" | "moving" | "blocked" | "arrived";
  commandId?: string;
}

export interface CombatComponent {
  damage: number;
  range: number;
  cooldownTicks: number;
  cooldownRemaining: number;
  targetId?: string;
}

export interface MoraleComponent {
  current: number;
  maximum: number;
  retreatThreshold: number;
}

export interface TerritoryComponent {
  name: string;
  radius: number;
  ownerFactionId?: string;
  captureProgress: Record<string, number>;
  captureRequired: number;
}

export interface ResourceNodeComponent {
  resourceType: string;
  amount: number;
  extractionPerTick: number;
  ownerFactionId?: string;
}

export interface BuildingComponent {
  buildingType: string;
  constructionProgress: number;
  operational: boolean;
}

export interface AIComponent {
  policyId: string;
  enabled: boolean;
  strategicObjective?: string;
}

export interface StrategyEntity {
  identity: IdentityComponent;
  transform?: TransformComponent;
  faction?: FactionComponent;
  factionState?: FactionStateComponent;
  influence?: InfluenceComponent;
  blackmail?: BlackmailComponent;
  unit?: UnitComponent;
  visibility?: VisibilityComponent;
  health?: HealthComponent;
  characterStatus?: CharacterStatus;
  npc?: NPCComponent;
  movement?: MovementComponent;
  combat?: CombatComponent;
  morale?: MoraleComponent;
  territory?: TerritoryComponent;
  resourceNode?: ResourceNodeComponent;
  building?: BuildingComponent;
  ai?: AIComponent;
}

export function cloneVector(value: Vector3Data): Vector3Data {
  return { x: value.x, y: value.y, z: value.z };
}

export function distanceSquared(a: Vector3Data, b: Vector3Data): number {
  const x = a.x - b.x;
  const y = a.y - b.y;
  const z = a.z - b.z;
  return x * x + y * y + z * z;
}
