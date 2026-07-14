import { pointInBounds } from "./coordinates";
import { PlacedWorldAssetSchema, type GeoBounds, type PlacedWorldAsset } from "./types";

export interface PlacementPolicy {
  bounds: GeoBounds;
  maximumScale: number;
  minimumAltitude: number;
  maximumAltitude: number;
  allowedAssetIds?: ReadonlySet<string>;
  allowedRoles?: ReadonlySet<string>;
}

export interface PlacementValidationResult {
  valid: boolean;
  issues: string[];
  asset?: PlacedWorldAsset;
}

export function validateWorldAssetPlacement(input: unknown, policy: PlacementPolicy): PlacementValidationResult {
  const parsed = PlacedWorldAssetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`),
    };
  }

  const asset = parsed.data;
  const issues: string[] = [];
  if (!pointInBounds(asset.geoPosition, policy.bounds)) issues.push("Asset position is outside the authorized world region.");
  if (asset.geoPosition.altitude < policy.minimumAltitude || asset.geoPosition.altitude > policy.maximumAltitude) {
    issues.push("Asset altitude is outside the authorized range.");
  }
  if (asset.localTransform.scale.some(value => value > policy.maximumScale)) {
    issues.push(`Asset scale exceeds maximum ${policy.maximumScale}.`);
  }
  if (policy.allowedAssetIds && !policy.allowedAssetIds.has(asset.assetId)) issues.push("Asset ID is not in the approved manifest.");
  if (asset.gameRole && policy.allowedRoles && !policy.allowedRoles.has(asset.gameRole)) issues.push("Gameplay role is not allowed for placement.");

  return {
    valid: issues.length === 0,
    issues,
    ...(issues.length === 0 ? { asset } : {}),
  };
}

export function applyPlacementVersion(current: PlacedWorldAsset | undefined, next: PlacedWorldAsset): PlacedWorldAsset {
  if (!current) {
    if (next.version !== 1) throw new Error("New asset placements must start at version 1.");
    return next;
  }
  if (current.id !== next.id) throw new Error("Placement IDs do not match.");
  if (next.version !== current.version + 1) {
    throw new Error(`Placement version conflict: expected ${current.version + 1}, received ${next.version}.`);
  }
  return next;
}
