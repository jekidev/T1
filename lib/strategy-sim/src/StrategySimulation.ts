import { CommandQueue } from "./commands/CommandQueue";
import type { CommandEnvelope, CommandValidationResult } from "./commands/types";
import { DeterministicRandom } from "./core/DeterministicRandom";
import { SimulationClock, type SimulationClockState } from "./core/SimulationClock";
import { DeterministicIdFactory } from "./ecs/entityFactory";
import type { StrategyEntity } from "./ecs/components";
import { StrategyWorld } from "./ecs/world";
import { EventLog, type GameEvent } from "./events/EventLog";
import { CombatSystem } from "./systems/CombatSystem";
import { CommandSystem } from "./systems/CommandSystem";
import { EconomySystem } from "./systems/EconomySystem";
import { DisabledExtensionSystem, FinalizeSystem } from "./systems/ExtensionSystems";
import { LocalStrategySystem } from "./systems/LocalStrategySystem";
import { MoraleCleanupSystem } from "./systems/MoraleCleanupSystem";
import { MovementSystem } from "./systems/MovementSystem";
import { ProductionSystem } from "./systems/ProductionSystem";
import { TerritorySystem } from "./systems/TerritorySystem";
import { SYSTEM_ORDER, type SimulationSystem, type SimulationSystemContext, type SystemId } from "./systems/types";

export interface StrategySimulationOptions {
  seed?: number;
  tickRate?: number;
  localStrategyDecisionIntervalTicks?: number;
}

export interface StrategySimulationSnapshot {
  schemaVersion: 1;
  clock: SimulationClockState;
  scheduledTickAccumulator: number;
  randomState: number;
  idCounters: Record<string, number>;
  entities: StrategyEntity[];
  pendingCommands: CommandEnvelope[];
  submittedCommands: CommandEnvelope[];
  eventLog: {
    sequence: number;
    events: GameEvent[];
  };
}

export interface StrategySubsystemStatus {
  id: SystemId;
  enabled: boolean;
  reason?: string;
}

export class StrategySimulation {
  readonly world = new StrategyWorld();
  readonly clock: SimulationClock;
  readonly random: DeterministicRandom;
  readonly events = new EventLog();
  readonly ids = new DeterministicIdFactory();
  readonly commands = new CommandQueue();
  readonly submittedCommands: CommandEnvelope[] = [];
  readonly subsystemStatus: StrategySubsystemStatus[];

  private readonly systems: SimulationSystem[];
  private scheduledTickAccumulator = 0;

  constructor(options: StrategySimulationOptions = {}) {
    const localStrategyInterval = options.localStrategyDecisionIntervalTicks ?? 20;
    if (!Number.isInteger(localStrategyInterval) || localStrategyInterval < 1) {
      throw new Error("localStrategyDecisionIntervalTicks must be a positive integer.");
    }

    this.clock = new SimulationClock({ tickRate: options.tickRate ?? 20 });
    this.random = new DeterministicRandom(options.seed ?? 1);

    const tactical = new DisabledExtensionSystem("tactical-intent", "Mistreevous is deferred until Phase C.");
    const path = new DisabledExtensionSystem("path-intent", "Recast Navigation JS is deferred until Phase B.");
    const collision = new DisabledExtensionSystem("collision-avoidance", "Rapier strategy collision integration is deferred until the navigation contract exists.");

    this.systems = [
      new CommandSystem(),
      new LocalStrategySystem(localStrategyInterval),
      tactical,
      path,
      new MovementSystem(),
      collision,
      new CombatSystem(),
      new EconomySystem(),
      new ProductionSystem(),
      new TerritorySystem(),
      new MoraleCleanupSystem(),
      new FinalizeSystem(),
    ];

    const actualOrder = this.systems.map(system => system.id);
    if (actualOrder.length !== SYSTEM_ORDER.length || actualOrder.some((id, index) => id !== SYSTEM_ORDER[index])) {
      throw new Error(`Invalid system order: ${actualOrder.join(", ")}`);
    }

    this.subsystemStatus = this.systems.map(system => {
      if (system instanceof DisabledExtensionSystem) {
        return { id: system.id, enabled: false, reason: system.reason };
      }
      return { id: system.id, enabled: true };
    });
  }

  addEntity(entity: StrategyEntity): StrategyEntity {
    return this.world.add(structuredClone(entity));
  }

  removeEntity(id: string): boolean {
    return this.world.remove(id);
  }

  nextCommandId(prefix = "command"): string {
    return this.ids.next(prefix);
  }

  submitCommand(command: CommandEnvelope): CommandValidationResult {
    const result = this.commands.submit(command);
    if (result.accepted) this.submittedCommands.push(structuredClone(result.command));
    return result;
  }

  setPaused(paused: boolean): void {
    this.clock.setPaused(paused);
  }

  setSpeedMultiplier(multiplier: number): void {
    this.clock.setSpeedMultiplier(multiplier);
  }

  runScheduledFrame(): number {
    if (this.clock.paused) return 0;
    this.scheduledTickAccumulator += this.clock.speedMultiplier;
    const ticks = Math.floor(this.scheduledTickAccumulator);
    this.scheduledTickAccumulator -= ticks;
    if (ticks > 0) this.step(ticks);
    return ticks;
  }

  step(count = 1): void {
    if (!Number.isInteger(count) || count < 1) throw new Error("step count must be a positive integer.");
    for (let iteration = 0; iteration < count; iteration += 1) {
      this.clock.advanceOneTick();
      const readyCommands = this.commands.drainReady(this.clock.tick);
      const context: SimulationSystemContext = {
        world: this.world,
        clock: this.clock,
        random: this.random,
        events: this.events,
        readyCommands,
        submitCommand: command => this.submitCommand(command),
        nextCommandId: prefix => this.nextCommandId(prefix),
      };
      for (const system of this.systems) system.update(context);
    }
  }

  exportSnapshot(): StrategySimulationSnapshot {
    return {
      schemaVersion: 1,
      clock: this.clock.exportState(),
      scheduledTickAccumulator: this.scheduledTickAccumulator,
      randomState: this.random.exportState(),
      idCounters: this.ids.exportState(),
      entities: this.world.allSorted().map(entity => structuredClone(entity)),
      pendingCommands: this.commands.exportPending(),
      submittedCommands: this.submittedCommands.map(command => structuredClone(command)),
      eventLog: this.events.exportState(),
    };
  }

  importSnapshot(snapshot: StrategySimulationSnapshot): void {
    if (snapshot.schemaVersion !== 1) throw new Error(`Unsupported strategy snapshot version: ${snapshot.schemaVersion}`);
    this.world.clear();
    for (const entity of snapshot.entities) this.world.add(structuredClone(entity));
    this.clock.importState(snapshot.clock);
    this.scheduledTickAccumulator = snapshot.scheduledTickAccumulator;
    this.random.importState(snapshot.randomState);
    this.ids.importState(snapshot.idCounters);
    this.commands.importPending(snapshot.pendingCommands);
    this.submittedCommands.length = 0;
    this.submittedCommands.push(...snapshot.submittedCommands.map(command => structuredClone(command)));
    this.events.importState(snapshot.eventLog);
  }

  canonicalSnapshot(): string {
    return canonicalStringify(this.exportSnapshot());
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) result[key] = canonicalize(entry);
    }
    return result;
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
