import type { BlackmailDossier, StrategyEntity } from "../ecs/components";
import type { SimulationSystem, SimulationSystemContext } from "../systems/types";
import { resolveBlackmailConfig, type BlackmailApproach, type BlackmailConfig } from "./config";

export class BlackmailSystem implements SimulationSystem {
  readonly id = "blackmail" as const;
  readonly config: BlackmailConfig;

  constructor(config: Partial<BlackmailConfig> = {}) {
    this.config = resolveBlackmailConfig(config);
  }

  update(context: SimulationSystemContext): void {
    this.updateCooldowns(context);

    const factions = [...context.world.queries.blackmailFactions]
      .sort((a, b) => a.identity.id.localeCompare(b.identity.id));

    for (const actor of factions) {
      const actions = actor.blackmail.pendingActions
        .splice(0)
        .sort((a, b) => a.commandId.localeCompare(b.commandId));

      for (const action of actions) {
        const target = context.world.get(action.targetFactionId);
        if (!target?.factionState || !target.influence || !target.blackmail) {
          this.reject(context, actor.identity.id, action.commandId, "invalid_target", "Target faction is not available.");
          continue;
        }

        if (action.type === "gather") {
          this.gatherEvidence(context, actor, target, action.commandId);
          continue;
        }

        if (!action.approach) {
          this.reject(context, actor.identity.id, action.commandId, "invalid_schema", "Blackmail approach is missing.");
          continue;
        }
        this.execute(context, actor, target, action.commandId, action.approach);
      }
    }
  }

  private updateCooldowns(context: SimulationSystemContext): void {
    for (const faction of context.world.queries.blackmailFactions) {
      for (const dossier of Object.values(faction.blackmail.dossiers)) {
        dossier.cooldownTicks = Math.max(0, dossier.cooldownTicks - 1);
      }
      if ((faction.blackmail.intimidatedUntilTick ?? 0) <= context.clock.tick) {
        faction.blackmail.intimidatedUntilTick = undefined;
      }
      if ((faction.blackmail.isolatedUntilTick ?? 0) <= context.clock.tick) {
        faction.blackmail.isolatedUntilTick = undefined;
      }
    }
  }

  private gatherEvidence(
    context: SimulationSystemContext,
    actor: StrategyEntity & Required<Pick<StrategyEntity, "factionState" | "influence" | "blackmail">>,
    target: StrategyEntity & Required<Pick<StrategyEntity, "factionState" | "influence" | "blackmail">>,
    commandId: string,
  ): void {
    const dossier = this.getDossier(actor, target.identity.id);
    if (dossier.cooldownTicks > 0) {
      this.reject(context, actor.identity.id, commandId, "cooldown_active", `Target is on cooldown for ${dossier.cooldownTicks} ticks.`);
      return;
    }
    if (actor.influence.reputation < this.config.evidenceGatherCost) {
      this.reject(context, actor.identity.id, commandId, "insufficient_resources", "Not enough in-game reputation to gather evidence.");
      return;
    }

    actor.influence.reputation = clampPercent(actor.influence.reputation - this.config.evidenceGatherCost);
    const successRate = clamp(0.4 + (1 - target.influence.operationalSecurity / 100) * 0.4, 0.05, 0.95);
    const success = context.random.next() < successRate;
    const evidenceGain = success
      ? 30 + context.random.next() * 50
      : context.random.next() * 15;
    const opsecLoss = context.random.next() * 15;
    const noticed = context.random.next() < this.config.noticeChance;

    actor.influence.operationalSecurity = clampPercent(actor.influence.operationalSecurity - opsecLoss);
    dossier.evidenceQuality = clamp(
      dossier.evidenceQuality + evidenceGain,
      0,
      this.config.evidenceMaxQuality,
    );
    dossier.lastAttemptTick = context.clock.tick;

    if (noticed) {
      target.influence.suspicion = clampPercent(target.influence.suspicion + 10);
      target.influence.operationalSecurity = clampPercent(target.influence.operationalSecurity - 5);
    }

    context.events.append({
      tick: context.clock.tick,
      tickDurationMs: context.clock.tickDurationMs,
      type: "blackmail.evidence_gathered",
      actorId: actor.identity.id,
      payload: {
        commandId,
        targetFactionId: target.identity.id,
        success,
        successRate: round(successRate),
        evidenceGain: round(evidenceGain),
        evidenceQuality: round(dossier.evidenceQuality),
        noticed,
        opsecLoss: round(opsecLoss),
      },
    });
    this.executed(context, actor.identity.id, commandId, "gather_blackmail_evidence");
  }

  private execute(
    context: SimulationSystemContext,
    actor: StrategyEntity & Required<Pick<StrategyEntity, "factionState" | "influence" | "blackmail">>,
    target: StrategyEntity & Required<Pick<StrategyEntity, "factionState" | "influence" | "blackmail">>,
    commandId: string,
    approach: BlackmailApproach,
  ): void {
    const dossier = this.getDossier(actor, target.identity.id);
    if (dossier.cooldownTicks > 0) {
      this.reject(context, actor.identity.id, commandId, "cooldown_active", `Target is on cooldown for ${dossier.cooldownTicks} ticks.`);
      return;
    }
    if (dossier.evidenceQuality < this.config.evidenceMinQuality) {
      this.reject(
        context,
        actor.identity.id,
        commandId,
        "insufficient_evidence",
        `At least ${this.config.evidenceMinQuality}% evidence quality is required.`,
      );
      return;
    }

    const evidenceQuality = dossier.evidenceQuality;
    const successRate = clamp(
      this.baseSuccess(approach)
        + evidenceQuality / 200
        - target.blackmail.resistance / 200
        - target.influence.operationalSecurity / 200,
      0.1,
      0.95,
    );
    const success = context.random.next() < successRate;

    const actionReputationCost = this.config.reputationLossOnSuccess + evidenceQuality / 30;
    actor.influence.reputation = clampPercent(actor.influence.reputation - actionReputationCost);
    actor.influence.operationalSecurity = clampPercent(
      actor.influence.operationalSecurity - this.config.opsecLossOnAction,
    );
    dossier.cooldownTicks = this.config.cooldownTicks;
    dossier.evidenceQuality = 0;
    dossier.lastAttemptTick = context.clock.tick;

    let effect: Record<string, unknown> = {};
    if (success) {
      dossier.compromised = true;
      target.blackmail.compromisedBy[actor.identity.id] = true;
      effect = this.applySuccessEffect(context, actor, target, approach);
    } else {
      dossier.compromised = false;
      actor.influence.suspicion = clampPercent(
        actor.influence.suspicion + this.config.suspicionIncreaseOnFail,
      );
      actor.influence.reputation = clampPercent(
        actor.influence.reputation - this.config.reputationLossOnFail,
      );
      target.factionState.relations[actor.identity.id] = clampRelation(
        (target.factionState.relations[actor.identity.id] ?? 0) - 20,
      );
      effect = { retaliationRisk: true };
    }

    context.events.append({
      tick: context.clock.tick,
      tickDurationMs: context.clock.tickDurationMs,
      type: "blackmail.resolved",
      actorId: actor.identity.id,
      payload: {
        commandId,
        targetFactionId: target.identity.id,
        approach,
        success,
        successRate: round(successRate),
        evidenceQuality: round(evidenceQuality),
        cooldownTicks: dossier.cooldownTicks,
        effect,
      },
    });
    this.executed(context, actor.identity.id, commandId, "execute_blackmail");
  }

  private applySuccessEffect(
    context: SimulationSystemContext,
    actor: StrategyEntity & Required<Pick<StrategyEntity, "factionState" | "influence" | "blackmail">>,
    target: StrategyEntity & Required<Pick<StrategyEntity, "factionState" | "influence" | "blackmail">>,
    approach: BlackmailApproach,
  ): Record<string, unknown> {
    if (approach === "fear") {
      target.blackmail.intimidatedUntilTick = context.clock.tick + this.config.fearCeasefireTicks;
      let affectedUnits = 0;
      for (const unit of [...context.world.queries.units].sort((a, b) => a.identity.id.localeCompare(b.identity.id))) {
        if (unit.faction.factionId !== target.identity.id) continue;
        if (unit.morale) {
          unit.morale.current = clamp(
            unit.morale.current - this.config.fearMoralePenalty,
            0,
            unit.morale.maximum,
          );
        }
        if (unit.combat) unit.combat.targetId = undefined;
        affectedUnits += 1;
      }
      actor.influence.points += 15;
      return {
        type: "fear",
        affectedUnits,
        intimidatedUntilTick: target.blackmail.intimidatedUntilTick,
      };
    }

    if (approach === "greed") {
      const requestedPayment = context.random.nextInt(
        Math.floor(this.config.greedMinimumPayment),
        Math.floor(this.config.greedMaximumPayment) + 1,
      );
      const payment = Math.min(target.factionState.treasury, requestedPayment);
      target.factionState.treasury -= payment;
      actor.factionState.treasury += payment;
      actor.influence.reputation = clampPercent(actor.influence.reputation + 15);
      target.influence.reputation = clampPercent(target.influence.reputation - 10);
      actor.influence.points += 10;
      return { type: "greed", payment };
    }

    target.blackmail.isolatedUntilTick = context.clock.tick + this.config.isolationDurationTicks;
    target.influence.reputation = clampPercent(target.influence.reputation - 20);
    target.influence.operationalSecurity = clampPercent(target.influence.operationalSecurity - 10);
    for (const other of [...context.world.queries.factions].sort((a, b) => a.identity.id.localeCompare(b.identity.id))) {
      if (other.identity.id === target.identity.id) continue;
      target.factionState.relations[other.identity.id] = clampRelation(
        (target.factionState.relations[other.identity.id] ?? 0) - this.config.isolationRelationPenalty,
      );
      other.factionState.relations[target.identity.id] = clampRelation(
        (other.factionState.relations[target.identity.id] ?? 0) - this.config.isolationRelationPenalty,
      );
    }
    actor.influence.points += 12;
    return {
      type: "isolation",
      isolatedUntilTick: target.blackmail.isolatedUntilTick,
    };
  }

  private getDossier(actor: StrategyEntity & Required<Pick<StrategyEntity, "blackmail">>, targetFactionId: string): BlackmailDossier {
    const existing = actor.blackmail.dossiers[targetFactionId];
    if (existing) return existing;
    const created: BlackmailDossier = {
      evidenceQuality: 0,
      cooldownTicks: 0,
      compromised: false,
    };
    actor.blackmail.dossiers[targetFactionId] = created;
    return created;
  }

  private baseSuccess(approach: BlackmailApproach): number {
    if (approach === "fear") return this.config.fearBaseSuccess;
    if (approach === "greed") return this.config.greedBaseSuccess;
    return this.config.isolationBaseSuccess;
  }

  private reject(
    context: SimulationSystemContext,
    actorId: string,
    commandId: string,
    code: string,
    reason: string,
  ): void {
    context.events.append({
      tick: context.clock.tick,
      tickDurationMs: context.clock.tickDurationMs,
      type: "command.rejected",
      actorId,
      payload: { commandId, code, reason },
    });
  }

  private executed(
    context: SimulationSystemContext,
    actorId: string,
    commandId: string,
    commandType: string,
  ): void {
    context.events.append({
      tick: context.clock.tick,
      tickDurationMs: context.clock.tickDurationMs,
      type: "command.executed",
      actorId,
      payload: { commandId, commandType },
    });
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function clampPercent(value: number): number {
  return round(clamp(value, 0, 100));
}

function clampRelation(value: number): number {
  return round(clamp(value, -100, 100));
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
