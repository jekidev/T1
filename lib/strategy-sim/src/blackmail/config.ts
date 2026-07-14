export type BlackmailApproach = "fear" | "greed" | "isolation";

export interface BlackmailConfig {
  evidenceGatherCost: number;
  evidenceMinQuality: number;
  evidenceMaxQuality: number;
  fearBaseSuccess: number;
  greedBaseSuccess: number;
  isolationBaseSuccess: number;
  cooldownTicks: number;
  suspicionIncreaseOnFail: number;
  reputationLossOnFail: number;
  reputationLossOnSuccess: number;
  opsecLossOnAction: number;
  noticeChance: number;
  fearMoralePenalty: number;
  fearCeasefireTicks: number;
  greedMinimumPayment: number;
  greedMaximumPayment: number;
  isolationRelationPenalty: number;
  isolationDurationTicks: number;
}

export const DEFAULT_BLACKMAIL_CONFIG: Readonly<BlackmailConfig> = Object.freeze({
  evidenceGatherCost: 15,
  evidenceMinQuality: 20,
  evidenceMaxQuality: 100,
  fearBaseSuccess: 0.7,
  greedBaseSuccess: 0.5,
  isolationBaseSuccess: 0.6,
  cooldownTicks: 200,
  suspicionIncreaseOnFail: 20,
  reputationLossOnFail: 10,
  reputationLossOnSuccess: 5,
  opsecLossOnAction: 5,
  noticeChance: 0.15,
  fearMoralePenalty: 15,
  fearCeasefireTicks: 100,
  greedMinimumPayment: 300,
  greedMaximumPayment: 1_000,
  isolationRelationPenalty: 20,
  isolationDurationTicks: 200,
});

export function resolveBlackmailConfig(overrides: Partial<BlackmailConfig> = {}): BlackmailConfig {
  const config: BlackmailConfig = { ...DEFAULT_BLACKMAIL_CONFIG, ...overrides };
  const percentages: Array<keyof BlackmailConfig> = [
    "evidenceGatherCost",
    "evidenceMinQuality",
    "evidenceMaxQuality",
    "suspicionIncreaseOnFail",
    "reputationLossOnFail",
    "reputationLossOnSuccess",
    "opsecLossOnAction",
    "fearMoralePenalty",
    "isolationRelationPenalty",
  ];
  for (const key of percentages) {
    const value = config[key];
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Invalid blackmail configuration value for ${key}.`);
    }
  }
  const probabilities: Array<keyof BlackmailConfig> = [
    "fearBaseSuccess",
    "greedBaseSuccess",
    "isolationBaseSuccess",
    "noticeChance",
  ];
  for (const key of probabilities) {
    const value = config[key];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Invalid blackmail probability for ${key}.`);
    }
  }
  const tickValues: Array<keyof BlackmailConfig> = ["cooldownTicks", "fearCeasefireTicks", "isolationDurationTicks"];
  for (const key of tickValues) {
    const value = config[key];
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid blackmail tick value for ${key}.`);
    }
  }
  if (config.evidenceMaxQuality < config.evidenceMinQuality) {
    throw new Error("evidenceMaxQuality must be greater than or equal to evidenceMinQuality.");
  }
  if (config.greedMaximumPayment < config.greedMinimumPayment || config.greedMinimumPayment < 0) {
    throw new Error("Invalid blackmail payment range.");
  }
  return config;
}
