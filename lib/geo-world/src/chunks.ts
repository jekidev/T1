import { GeoBoundsSchema, WorldChunkSchema, type Coordinates, type GeoBounds, type WorldChunk } from "./types";

export interface TileCoordinate {
  x: number;
  y: number;
  zoom: number;
}

export function coordinateToTile(coordinates: Coordinates, zoom: number): TileCoordinate {
  validateZoom(zoom);
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, coordinates.latitude));
  const longitude = normalizeLongitude(coordinates.longitude);
  const scale = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * scale);
  const latitudeRadians = latitude * Math.PI / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * scale);
  return { x: clampTileIndex(x, scale), y: clampTileIndex(y, scale), zoom };
}

export function tileBounds(tile: TileCoordinate): GeoBounds {
  validateZoom(tile.zoom);
  const scale = 2 ** tile.zoom;
  if (!Number.isInteger(tile.x) || !Number.isInteger(tile.y) || tile.x < 0 || tile.y < 0 || tile.x >= scale || tile.y >= scale) {
    throw new Error("Invalid tile coordinate.");
  }
  const west = tile.x / scale * 360 - 180;
  const east = (tile.x + 1) / scale * 360 - 180;
  const north = tileYToLatitude(tile.y, scale);
  const south = tileYToLatitude(tile.y + 1, scale);
  return GeoBoundsSchema.parse({ south, west, north, east });
}

export function chunkId(tile: TileCoordinate): string {
  return `${tile.zoom}/${tile.x}/${tile.y}`;
}

export function createWorldChunk(tile: TileCoordinate, state: WorldChunk["state"] = "unloaded"): WorldChunk {
  return WorldChunkSchema.parse({
    id: chunkId(tile),
    bounds: tileBounds(tile),
    lod: tile.zoom,
    state,
    assetIds: [],
    npcIds: [],
  });
}

export function chunksForBounds(boundsInput: GeoBounds, zoom: number, maximumChunks = 400): WorldChunk[] {
  const bounds = GeoBoundsSchema.parse(boundsInput);
  validateZoom(zoom);
  const northWest = coordinateToTile({ latitude: bounds.north, longitude: bounds.west, altitude: 0 }, zoom);
  const southEast = coordinateToTile({ latitude: bounds.south, longitude: bounds.east, altitude: 0 }, zoom);
  const count = (southEast.x - northWest.x + 1) * (southEast.y - northWest.y + 1);
  if (count > maximumChunks) throw new Error(`World region requires ${count} chunks; maximum is ${maximumChunks}.`);

  const chunks: WorldChunk[] = [];
  for (let y = northWest.y; y <= southEast.y; y += 1) {
    for (let x = northWest.x; x <= southEast.x; x += 1) {
      chunks.push(createWorldChunk({ x, y, zoom }));
    }
  }
  return chunks;
}

export function selectStreamingChunks(
  center: Coordinates,
  zoom: number,
  visibleRadius = 1,
  nearbyRadius = 2,
): Array<WorldChunk & { priority: "visible" | "nearby"; distance: number }> {
  if (!Number.isInteger(visibleRadius) || !Number.isInteger(nearbyRadius) || visibleRadius < 0 || nearbyRadius < visibleRadius) {
    throw new Error("Chunk radii must be non-negative integers and nearbyRadius must be at least visibleRadius.");
  }
  const centerTile = coordinateToTile(center, zoom);
  const scale = 2 ** zoom;
  const output: Array<WorldChunk & { priority: "visible" | "nearby"; distance: number }> = [];

  for (let dy = -nearbyRadius; dy <= nearbyRadius; dy += 1) {
    for (let dx = -nearbyRadius; dx <= nearbyRadius; dx += 1) {
      const x = centerTile.x + dx;
      const y = centerTile.y + dy;
      if (x < 0 || y < 0 || x >= scale || y >= scale) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      output.push({
        ...createWorldChunk({ x, y, zoom }, distance <= visibleRadius ? "loaded" : "sleeping"),
        priority: distance <= visibleRadius ? "visible" : "nearby",
        distance,
      });
    }
  }

  return output.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}

function tileYToLatitude(y: number, scale: number): number {
  const mercator = Math.PI * (1 - 2 * y / scale);
  return Math.atan(Math.sinh(mercator)) * 180 / Math.PI;
}

function validateZoom(zoom: number): void {
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 24) throw new Error("Tile zoom must be an integer between 0 and 24.");
}

function clampTileIndex(value: number, scale: number): number {
  return Math.min(scale - 1, Math.max(0, value));
}

function normalizeLongitude(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
