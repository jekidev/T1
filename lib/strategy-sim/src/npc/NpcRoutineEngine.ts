import { NPCScheduleEntrySchema, type NPCComponent, type NPCRoutineDecision } from "./types";

export interface NPCRoutineContext {
  tick: number;
  ticksPerGameMinute: number;
  dayLengthMinutes?: number;
}

export function decideNpcRoutine(npcId: string, npc: NPCComponent, context: NPCRoutineContext): NPCRoutineDecision {
  if (!npcId.trim()) throw new Error("npcId is required.");
  if (!Number.isInteger(context.tick) || context.tick < 0) throw new Error("tick must be a non-negative integer.");
  if (!Number.isFinite(context.ticksPerGameMinute) || context.ticksPerGameMinute <= 0) {
    throw new Error("ticksPerGameMinute must be positive.");
  }

  const allowedActions = new Set(npc.role.allowedActions);
  const needDecision = decideNeedOverride(npcId, npc, allowedActions);
  if (needDecision) return needDecision;

  const dayLength = context.dayLengthMinutes ?? 1440;
  const minute = Math.floor(context.tick / context.ticksPerGameMinute) % dayLength;
  const entries = npc.schedule
    .map(entry => NPCScheduleEntrySchema.parse(entry))
    .filter(entry => minute >= entry.startMinute && minute < entry.endMinute)
    .sort((a, b) => b.priority - a.priority || a.startMinute - b.startMinute || a.id.localeCompare(b.id));

  const scheduled = entries.find(entry => allowedActions.has(entry.action));
  if (scheduled) {
    return {
      npcId,
      action: scheduled.action,
      ...(scheduled.locationId ? { locationId: scheduled.locationId } : {}),
      scheduleEntryId: scheduled.id,
      source: "schedule",
      reason: `Scheduled action at minute ${minute}.`,
    };
  }

  const fallback = allowedActions.has("idle") ? "idle" : [...allowedActions].sort()[0];
  if (!fallback) throw new Error(`NPC ${npcId} has no allowed actions.`);
  return {
    npcId,
    action: fallback,
    source: "fallback",
    reason: entries.length > 0
      ? "Active schedule entries were not permitted by the role allowlist."
      : `No schedule entry is active at minute ${minute}.`,
  };
}

export function applyRoutineDecision(npc: NPCComponent, decision: NPCRoutineDecision): NPCComponent {
  if (!npc.role.allowedActions.includes(decision.action)) {
    throw new Error(`Action ${decision.action} is not allowed for role ${npc.role.id}.`);
  }
  return {
    ...structuredClone(npc),
    currentAction: decision.action,
    ...(decision.locationId ? { currentLocationId: decision.locationId } : {}),
    ...(decision.scheduleEntryId ? { activeScheduleEntryId: decision.scheduleEntryId } : { activeScheduleEntryId: undefined }),
  };
}

function decideNeedOverride(
  npcId: string,
  npc: NPCComponent,
  allowedActions: ReadonlySet<string>,
): NPCRoutineDecision | undefined {
  const candidates = [
    { need: npc.needs.safety, threshold: 80, action: "seek_safety", reason: "Safety need exceeded threshold." },
    { need: npc.needs.fatigue, threshold: 85, action: "rest", reason: "Fatigue exceeded threshold." },
    { need: npc.needs.hunger, threshold: 85, action: "eat", reason: "Hunger exceeded threshold." },
    { need: npc.needs.social, threshold: 90, action: "socialize", reason: "Social need exceeded threshold." },
  ].filter(candidate => candidate.need >= candidate.threshold && allowedActions.has(candidate.action));

  candidates.sort((a, b) => (b.need - b.threshold) - (a.need - a.threshold) || a.action.localeCompare(b.action));
  const selected = candidates[0];
  if (!selected) return undefined;
  return {
    npcId,
    action: selected.action,
    source: "need",
    reason: selected.reason,
  };
}
