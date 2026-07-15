import type { DeterministicRandom } from "../core/DeterministicRandom";
import type { SimulationClock } from "../core/SimulationClock";
import type { CommandEnvelope, CommandValidationResult } from "../commands/types";
import type { EventLog } from "../events/EventLog";
import type { StrategyWorld } from "../ecs/world";

export const SYSTEM_ORDER = [
  "commands",
  "local-strategy",
  "npc-routines",
  "tactical-intent",
  "blackmail",
  "path-intent",
  "movement",
  "collision-avoidance",
  "combat",
  "economy",
  "production-construction",
  "territory-visibility",
  "character-status",
  "morale-cleanup",
  "finalize",
] as const;

export type SystemId = (typeof SYSTEM_ORDER)[number];

export interface SimulationSystemContext {
  world: StrategyWorld;
  clock: SimulationClock;
  random: DeterministicRandom;
  events: EventLog;
  readyCommands: readonly CommandEnvelope[];
  submitCommand: (command: CommandEnvelope) => CommandValidationResult;
  nextCommandId: (prefix: string) => string;
}

export interface SimulationSystem {
  readonly id: SystemId;
  update(context: SimulationSystemContext): void;
}
