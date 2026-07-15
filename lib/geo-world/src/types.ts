import { z } from "zod";

export const CoordinatesSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  altitude: z.number().finite().min(-12_000).max(100_000).default(0),
});

export const GeoBoundsSchema = z.object({
  south: z.number().finite().min(-90).max(90),
  west: z.number().finite().min(-180).max(180),
  north: z.number().finite().min(-90).max(90),
  east: z.number().finite().min(-180).max(180),
}).superRefine((bounds, context) => {
  if (bounds.south >= bounds.north) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["south"], message: "south must be lower than north" });
  }
  if (bounds.west >= bounds.east) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["west"], message: "west must be lower than east" });
  }
});

export const LocalTransformSchema = z.object({
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  rotation: z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]),
  scale: z.tuple([z.number().finite().positive(), z.number().finite().positive(), z.number().finite().positive()]),
});

export const GeoJsonGeometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(), z.number()]) }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1) }),
]);

export const ImportedPlaceSchema = z.object({
  sourceId: z.string().min(1).max(180),
  source: z.enum(["osm", "google_places"]),
  publicCategory: z.string().min(1).max(100),
  name: z.string().min(1).max(300).optional(),
  coordinates: CoordinatesSchema,
  geometry: GeoJsonGeometrySchema.optional(),
  publicTags: z.record(z.string().max(100), z.string().max(500)).default({}),
});

export const GameplayLocationRoleNameSchema = z.enum([
  "business",
  "residence",
  "warehouse",
  "safehouse",
  "stashhouse",
  "hospital",
  "police",
  "social_hub",
]);

export const GameplayLocationRoleSchema = z.object({
  placeId: z.string().min(1).max(180),
  role: GameplayLocationRoleNameSchema,
  fictionalized: z.boolean(),
  assignedBy: z.enum(["generator", "scenario", "player"]),
});

export const PlacedWorldAssetSchema = z.object({
  id: z.string().min(1).max(180),
  assetId: z.string().min(1).max(180),
  geoPosition: CoordinatesSchema,
  localTransform: LocalTransformSchema,
  gameRole: z.string().min(1).max(100).optional(),
  placedBy: z.string().min(1).max(180),
  createdAt: z.string().datetime(),
  version: z.number().int().positive(),
});

export const VisibilityStateSchema = z.enum(["unexplored", "explored", "currently_visible"]);

export const VisionSourceSchema = z.object({
  id: z.string().min(1).max(180),
  factionId: z.string().min(1).max(180),
  coordinates: CoordinatesSchema,
  radiusMeters: z.number().finite().positive().max(100_000),
  heightMeters: z.number().finite().min(0).max(10_000).default(1.7),
  detectsHidden: z.boolean().default(false),
});

export const ExplorationCellSchema = z.object({
  cellId: z.string().min(1).max(180),
  bounds: GeoBoundsSchema,
  exploredBy: z.array(z.string().min(1).max(180)),
  visibleBy: z.array(z.string().min(1).max(180)),
  lastObservedTick: z.number().int().nonnegative(),
});

export const WorldChunkSchema = z.object({
  id: z.string().min(1).max(180),
  bounds: GeoBoundsSchema,
  lod: z.number().int().min(0).max(24),
  state: z.enum(["unloaded", "loading", "loaded", "sleeping"]),
  assetIds: z.array(z.string().min(1).max(180)),
  npcIds: z.array(z.string().min(1).max(180)),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type GeoBounds = z.infer<typeof GeoBoundsSchema>;
export type LocalTransform = z.infer<typeof LocalTransformSchema>;
export type GeoJsonGeometry = z.infer<typeof GeoJsonGeometrySchema>;
export type ImportedPlace = z.infer<typeof ImportedPlaceSchema>;
export type GameplayLocationRoleName = z.infer<typeof GameplayLocationRoleNameSchema>;
export type GameplayLocationRole = z.infer<typeof GameplayLocationRoleSchema>;
export type PlacedWorldAsset = z.infer<typeof PlacedWorldAssetSchema>;
export type VisibilityState = z.infer<typeof VisibilityStateSchema>;
export type VisionSource = z.infer<typeof VisionSourceSchema>;
export type ExplorationCell = z.infer<typeof ExplorationCellSchema>;
export type WorldChunk = z.infer<typeof WorldChunkSchema>;
