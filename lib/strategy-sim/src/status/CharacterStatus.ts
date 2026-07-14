import { z } from "zod";

export const InjurySchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.string().min(1).max(120),
  severity: z.number().finite().min(0).max(100),
  recoveryPerTick: z.number().finite().min(0).max(10),
});

export const CharacterStatusSchema = z.object({
  health: z.object({
    current: z.number().finite().min(0),
    maximum: z.number().finite().positive(),
    injuries: z.array(InjurySchema).max(100),
  }),
  vitality: z.object({
    energy: z.number().finite().min(0).max(100),
    fatigue: z.number().finite().min(0).max(100),
    hunger: z.number().finite().min(0).max(100),
    recovery: z.number().finite().min(0).max(100),
  }),
  balance: z.object({
    stress: z.number().finite().min(0).max(100),
    stability: z.number().finite().min(0).max(100),
    focus: z.number().finite().min(0).max(100),
  }),
  spirit: z.object({
    hope: z.number().finite().min(0).max(100),
    courage: z.number().finite().min(0).max(100),
    belonging: z.number().finite().min(0).max(100),
  }),
  morals: z.object({
    principles: z.array(z.string().min(1).max(160)).max(100),
    integrity: z.number().finite().min(0).max(100),
    empathy: z.number().finite().min(0).max(100),
  }),
  karma: z.object({
    score: z.number().finite().min(-100_000).max(100_000),
    reputationByFaction: z.record(z.string().min(1).max(120), z.number().finite().min(-100).max(100)),
  }),
});

export const CharacterStatusEventSchema = z.object({
  id: z.string().min(1).max(160),
  tick: z.number().int().nonnegative(),
  type: z.enum([
    "damage",
    "heal",
    "rest",
    "eat",
    "stress",
    "stabilize",
    "hope",
    "courage",
    "belonging",
    "integrity",
    "empathy",
    "karma",
    "faction_reputation",
    "injury_add",
    "injury_recover",
  ]),
  amount: z.number().finite().min(-10_000).max(10_000),
  factionId: z.string().min(1).max(120).optional(),
  injury: InjurySchema.optional(),
  reason: z.string().min(1).max(500),
  schemaVersion: z.literal(1),
});

export type CharacterStatus = z.infer<typeof CharacterStatusSchema>;
export type CharacterStatusEvent = z.infer<typeof CharacterStatusEventSchema>;
export type Injury = z.infer<typeof InjurySchema>;

export interface CharacterStatusReplayResult {
  status: CharacterStatus;
  appliedEventIds: string[];
}

export function createDefaultCharacterStatus(): CharacterStatus {
  return {
    health: { current: 100, maximum: 100, injuries: [] },
    vitality: { energy: 100, fatigue: 0, hunger: 0, recovery: 50 },
    balance: { stress: 0, stability: 75, focus: 75 },
    spirit: { hope: 60, courage: 50, belonging: 50 },
    morals: { principles: [], integrity: 70, empathy: 60 },
    karma: { score: 0, reputationByFaction: {} },
  };
}

export function applyCharacterStatusEvent(statusInput: CharacterStatus, eventInput: CharacterStatusEvent): CharacterStatus {
  const status = CharacterStatusSchema.parse(structuredClone(statusInput));
  const event = CharacterStatusEventSchema.parse(eventInput);
  const amount = event.amount;

  switch (event.type) {
    case "damage":
      status.health.current = clamp(status.health.current - Math.abs(amount), 0, status.health.maximum);
      break;
    case "heal":
      status.health.current = clamp(status.health.current + Math.abs(amount), 0, status.health.maximum);
      break;
    case "rest":
      status.vitality.energy = clamp100(status.vitality.energy + Math.abs(amount));
      status.vitality.fatigue = clamp100(status.vitality.fatigue - Math.abs(amount));
      status.vitality.recovery = clamp100(status.vitality.recovery + Math.abs(amount) * 0.5);
      break;
    case "eat":
      status.vitality.hunger = clamp100(status.vitality.hunger - Math.abs(amount));
      status.vitality.energy = clamp100(status.vitality.energy + Math.abs(amount) * 0.35);
      break;
    case "stress":
      status.balance.stress = clamp100(status.balance.stress + amount);
      status.balance.stability = clamp100(status.balance.stability - amount * 0.5);
      status.balance.focus = clamp100(status.balance.focus - amount * 0.25);
      break;
    case "stabilize":
      status.balance.stability = clamp100(status.balance.stability + Math.abs(amount));
      status.balance.stress = clamp100(status.balance.stress - Math.abs(amount) * 0.75);
      break;
    case "hope":
      status.spirit.hope = clamp100(status.spirit.hope + amount);
      break;
    case "courage":
      status.spirit.courage = clamp100(status.spirit.courage + amount);
      break;
    case "belonging":
      status.spirit.belonging = clamp100(status.spirit.belonging + amount);
      break;
    case "integrity":
      status.morals.integrity = clamp100(status.morals.integrity + amount);
      break;
    case "empathy":
      status.morals.empathy = clamp100(status.morals.empathy + amount);
      break;
    case "karma":
      status.karma.score = clamp(status.karma.score + amount, -100_000, 100_000);
      break;
    case "faction_reputation": {
      if (!event.factionId) throw new Error("faction_reputation events require factionId.");
      const current = status.karma.reputationByFaction[event.factionId] ?? 0;
      status.karma.reputationByFaction[event.factionId] = clamp(current + amount, -100, 100);
      break;
    }
    case "injury_add": {
      if (!event.injury) throw new Error("injury_add events require injury.");
      const index = status.health.injuries.findIndex(injury => injury.id === event.injury!.id);
      if (index >= 0) status.health.injuries[index] = event.injury;
      else status.health.injuries.push(event.injury);
      break;
    }
    case "injury_recover": {
      if (!event.injury) throw new Error("injury_recover events require injury.");
      status.health.injuries = status.health.injuries
        .map(injury => injury.id === event.injury!.id
          ? { ...injury, severity: clamp(injury.severity - Math.abs(amount), 0, 100) }
          : injury)
        .filter(injury => injury.severity > 0);
      break;
    }
  }

  return CharacterStatusSchema.parse(status);
}

export function replayCharacterStatusEvents(
  initialStatus: CharacterStatus,
  events: readonly CharacterStatusEvent[],
): CharacterStatusReplayResult {
  const sorted = events
    .map(event => CharacterStatusEventSchema.parse(event))
    .sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  let status = CharacterStatusSchema.parse(structuredClone(initialStatus));
  const appliedEventIds: string[] = [];
  for (const event of sorted) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    status = applyCharacterStatusEvent(status, event);
    appliedEventIds.push(event.id);
  }
  return { status, appliedEventIds };
}

export function progressCharacterStatusTick(statusInput: CharacterStatus): CharacterStatus {
  const status = CharacterStatusSchema.parse(structuredClone(statusInput));
  status.vitality.hunger = clamp100(status.vitality.hunger + 0.01);
  status.vitality.fatigue = clamp100(status.vitality.fatigue + 0.005);
  status.vitality.energy = clamp100(status.vitality.energy - 0.004);
  status.health.injuries = status.health.injuries
    .map(injury => ({ ...injury, severity: clamp(injury.severity - injury.recoveryPerTick, 0, 100) }))
    .filter(injury => injury.severity > 0);
  return CharacterStatusSchema.parse(status);
}

function clamp100(value: number): number {
  return clamp(value, 0, 100);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
