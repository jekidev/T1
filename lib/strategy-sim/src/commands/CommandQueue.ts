import type { StrategyWorld } from "../ecs/world";
import { CommandEnvelopeSchema, type CommandEnvelope, type CommandValidationResult } from "./types";

export class CommandQueue {
  private readonly pending: CommandEnvelope[] = [];

  submit(input: unknown): CommandValidationResult {
    const parsed = CommandEnvelopeSchema.safeParse(input);
    if (!parsed.success) {
      const commandId = typeof input === "object" && input !== null && "id" in input ? String((input as { id?: unknown }).id ?? "unknown") : "unknown";
      return {
        accepted: false,
        commandId,
        code: "invalid_schema",
        reason: parsed.error.issues.map(issue => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; "),
      };
    }

    if (this.pending.some(command => command.id === parsed.data.id)) {
      return {
        accepted: false,
        commandId: parsed.data.id,
        code: "invalid_schema",
        reason: `Duplicate command id: ${parsed.data.id}`,
      };
    }

    this.pending.push(parsed.data);
    this.pending.sort((a, b) => a.submittedTick - b.submittedTick || a.id.localeCompare(b.id));
    return { accepted: true, command: parsed.data };
  }

  drainReady(currentTick: number): CommandEnvelope[] {
    const ready: CommandEnvelope[] = [];
    while (this.pending.length > 0 && this.pending[0]!.submittedTick <= currentTick) {
      ready.push(this.pending.shift()!);
    }
    return ready;
  }

  exportPending(): CommandEnvelope[] {
    return this.pending.map(command => structuredClone(command));
  }

  importPending(commands: CommandEnvelope[]): void {
    this.pending.length = 0;
    for (const command of commands) this.pending.push(structuredClone(command));
    this.pending.sort((a, b) => a.submittedTick - b.submittedTick || a.id.localeCompare(b.id));
  }
}

export function validateCommandAuthority(
  world: StrategyWorld,
  command: CommandEnvelope,
  currentTick: number,
): CommandValidationResult {
  if (command.submittedTick > currentTick) {
    return { accepted: false, commandId: command.id, code: "future_command", reason: "Command is scheduled for a future tick." };
  }

  const factionEntity = world.get(command.actorFactionId);
  if (!factionEntity?.factionState) {
    return { accepted: false, commandId: command.id, code: "unknown_faction", reason: `Unknown faction: ${command.actorFactionId}` };
  }

  if (command.command.type === "set_economy_rates" || command.command.type === "wait") {
    return { accepted: true, command };
  }

  if (command.command.type === "gather_blackmail_evidence" || command.command.type === "execute_blackmail") {
    if (!factionEntity.influence || !factionEntity.blackmail) {
      return {
        accepted: false,
        commandId: command.id,
        code: "feature_unavailable",
        reason: `Faction ${command.actorFactionId} does not support the in-game blackmail subsystem.`,
      };
    }
    if (command.command.targetFactionId === command.actorFactionId) {
      return { accepted: false, commandId: command.id, code: "invalid_target", reason: "A faction cannot target itself." };
    }
    const target = world.get(command.command.targetFactionId);
    if (!target?.factionState) {
      return {
        accepted: false,
        commandId: command.id,
        code: "unknown_faction",
        reason: `Unknown target faction: ${command.command.targetFactionId}`,
      };
    }
    if (!target.influence || !target.blackmail) {
      return {
        accepted: false,
        commandId: command.id,
        code: "feature_unavailable",
        reason: `Target faction ${command.command.targetFactionId} does not support the in-game blackmail subsystem.`,
      };
    }
    return { accepted: true, command };
  }

  const entityIds = command.command.entityIds;
  for (const entityId of entityIds) {
    const entity = world.get(entityId);
    if (!entity) {
      return { accepted: false, commandId: command.id, code: "unknown_entity", reason: `Unknown entity: ${entityId}` };
    }
    if (entity.faction?.factionId !== command.actorFactionId) {
      return { accepted: false, commandId: command.id, code: "permission_denied", reason: `Faction ${command.actorFactionId} does not control ${entityId}.` };
    }
  }

  if (command.command.type === "attack_target") {
    const target = world.get(command.command.targetEntityId);
    if (!target?.health || !target.faction) {
      return { accepted: false, commandId: command.id, code: "invalid_target", reason: "Attack target must be a living faction entity." };
    }
    if (target.faction.factionId === command.actorFactionId) {
      return { accepted: false, commandId: command.id, code: "invalid_target", reason: "Friendly targets cannot be attacked." };
    }
  }

  if (command.command.type === "claim_territory") {
    const territory = world.get(command.command.territoryId);
    if (!territory?.territory || !territory.transform) {
      return { accepted: false, commandId: command.id, code: "invalid_target", reason: "Territory target does not exist." };
    }
  }

  return { accepted: true, command };
}
