import {
  GameAssetManifestEntrySchema,
  GeneratedAssetMetadataSchema,
  type AssetValidationIssue,
  type AssetValidationReport,
  type GameAssetManifestEntry,
  type GeneratedAssetMetadata,
} from "./types";

export interface AssetValidationPolicy {
  maximumPolygonCount: number;
  maximumTextureMemoryBytes: number;
  minimumLodCount: number;
  requiredCharacterSkeletonId: string;
}

export const DEFAULT_ASSET_VALIDATION_POLICY: Readonly<AssetValidationPolicy> = Object.freeze({
  maximumPolygonCount: 250_000,
  maximumTextureMemoryBytes: 256 * 1024 * 1024,
  minimumLodCount: 2,
  requiredCharacterSkeletonId: "operation-kobenhavn-humanoid-v1",
});

export function validateGeneratedAssetMetadata(
  input: unknown,
  policy: AssetValidationPolicy = DEFAULT_ASSET_VALIDATION_POLICY,
  checkedAt = new Date(),
): AssetValidationReport {
  const parsed = GeneratedAssetMetadataSchema.safeParse(input);
  const issues: AssetValidationIssue[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        code: "metadata.schema",
        severity: "error",
        message: issue.message,
        path: issue.path.join("."),
      });
    }
    return report(issues, checkedAt, false, false, false, false, false);
  }

  const metadata = parsed.data;
  if (metadata.licenseStatus !== "verified") {
    issues.push({
      code: "license.not_verified",
      severity: "error",
      message: "Asset license status must be verified before production publication.",
      path: "licenseStatus",
    });
  }
  if (metadata.polygonCount > policy.maximumPolygonCount) {
    issues.push({
      code: "mesh.polygon_budget_exceeded",
      severity: "error",
      message: `Polygon count ${metadata.polygonCount} exceeds budget ${policy.maximumPolygonCount}.`,
      path: "polygonCount",
    });
  }
  if (metadata.textureMemoryBytes > policy.maximumTextureMemoryBytes) {
    issues.push({
      code: "texture.memory_budget_exceeded",
      severity: "error",
      message: `Texture memory ${metadata.textureMemoryBytes} exceeds budget ${policy.maximumTextureMemoryBytes}.`,
      path: "textureMemoryBytes",
    });
  }
  if (metadata.lodCount < policy.minimumLodCount) {
    issues.push({
      code: "lod.insufficient",
      severity: "error",
      message: `At least ${policy.minimumLodCount} LOD levels are required.`,
      path: "lodCount",
    });
  }
  if (metadata.assetType === "character" && metadata.skeletonId !== policy.requiredCharacterSkeletonId) {
    issues.push({
      code: "skeleton.incompatible",
      severity: "error",
      message: `Characters must use skeleton ${policy.requiredCharacterSkeletonId}.`,
      path: "skeletonId",
    });
  }

  const licenseValid = metadata.licenseStatus === "verified";
  const topologyValid = metadata.polygonCount <= policy.maximumPolygonCount && metadata.lodCount >= policy.minimumLodCount;
  const texturesValid = metadata.textureMemoryBytes <= policy.maximumTextureMemoryBytes;
  const skeletonValid = metadata.assetType !== "character" || metadata.skeletonId === policy.requiredCharacterSkeletonId;
  return report(issues, checkedAt, true, topologyValid, texturesValid, skeletonValid, licenseValid);
}

export function canPublishAsset(
  metadata: GeneratedAssetMetadata,
  validation: AssetValidationReport,
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (metadata.licenseStatus !== "verified") reasons.push("License status is not verified.");
  if (!validation.valid) reasons.push("Asset validation report contains errors.");
  if (!validation.checks.gltf) reasons.push("glTF validation did not pass.");
  if (!validation.checks.topology) reasons.push("Topology validation did not pass.");
  if (!validation.checks.textures) reasons.push("Texture validation did not pass.");
  if (metadata.assetType === "character" && !validation.checks.skeleton) reasons.push("Skeleton validation did not pass.");
  if (metadata.assetType === "animation" && !validation.checks.animation) reasons.push("Animation validation did not pass.");
  return { allowed: reasons.length === 0, reasons };
}

export function validateManifestEntry(input: unknown): GameAssetManifestEntry {
  return GameAssetManifestEntrySchema.parse(input);
}

function report(
  issues: AssetValidationIssue[],
  checkedAt: Date,
  gltf: boolean,
  topology: boolean,
  textures: boolean,
  skeleton: boolean,
  license: boolean,
): AssetValidationReport {
  return {
    valid: issues.every(issue => issue.severity !== "error") && gltf && topology && textures && skeleton && license,
    checkedAt: checkedAt.toISOString(),
    issues,
    checks: {
      gltf,
      topology,
      textures,
      skeleton,
      license,
    },
  };
}
