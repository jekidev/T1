import { createHash } from "node:crypto";
import {
  buildOverpassQuery,
  chunksForBounds,
  overpassRequestSummary,
  parseOverpassResponse,
  type OverpassImportRequest,
  type OverpassResponse,
  type PublicOsmCategory,
} from "@workspace/geo-world";
import { withSpan } from "./telemetry";

export interface ImportedWorldRegion {
  id: string;
  importedAt: string;
  source: "openstreetmap-overpass";
  attribution: string;
  endpointHost: string;
  categories: PublicOsmCategory[];
  bounds: OverpassImportRequest["bounds"];
  center: ReturnType<typeof overpassRequestSummary>["center"];
  areaSquareKilometers: number;
  features: ReturnType<typeof parseOverpassResponse>;
  chunks: ReturnType<typeof chunksForBounds>;
  osmBaseTimestamp?: string;
}

interface CacheRecord {
  expiresAt: number;
  value: ImportedWorldRegion;
}

const cache = new Map<string, CacheRecord>();
let lastRequestAt = 0;
let requestChain: Promise<void> = Promise.resolve();

export async function importWorldRegionFromOverpass(input: OverpassImportRequest & { chunkZoom?: number }): Promise<ImportedWorldRegion> {
  const maximumArea = positiveNumber(process.env.WORLD_IMPORT_MAX_AREA_KM2, 100);
  const request: OverpassImportRequest = {
    bounds: input.bounds,
    categories: input.categories,
    maximumAreaSquareKilometers: Math.min(input.maximumAreaSquareKilometers ?? maximumArea, maximumArea),
  };
  const query = buildOverpassQuery(request);
  const summary = overpassRequestSummary(request);
  const chunkZoom = integerInRange(input.chunkZoom ?? 15, 0, 24, "chunkZoom");
  const key = createHash("sha256").update(JSON.stringify({ query, chunkZoom })).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.value);

  return withSpan("game.world.import", {
    "world.source": "openstreetmap-overpass",
    "world.area_km2": summary.areaSquareKilometers,
    "world.category_count": summary.categories.length,
    "world.chunk_zoom": chunkZoom,
  }, async span => {
    const endpoints = configuredEndpoints();
    let lastError: unknown;
    for (const endpoint of endpoints) {
      try {
        const response = await scheduledFetch(endpoint, query);
        const features = parseOverpassResponse(response);
        const chunks = chunksForBounds(request.bounds, chunkZoom, positiveNumber(process.env.WORLD_IMPORT_MAX_CHUNKS, 400));
        const value: ImportedWorldRegion = {
          id: `osm-region-${key.slice(0, 24)}`,
          importedAt: new Date().toISOString(),
          source: "openstreetmap-overpass",
          attribution: "© OpenStreetMap contributors",
          endpointHost: new URL(endpoint).host,
          categories: summary.categories,
          bounds: request.bounds,
          center: summary.center,
          areaSquareKilometers: summary.areaSquareKilometers,
          features,
          chunks,
          ...(response.osm3s?.timestamp_osm_base ? { osmBaseTimestamp: response.osm3s.timestamp_osm_base } : {}),
        };
        span.setAttribute("world.feature_count", features.length);
        span.setAttribute("world.chunk_count", chunks.length);
        span.setAttribute("world.endpoint_host", value.endpointHost);
        cache.set(key, {
          expiresAt: Date.now() + positiveNumber(process.env.OVERPASS_CACHE_TTL_MS, 10 * 60 * 1_000),
          value,
        });
        pruneCache();
        return structuredClone(value);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("All configured Overpass endpoints failed.");
  });
}

async function scheduledFetch(endpoint: string, query: string): Promise<OverpassResponse> {
  let release: (() => void) | undefined;
  const previous = requestChain;
  requestChain = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const minimumInterval = positiveNumber(process.env.OVERPASS_MIN_REQUEST_INTERVAL_MS, 1_500);
    const wait = Math.max(0, minimumInterval - (Date.now() - lastRequestAt));
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return await fetchOverpass(endpoint, query);
  } finally {
    release?.();
  }
}

async function fetchOverpass(endpoint: string, query: string): Promise<OverpassResponse> {
  const url = validateEndpoint(endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), positiveNumber(process.env.OVERPASS_TIMEOUT_MS, 35_000));
  try {
    const body = new URLSearchParams({ data: query });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "accept": "application/json",
        "user-agent": overpassUserAgent(),
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass ${url.host} returned HTTP ${response.status}.`);
    const maximumBytes = positiveNumber(process.env.OVERPASS_MAX_RESPONSE_BYTES, 25 * 1024 * 1024);
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > maximumBytes) throw new Error("Overpass response exceeds configured byte limit.");
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maximumBytes) throw new Error("Overpass response exceeds configured byte limit.");
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { elements?: unknown }).elements)) {
      throw new Error("Overpass response is not a valid elements document.");
    }
    return parsed as OverpassResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function configuredEndpoints(): string[] {
  const raw = process.env.OVERPASS_API_URLS ?? process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter";
  const endpoints = [...new Set(raw.split(",").map(value => value.trim()).filter(Boolean))];
  if (endpoints.length === 0) throw new Error("No Overpass endpoint is configured.");
  return endpoints.map(endpoint => validateEndpoint(endpoint).toString());
}

function validateEndpoint(value: string): URL {
  const url = new URL(value);
  const localhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
    throw new Error("Overpass endpoints must use HTTPS, except localhost development endpoints.");
  }
  if (url.username || url.password) throw new Error("Overpass endpoint URLs cannot contain credentials.");
  url.hash = "";
  return url;
}

function overpassUserAgent(): string {
  const contact = process.env.OVERPASS_CONTACT?.trim();
  return contact
    ? `Operation-Kobenhavn/1.0 (${contact.slice(0, 200)})`
    : "Operation-Kobenhavn/1.0";
}

function pruneCache(): void {
  const now = Date.now();
  for (const [key, record] of cache) {
    if (record.expiresAt <= now) cache.delete(key);
  }
  const maximumEntries = positiveNumber(process.env.OVERPASS_CACHE_MAX_ENTRIES, 100);
  while (cache.size > maximumEntries) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function positiveNumber(raw: string | number | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function integerInRange(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
