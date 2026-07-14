import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import {
  GeoBoundsSchema,
  GameplayLocationRoleSchema,
  ImportedPlaceSchema,
  PlacedWorldAssetSchema,
  PUBLIC_OSM_CATEGORIES,
  validateGameplayLocationRole,
  validateWorldAssetPlacement,
} from "@workspace/geo-world";
import { importWorldRegionFromOverpass } from "../lib/overpass-client";
import { logger } from "../lib/logger";
import { withSpan } from "../lib/telemetry";

const router: IRouter = Router();
const PublicOsmCategorySchema = z.enum(PUBLIC_OSM_CATEGORIES);

const ImportRegionRequestSchema = z.object({
  bounds: GeoBoundsSchema,
  categories: z.array(PublicOsmCategorySchema).min(1).max(PUBLIC_OSM_CATEGORIES.length),
  chunkZoom: z.number().int().min(0).max(24).default(15),
});

const PlacementRequestSchema = z.object({
  asset: PlacedWorldAssetSchema,
  policy: z.object({
    bounds: GeoBoundsSchema,
    maximumScale: z.number().finite().positive().max(10_000).default(20),
    minimumAltitude: z.number().finite().min(-12_000).max(100_000).default(-100),
    maximumAltitude: z.number().finite().min(-12_000).max(100_000).default(10_000),
    allowedAssetIds: z.array(z.string().min(1).max(180)).max(20_000).optional(),
    allowedRoles: z.array(z.string().min(1).max(100)).max(500).optional(),
  }),
});

router.get("/world/capabilities", (_req, res): void => {
  res.json({
    coordinateSystem: "WGS84 + local tangent plane",
    publicDataSources: ["openstreetmap-overpass"],
    editableWorldSource: "open-licensed-vector-data",
    googleEarthAssetExtraction: false,
    supportedCategories: PUBLIC_OSM_CATEGORIES,
    maximumAreaSquareKilometers: positiveNumber(process.env.WORLD_IMPORT_MAX_AREA_KM2, 100),
    maximumChunks: positiveNumber(process.env.WORLD_IMPORT_MAX_CHUNKS, 400),
    overpassConfigured: Boolean(process.env.OVERPASS_API_URL || process.env.OVERPASS_API_URLS),
  });
});

router.post("/world/regions/import-osm", async (req, res): Promise<void> => {
  try {
    const input = ImportRegionRequestSchema.parse(req.body);
    const region = await importWorldRegionFromOverpass(input);
    res.status(201).json({ region });
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.post("/world/locations/validate-role", async (req, res): Promise<void> => {
  try {
    const place = ImportedPlaceSchema.parse(req.body?.place);
    const role = GameplayLocationRoleSchema.parse(req.body?.role);
    const validated = await withSpan("game.world.role.validate", {
      "world.place.source": place.source,
      "world.place.public_category": place.publicCategory,
      "world.game_role": role.role,
      "world.role.fictionalized": role.fictionalized,
    }, () => validateGameplayLocationRole(place, role));
    res.json({ role: validated });
  } catch (error) {
    sendError(res, error, 422);
  }
});

router.post("/world/assets/validate-placement", async (req, res): Promise<void> => {
  try {
    const input = PlacementRequestSchema.parse(req.body);
    const result = await withSpan("game.world.asset_placement.validate", {
      "world.asset.id": input.asset.assetId,
      "world.placement.version": input.asset.version,
    }, () => validateWorldAssetPlacement(input.asset, {
      bounds: input.policy.bounds,
      maximumScale: input.policy.maximumScale,
      minimumAltitude: input.policy.minimumAltitude,
      maximumAltitude: input.policy.maximumAltitude,
      ...(input.policy.allowedAssetIds ? { allowedAssetIds: new Set(input.policy.allowedAssetIds) } : {}),
      ...(input.policy.allowedRoles ? { allowedRoles: new Set(input.policy.allowedRoles) } : {}),
    }));
    res.status(result.valid ? 200 : 422).json(result);
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.post("/mcp/tools/search_osm_features", async (req, res): Promise<void> => {
  try {
    const input = ImportRegionRequestSchema.parse(req.body);
    const region = await importWorldRegionFromOverpass(input);
    res.json({
      tool: "search_osm_features",
      source: region.source,
      attribution: region.attribution,
      bounds: region.bounds,
      features: region.features,
      importedAt: region.importedAt,
    });
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.post("/mcp/tools/generate_world_region", async (req, res): Promise<void> => {
  try {
    const input = ImportRegionRequestSchema.parse(req.body);
    const region = await importWorldRegionFromOverpass(input);
    res.status(201).json({ tool: "generate_world_region", region });
  } catch (error) {
    sendError(res, error, 400);
  }
});

function sendError(res: Response, error: unknown, status: number): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation failed.",
      issues: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  logger.warn({ status, message }, "World generation request failed");
  res.status(status).json({ error: message });
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export default router;
