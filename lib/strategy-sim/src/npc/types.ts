import { z } from "zod";

export const NPCRoleSchema = z.object({
  id: z.string().min(1).max(120),
  occupation: z.string().min(1).max(160),
  responsibilities: z.array(z.string().min(1).max(240)).max(50),
  workplaceId: z.string().min(1).max(160).optional(),
  homeId: z.string().min(1).max(160).optional(),
  scheduleTemplate: z.string().min(1).max(120),
  allowedActions: z.array(z.string().min(1).max(120)).min(1).max(100),
  socialStatus: z.number().finite().min(0).max(100),
  economicStatus: z.number().finite().min(0).max(100),
});

export const NPCScheduleEntrySchema = z.object({
  id: z.string().min(1).max(120),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  action: z.string().min(1).max(120),
  locationId: z.string().min(1).max(160).optional(),
  priority: z.number().int().min(0).max(100).default(50),
}).superRefine((entry, context) => {
  if (entry.endMinute <= entry.startMinute) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endMinute"], message: "endMinute must be greater than startMinute" });
  }
});

export const NPCPersonalitySchema = z.object({
  openness: z.number().finite().min(0).max(1),
  conscientiousness: z.number().finite().min(0).max(1),
  extraversion: z.number().finite().min(0).max(1),
  agreeableness: z.number().finite().min(0).max(1),
  emotionalVolatility: z.number().finite().min(0).max(1),
});

export const NPCNeedsSchema = z.object({
  hunger: z.number().finite().min(0).max(100),
  fatigue: z.number().finite().min(0).max(100),
  social: z.number().finite().min(0).max(100),
  safety: z.number().finite().min(0).max(100),
});

export const NPCMemoryRecordSchema = z.object({
  id: z.string().min(1).max(160),
  tick: z.number().int().nonnegative(),
  type: z.enum(["observation", "interaction", "reflection", "plan", "event"]),
  summary: z.string().min(1).max(2_000),
  entityIds: z.array(z.string().min(1).max(160)).max(100).default([]),
  tags: z.array(z.string().min(1).max(80)).max(100).default([]),
  importance: z.number().finite().min(0).max(1),
  emotionalValence: z.number().finite().min(-1).max(1),
  expiresAtTick: z.number().int().nonnegative().optional(),
});

export interface NPCComponent {
  name: string;
  ageBracket: "child" | "teen" | "adult" | "older_adult";
  role: z.infer<typeof NPCRoleSchema>;
  schedule: z.infer<typeof NPCScheduleEntrySchema>[];
  personality: z.infer<typeof NPCPersonalitySchema>;
  needs: z.infer<typeof NPCNeedsSchema>;
  relationships: Record<string, number>;
  beliefs: Record<string, number>;
  goals: string[];
  morals: string[];
  emotionalState: string;
  currentAction: string;
  currentLocationId?: string;
  activeScheduleEntryId?: string;
  memory: z.infer<typeof NPCMemoryRecordSchema>[];
}

export type NPCRole = z.infer<typeof NPCRoleSchema>;
export type NPCScheduleEntry = z.infer<typeof NPCScheduleEntrySchema>;
export type NPCPersonality = z.infer<typeof NPCPersonalitySchema>;
export type NPCNeeds = z.infer<typeof NPCNeedsSchema>;
export type NPCMemoryRecord = z.infer<typeof NPCMemoryRecordSchema>;

export interface NPCRoutineDecision {
  npcId: string;
  action: string;
  locationId?: string;
  scheduleEntryId?: string;
  source: "schedule" | "need" | "fallback";
  reason: string;
}
