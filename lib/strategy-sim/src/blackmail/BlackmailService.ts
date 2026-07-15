import type { CommandValidationResult } from "../commands/types";
import type { StrategyEntity } from "../ecs/components";
import type { StrategySimulation } from "../StrategySimulation";
import type { BlackmailApproach, BlackmailConfig } from "./config";

export interface BlackmailTargetView {
  factionId: string;
  name: string;
  reputation: number;
  operationalSecurity: number;
  suspicion: number;
  resistance: number;
  evidenceQuality: number;
  cooldownTicks: number;
  compromised: boolean;
  canGatherEvidence: boolean;
  canExecute: boolean;
  unavailableReason?: string;
}

export interface BlackmailEligibility {
  allowed: boolean;
  reason?: string;
}

export class BlackmailService {
  constructor(private readonly simulation: StrategySimulation) {}

  get config(): Readonly<BlackmailConfig> {
    return this.simulation.blackmailConfig;
  }

  getTargets(actorFactionId: string): BlackmailTargetView[] {
    const actor = this.getFaction(actorFactionId);
    if (!actor?.influence || !actor.blackmail) return [];

    return [...this.simulation.world.queries.blackmailFactions]
      .filter(target => target.identity.id !== actorFactionId)
      .sort((a, b) => a.identity.id.localeCompare(b.identity.id))
      .map(target => {
        const dossier = actor.blackmail!.dossiers[target.identity.id] ?? {
          evidenceQuality: 0,
          cooldownTicks: 0,
          compromised: false,
        };
        const gather = this.canGatherEvidence(actorFactionId, target.identity.id);
        const execute = this.canExecute(actorFactionId, target.identity.id);
        return {
          factionId: target.identity.id,
          name: target.factionState.name,
          reputation: target.influence.reputation,
          operationalSecurity: target.influence.operationalSecurity,
          suspicion: target.influence.suspicion,
          resistance: target.blackmail.resistance,
          evidenceQuality: dossier.evidenceQuality,
          cooldownTicks: dossier.cooldownTicks,
          compromised: dossier.compromised,
          canGatherEvidence: gather.allowed,
          canExecute: execute.allowed,
          ...(gather.allowed || execute.allowed ? {} : { unavailableReason: execute.reason ?? gather.reason }),
        };
      });
  }

  canGatherEvidence(actorFactionId: string, targetFactionId: string): BlackmailEligibility {
    const pair = this.getPair(actorFactionId, targetFactionId);
    if (!pair.allowed) return pair;
    const actor = pair.actor!;
    const dossier = actor.blackmail!.dossiers[targetFactionId];
    if ((dossier?.cooldownTicks ?? 0) > 0) {
      return { allowed: false, reason: `Target is on cooldown for ${dossier!.cooldownTicks} ticks.` };
    }
    if (actor.influence!.reputation < this.config.evidenceGatherCost) {
      return { allowed: false, reason: "Not enough in-game reputation." };
    }
    return { allowed: true };
  }

  canExecute(actorFactionId: string, targetFactionId: string): BlackmailEligibility {
    const pair = this.getPair(actorFactionId, targetFactionId);
    if (!pair.allowed) return pair;
    const dossier = pair.actor!.blackmail!.dossiers[targetFactionId];
    if ((dossier?.cooldownTicks ?? 0) > 0) {
      return { allowed: false, reason: `Target is on cooldown for ${dossier!.cooldownTicks} ticks.` };
    }
    if ((dossier?.evidenceQuality ?? 0) < this.config.evidenceMinQuality) {
      return { allowed: false, reason: `At least ${this.config.evidenceMinQuality}% evidence quality is required.` };
    }
    return { allowed: true };
  }

  canBlackmail(actorFactionId: string, targetFactionId: string): BlackmailEligibility {
    return this.canExecute(actorFactionId, targetFactionId);
  }

  gatherEvidence(actorFactionId: string, targetFactionId: string, submittedTick = this.simulation.clock.tick + 1): CommandValidationResult {
    return this.simulation.submitCommand({
      id: this.simulation.nextCommandId("blackmail-gather"),
      submittedTick,
      actorFactionId,
      command: {
        type: "gather_blackmail_evidence",
        targetFactionId,
      },
    });
  }

  execute(actorFactionId: string, targetFactionId: string, approach: BlackmailApproach, submittedTick = this.simulation.clock.tick + 1): CommandValidationResult {
    return this.simulation.submitCommand({
      id: this.simulation.nextCommandId("blackmail-execute"),
      submittedTick,
      actorFactionId,
      command: {
        type: "execute_blackmail",
        targetFactionId,
        approach,
      },
    });
  }

  executeBlackmail(actorFactionId: string, targetFactionId: string, approach: BlackmailApproach, submittedTick = this.simulation.clock.tick + 1): CommandValidationResult {
    return this.execute(actorFactionId, targetFactionId, approach, submittedTick);
  }

  private getFaction(factionId: string): StrategyEntity | undefined {
    const faction = this.simulation.world.get(factionId);
    return faction?.factionState ? faction : undefined;
  }

  private getPair(actorFactionId: string, targetFactionId: string): BlackmailEligibility & {
    actor?: StrategyEntity;
    target?: StrategyEntity;
  } {
    if (actorFactionId === targetFactionId) return { allowed: false, reason: "A faction cannot target itself." };
    const actor = this.getFaction(actorFactionId);
    const target = this.getFaction(targetFactionId);
    if (!actor) return { allowed: false, reason: "Actor faction was not found." };
    if (!target) return { allowed: false, reason: "Target faction was not found." };
    if (!actor.influence || !actor.blackmail) return { allowed: false, reason: "Actor does not support the blackmail subsystem." };
    if (!target.influence || !target.blackmail) return { allowed: false, reason: "Target does not support the blackmail subsystem." };
    return { allowed: true, actor, target };
  }
}
