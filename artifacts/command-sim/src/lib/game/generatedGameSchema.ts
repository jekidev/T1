import { z } from "zod";

export const GeneratedFactionSchema = z.object({
  name: z.string().min(2).max(80),
  faction: z.enum(["police", "criminal", "neutral"]),
  role: z.string().min(2).max(240),
  goal: z.string().min(2).max(500),
});

export const GeneratedAssetSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.string().min(2).max(60),
  description: z.string().min(2).max(600),
  district: z.string().max(120).optional(),
});

export const GeneratedShopSchema = z.object({
  name: z.string().min(2).max(100),
  district: z.string().min(2).max(120),
  description: z.string().min(2).max(600),
  inventory: z.array(z.string().min(1).max(100)).max(30).optional(),
});

export const GeneratedSkillSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(2).max(500),
});

export const GeneratedGamePayloadSchema = z.object({
  storyline: z.string().min(80).max(12000),
  openingMission: z.string().min(20).max(3000),
  tutorialSummary: z.string().min(20).max(1500),
  factions: z.array(GeneratedFactionSchema).min(2).max(20),
  assets: z.array(GeneratedAssetSchema).min(1).max(80),
  shops: z.array(GeneratedShopSchema).max(30),
  skills: z.array(GeneratedSkillSchema).max(40),
  sourceCases: z.array(z.string().min(1).max(240)).max(50).default([]),
});

export type GeneratedGamePayload = z.infer<typeof GeneratedGamePayloadSchema>;

export function parseGeneratedGamePayload(input: unknown): {
  success: true;
  data: GeneratedGamePayload;
  warnings: string[];
} | {
  success: false;
  errors: string[];
} {
  const result = GeneratedGamePayloadSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(issue => `${issue.path.join(".") || "root"}: ${issue.message}`),
    };
  }

  const warnings: string[] = [];
  const names = result.data.factions.map(item => item.name.toLowerCase());
  if (new Set(names).size !== names.length) warnings.push("Duplicate faction names were returned by the model.");
  if (!result.data.factions.some(item => item.faction === "criminal")) warnings.push("No Red Team faction was returned.");
  if (!result.data.factions.some(item => item.faction === "police")) warnings.push("No Blue Team faction was returned.");
  if (result.data.shops.length === 0) warnings.push("No shops were returned; the compiler will create a default regional vendor.");

  return { success: true, data: result.data, warnings };
}
