import {
  StrategySimulation,
  createFactionEntity,
  createUnitEntity,
  type BlackmailApproach,
  type BlackmailTargetView,
  type CommandValidationResult,
  type GameEvent,
} from "@workspace/strategy-sim";
import { nanoid } from "nanoid";
import type { BoardState, Faction, TimelineEvent, TimelineEventSeverity } from "../game/types";

export const STRATEGY_TICKS_PER_BOARD_TURN = 20;

export type BoardBlackmailAction =
  | { type: "gather"; actorFactionId: string; targetFactionId: string }
  | { type: "execute"; actorFactionId: string; targetFactionId: string; approach: BlackmailApproach };

export interface BoardBlackmailResult {
  board: BoardState;
  accepted: boolean;
  message: string;
  commandId?: string;
}

export function getBoardBlackmailTargets(board: BoardState, actorFactionId: string): BlackmailTargetView[] {
  if (!board.simulation || !actorFactionId) return [];
  const simulation = hydrateBoardStrategy(board);
  return simulation.blackmail.getTargets(actorFactionId);
}

export function runBoardBlackmailAction(board: BoardState, action: BoardBlackmailAction): BoardBlackmailResult {
  if (!board.simulation) {
    return { board, accepted: false, message: "Simulation state is not initialized." };
  }

  const simulation = hydrateBoardStrategy(board);
  const beforeEventCount = simulation.events.all().length;
  const submission = action.type === "gather"
    ? simulation.blackmail.gatherEvidence(action.actorFactionId, action.targetFactionId)
    : simulation.blackmail.executeBlackmail(
        action.actorFactionId,
        action.targetFactionId,
        action.approach,
      );

  if (!submission.accepted) {
    return {
      board,
      accepted: false,
      message: submission.reason,
      commandId: submission.commandId,
    };
  }

  simulation.step(1);
  const newEvents = simulation.events.all().slice(beforeEventCount);
  const commandEvent = newEvents.find(event =>
    (event.type === "command.executed" || event.type === "command.rejected")
      && readString(event.payload, "commandId") === submission.command.id,
  );
  const outcome = [...newEvents].reverse().find(event =>
    event.type === "blackmail.resolved" || event.type === "blackmail.evidence_gathered",
  );
  const accepted = commandEvent?.type === "command.executed";
  const updatedBoard = applyStrategyStateToBoard(board, simulation, newEvents);

  return {
    board: updatedBoard,
    accepted,
    commandId: submission.command.id,
    message: describeEvent(outcome ?? commandEvent, simulation) ?? (accepted ? "In-game blackmail action resolved." : "In-game blackmail action was rejected."),
  };
}

export function advanceBoardStrategy(board: BoardState, ticks = STRATEGY_TICKS_PER_BOARD_TURN): BoardState {
  if (!board.simulation || ticks < 1) return board;
  const simulation = hydrateBoardStrategy(board);
  const beforeEventCount = simulation.events.all().length;
  simulation.step(ticks);
  const visibleEvents = simulation.events.all().slice(beforeEventCount).filter(isBoardVisibleEvent);
  return applyStrategyStateToBoard(board, simulation, visibleEvents);
}

function hydrateBoardStrategy(board: BoardState): StrategySimulation {
  const simulation = new StrategySimulation({ seed: board.simulation?.seed ?? 1, tickRate: 20 });
  if (board.strategySnapshot) {
    try {
      simulation.importSnapshot(board.strategySnapshot);
      return simulation;
    } catch {
      // Fall through to a deterministic migration from the current BoardState.
    }
  }

  const factions = [...(board.simulation?.factions ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  for (const faction of factions) {
    const entity = createFactionEntity({
      id: faction.id,
      name: faction.name,
      tick: 0,
      treasury: faction.treasury,
      resources: {
        credits: Math.max(0, Math.round(faction.treasury / 100)),
        supplies: Math.max(0, faction.personnel * 5),
      },
      productionPerTick: { credits: Math.max(1, Math.round(faction.personnel / 5)), supplies: 1 },
      consumptionPerTick: { credits: 1, supplies: Math.max(0, Math.round(faction.personnel / 20)) },
      reputation: clamp(faction.legitimacy, 0, 100),
      operationalSecurity: clamp(55 + faction.intelligence * 0.35 - faction.suspicion * 0.25, 0, 100),
      suspicion: clamp(faction.suspicion, 0, 100),
      blackmailResistance: clamp(faction.cohesion, 0, 100),
    });
    entity.factionState!.relations = { ...faction.relationships };
    simulation.addEntity(entity);
  }

  const factionsByType = new Map<Faction, string[]>();
  for (const faction of factions) {
    const ids = factionsByType.get(faction.faction) ?? [];
    ids.push(faction.id);
    factionsByType.set(faction.faction, ids);
  }

  const typeCounters = new Map<Faction, number>();
  for (const entity of [...board.entities].filter(item => item.category === "unit").sort((a, b) => a.id.localeCompare(b.id))) {
    const factionIds = factionsByType.get(entity.faction) ?? [];
    if (factionIds.length === 0) continue;
    const index = typeCounters.get(entity.faction) ?? 0;
    typeCounters.set(entity.faction, index + 1);
    const factionId = factionIds[index % factionIds.length]!;
    const strategyUnit = createUnitEntity({
      id: boardUnitId(entity.id),
      factionId,
      tick: 0,
      position: {
        x: (entity.x - 500) / 20,
        y: 0,
        z: (entity.y - 500) / 20,
      },
      unitType: entity.templateId,
      movementSpeed: Math.max(0.5, entity.attributes.mobility / 20),
      visionRange: Math.max(1, entity.attributes.visibility / 4),
      health: clamp(entity.attributes.readiness, 1, 100),
      damage: Math.max(1, entity.attributes.readiness / 10),
      morale: clamp(entity.attributes.morale, 0, 100),
    });
    simulation.addEntity(strategyUnit);
  }

  return simulation;
}

function applyStrategyStateToBoard(
  board: BoardState,
  strategy: StrategySimulation,
  events: readonly GameEvent[],
): BoardState {
  const entityMap = new Map(strategy.exportSnapshot().entities.map(entity => [entity.identity.id, entity]));
  const simulation = board.simulation
    ? {
        ...board.simulation,
        factions: board.simulation.factions.map(faction => {
          const strategyFaction = entityMap.get(faction.id);
          if (!strategyFaction?.factionState || !strategyFaction.influence) return faction;
          return {
            ...faction,
            treasury: Math.max(0, Math.round(strategyFaction.factionState.treasury)),
            legitimacy: Math.round(strategyFaction.influence.reputation),
            suspicion: Math.round(strategyFaction.influence.suspicion),
            relationships: { ...strategyFaction.factionState.relations },
          };
        }),
      }
    : undefined;

  const entities = board.entities.map(entity => {
    const strategyUnit = entityMap.get(boardUnitId(entity.id));
    if (!strategyUnit?.health) return entity;
    const healthRatio = strategyUnit.health.maximum > 0
      ? strategyUnit.health.current / strategyUnit.health.maximum
      : 0;
    return {
      ...entity,
      attributes: {
        ...entity.attributes,
        readiness: Math.round(clamp(healthRatio * 100, 0, 100)),
        morale: Math.round(clamp(strategyUnit.morale?.current ?? entity.attributes.morale, 0, 100)),
      },
    };
  });

  const timelineEvents = [
    ...board.timelineEvents,
    ...events.map(event => toTimelineEvent(event, strategy, board.currentPhaseId)).filter((event): event is TimelineEvent => Boolean(event)),
  ];

  return {
    ...board,
    simulation,
    entities,
    strategySnapshot: strategy.exportSnapshot(),
    timelineEvents,
  };
}

function toTimelineEvent(
  event: GameEvent,
  strategy: StrategySimulation,
  phaseId: string | null,
): TimelineEvent | null {
  const description = describeEvent(event, strategy);
  if (!description) return null;
  const severity: TimelineEventSeverity = event.type === "command.rejected"
    ? "caution"
    : event.type === "blackmail.resolved" && !readBoolean(event.payload, "success")
      ? "caution"
      : "info";
  return {
    id: nanoid(10),
    phaseId,
    label: eventLabel(event),
    description,
    severity,
    createdAt: new Date().toISOString(),
    sourceStatus: "fictional",
  };
}

function describeEvent(event: GameEvent | undefined, strategy: StrategySimulation): string | null {
  if (!event) return null;
  const actorName = factionName(strategy, event.actorId);
  const targetId = readString(event.payload, "targetFactionId");
  const targetName = factionName(strategy, targetId);

  if (event.type === "blackmail.evidence_gathered") {
    const quality = readNumber(event.payload, "evidenceQuality");
    const noticed = readBoolean(event.payload, "noticed");
    return `${actorName} gathered in-game leverage against ${targetName}. Evidence quality is ${Math.round(quality)}%${noticed ? "; the target noticed the attempt" : ""}.`;
  }
  if (event.type === "blackmail.resolved") {
    const success = readBoolean(event.payload, "success");
    const approach = readString(event.payload, "approach");
    return `${actorName}'s ${approach} blackmail action against ${targetName} ${success ? "succeeded" : "failed"}.`;
  }
  if (event.type === "command.rejected") {
    return `Strategy command rejected: ${readString(event.payload, "reason") || "rule validation failed"}.`;
  }
  if (event.type === "territory.captured") {
    return `${actorName} captured a strategy territory.`;
  }
  if (event.type === "entity.destroyed") {
    return `A strategy entity was removed after reaching zero health.`;
  }
  return null;
}

function eventLabel(event: GameEvent): string {
  if (event.type === "blackmail.evidence_gathered") return "Leverage evidence updated";
  if (event.type === "blackmail.resolved") return readBoolean(event.payload, "success") ? "Blackmail succeeded" : "Blackmail failed";
  if (event.type === "territory.captured") return "Territory captured";
  if (event.type === "entity.destroyed") return "Entity destroyed";
  return "Strategy command rejected";
}

function isBoardVisibleEvent(event: GameEvent): boolean {
  return event.type === "blackmail.evidence_gathered"
    || event.type === "blackmail.resolved"
    || event.type === "territory.captured"
    || event.type === "entity.destroyed"
    || event.type === "command.rejected";
}

function factionName(strategy: StrategySimulation, factionId: string | undefined): string {
  if (!factionId) return "Unknown faction";
  return strategy.world.get(factionId)?.factionState?.name ?? factionId;
}

function boardUnitId(id: string): string {
  return `board-unit:${id}`;
}

function readRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
}

function readString(payload: unknown, key: string): string {
  const value = readRecord(payload)[key];
  return typeof value === "string" ? value : "";
}

function readNumber(payload: unknown, key: string): number {
  const value = readRecord(payload)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readBoolean(payload: unknown, key: string): boolean {
  return readRecord(payload)[key] === true;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
