import { z } from "zod";

export const Vector3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

const MoveUnitsCommandSchema = z.object({
  type: z.literal("move_units"),
  entityIds: z.array(z.string().min(1)).min(1).max(500),
  target: Vector3Schema,
});

const AttackTargetCommandSchema = z.object({
  type: z.literal("attack_target"),
  entityIds: z.array(z.string().min(1)).min(1).max(500),
  targetEntityId: z.string().min(1),
});

const ClaimTerritoryCommandSchema = z.object({
  type: z.literal("claim_territory"),
  entityIds: z.array(z.string().min(1)).min(1).max(500),
  territoryId: z.string().min(1),
});

const SetEconomyRatesCommandSchema = z.object({
  type: z.literal("set_economy_rates"),
  productionPerTick: z.record(z.number().finite().min(0).max(1_000_000)),
  consumptionPerTick: z.record(z.number().finite().min(0).max(1_000_000)),
});

const GatherBlackmailEvidenceCommandSchema = z.object({
  type: z.literal("gather_blackmail_evidence"),
  targetFactionId: z.string().min(1).max(120),
});

const ExecuteBlackmailCommandSchema = z.object({
  type: z.literal("execute_blackmail"),
  targetFactionId: z.string().min(1).max(120),
  approach: z.enum(["fear", "greed", "isolation"]),
});

const WaitCommandSchema = z.object({
  type: z.literal("wait"),
});

export const StrategyCommandSchema = z.discriminatedUnion("type", [
  MoveUnitsCommandSchema,
  AttackTargetCommandSchema,
  ClaimTerritoryCommandSchema,
  SetEconomyRatesCommandSchema,
  GatherBlackmailEvidenceCommandSchema,
  ExecuteBlackmailCommandSchema,
  WaitCommandSchema,
]);

export const CommandEnvelopeSchema = z.object({
  id: z.string().min(1).max(120),
  submittedTick: z.number().int().min(0),
  actorFactionId: z.string().min(1).max(120),
  command: StrategyCommandSchema,
});

export type StrategyCommand = z.infer<typeof StrategyCommandSchema>;
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;

export interface CommandValidationSuccess {
  accepted: true;
  command: CommandEnvelope;
}

export interface CommandValidationFailure {
  accepted: false;
  commandId: string;
  code:
    | "invalid_schema"
    | "future_command"
    | "unknown_faction"
    | "unknown_entity"
    | "permission_denied"
    | "invalid_target"
    | "insufficient_resources"
    | "insufficient_evidence"
    | "cooldown_active"
    | "feature_unavailable";
  reason: string;
}

export type CommandValidationResult = CommandValidationSuccess | CommandValidationFailure;
