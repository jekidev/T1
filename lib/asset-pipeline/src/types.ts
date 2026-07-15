import { z } from "zod";

export const AssetSourceTypeSchema = z.enum(["image", "video", "text", "procedural"]);
export const LicenseStatusSchema = z.enum(["verified", "unverified", "restricted"]);
export const GeneratedAssetTypeSchema = z.enum(["prop", "building", "character", "animation"]);
export const AssetJobKindSchema = z.enum(["image_to_3d", "human_character", "video_to_animation"]);
export const AssetGeneratorSchema = z.enum([
  "hunyuan3d-2",
  "instantmesh",
  "triposr",
  "flashvdm",
  "mpfb2",
  "makehuman",
  "econ",
  "deca",
  "freemocap",
  "mediapipe",
]);

export const GeneratedAssetMetadataSchema = z.object({
  id: z.string().min(1).max(160),
  sourceType: AssetSourceTypeSchema,
  sourceProvider: z.string().min(1).max(160).optional(),
  generator: z.string().min(1).max(160),
  generatorVersion: z.string().min(1).max(80),
  promptHash: z.string().min(8).max(128).optional(),
  seed: z.number().int().nonnegative().optional(),
  licenseStatus: LicenseStatusSchema,
  assetType: GeneratedAssetTypeSchema,
  polygonCount: z.number().int().nonnegative(),
  textureMemoryBytes: z.number().int().nonnegative(),
  lodCount: z.number().int().min(1).max(12),
  skeletonId: z.string().min(1).max(160).optional(),
  createdAt: z.string().datetime(),
});

export const AssetArtifactSchema = z.object({
  kind: z.enum(["source", "preview", "mesh", "texture", "glb", "animation", "report"]),
  path: z.string().min(1),
  mimeType: z.string().min(1),
  byteLength: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  publicUrl: z.string().url().optional(),
});

export const AssetValidationIssueSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
  path: z.string().optional(),
});

export const AssetValidationReportSchema = z.object({
  valid: z.boolean(),
  checkedAt: z.string().datetime(),
  issues: z.array(AssetValidationIssueSchema),
  checks: z.object({
    gltf: z.boolean(),
    topology: z.boolean(),
    textures: z.boolean(),
    skeleton: z.boolean().optional(),
    animation: z.boolean().optional(),
    license: z.boolean(),
  }),
});

const BaseAssetJobRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(160).optional(),
  sourceProvider: z.string().min(1).max(160).optional(),
  licenseStatus: LicenseStatusSchema.default("unverified"),
  seed: z.number().int().nonnegative().optional(),
  publishAfterValidation: z.boolean().default(false),
});

export const ImageTo3DJobRequestSchema = BaseAssetJobRequestSchema.extend({
  kind: z.literal("image_to_3d"),
  sourceAssetId: z.string().min(1).max(160),
  generatorPreference: z.array(z.enum(["hunyuan3d-2", "instantmesh", "triposr", "flashvdm"]))
    .min(1)
    .default(["hunyuan3d-2", "instantmesh", "triposr"]),
  assetType: z.enum(["prop", "building"]).default("prop"),
  targetPolygonCount: z.number().int().min(500).max(2_000_000).default(50_000),
  lodCount: z.number().int().min(1).max(8).default(3),
  removeBackground: z.boolean().default(true),
});

export const HumanCharacterJobRequestSchema = BaseAssetJobRequestSchema.extend({
  kind: z.literal("human_character"),
  generatorPreference: z.array(z.enum(["mpfb2", "makehuman", "deca", "econ"]))
    .min(1)
    .default(["mpfb2", "makehuman"]),
  presetId: z.string().min(1).max(160),
  factionId: z.string().min(1).max(160).optional(),
  roleId: z.string().min(1).max(160).optional(),
  faceSourceAssetId: z.string().min(1).max(160).optional(),
  skeletonId: z.string().min(1).max(160).default("operation-kobenhavn-humanoid-v1"),
  lodCount: z.number().int().min(2).max(8).default(4),
});

export const VideoToAnimationJobRequestSchema = BaseAssetJobRequestSchema.extend({
  kind: z.literal("video_to_animation"),
  sourceAssetId: z.string().min(1).max(160),
  generatorPreference: z.array(z.enum(["freemocap", "mediapipe"]))
    .min(1)
    .default(["freemocap", "mediapipe"]),
  skeletonId: z.string().min(1).max(160).default("operation-kobenhavn-humanoid-v1"),
  clipName: z.string().min(1).max(160),
  framesPerSecond: z.number().int().min(12).max(120).default(30),
  footContactCorrection: z.boolean().default(true),
  temporalSmoothing: z.boolean().default(true),
});

export const AssetJobRequestSchema = z.discriminatedUnion("kind", [
  ImageTo3DJobRequestSchema,
  HumanCharacterJobRequestSchema,
  VideoToAnimationJobRequestSchema,
]);

export const AssetJobStatusSchema = z.enum([
  "queued",
  "validating_input",
  "preprocessing",
  "generating",
  "blender_processing",
  "validating_output",
  "awaiting_review",
  "published",
  "failed",
  "cancelled",
]);

export const AssetJobErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  stage: AssetJobStatusSchema,
});

export const AssetJobSchema = z.object({
  id: z.string().min(1).max(160),
  request: AssetJobRequestSchema,
  status: AssetJobStatusSchema,
  progress: z.number().min(0).max(1),
  selectedGenerator: AssetGeneratorSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  artifacts: z.array(AssetArtifactSchema),
  validation: AssetValidationReportSchema.optional(),
  metadata: GeneratedAssetMetadataSchema.optional(),
  error: AssetJobErrorSchema.optional(),
});

export const GameAssetManifestEntrySchema = z.object({
  id: z.string().min(1).max(160),
  type: GeneratedAssetTypeSchema,
  path: z.string().min(1),
  previewPath: z.string().min(1).optional(),
  preload: z.boolean().default(false),
  optional: z.boolean().default(true),
  metadata: GeneratedAssetMetadataSchema,
  validation: AssetValidationReportSchema,
  publishedAt: z.string().datetime().optional(),
});

export type AssetSourceType = z.infer<typeof AssetSourceTypeSchema>;
export type LicenseStatus = z.infer<typeof LicenseStatusSchema>;
export type GeneratedAssetType = z.infer<typeof GeneratedAssetTypeSchema>;
export type AssetGenerator = z.infer<typeof AssetGeneratorSchema>;
export type GeneratedAssetMetadata = z.infer<typeof GeneratedAssetMetadataSchema>;
export type AssetArtifact = z.infer<typeof AssetArtifactSchema>;
export type AssetValidationIssue = z.infer<typeof AssetValidationIssueSchema>;
export type AssetValidationReport = z.infer<typeof AssetValidationReportSchema>;
export type AssetJobRequest = z.infer<typeof AssetJobRequestSchema>;
export type AssetJobStatus = z.infer<typeof AssetJobStatusSchema>;
export type AssetJobError = z.infer<typeof AssetJobErrorSchema>;
export type AssetJob = z.infer<typeof AssetJobSchema>;
export type GameAssetManifestEntry = z.infer<typeof GameAssetManifestEntrySchema>;
