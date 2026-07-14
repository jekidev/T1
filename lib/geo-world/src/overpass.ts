import { boundsAreaSquareKilometers, boundsCenter, normalizeBounds } from "./coordinates";
import {
  ImportedPlaceSchema,
  type Coordinates,
  type GeoBounds,
  type GeoJsonGeometry,
  type ImportedPlace,
} from "./types";

export const PUBLIC_OSM_CATEGORIES = [
  "roads",
  "buildings",
  "landuse",
  "restaurant",
  "shop",
  "hospital",
  "school",
  "cafe",
  "office",
  "warehouse",
  "parking",
  "station",
  "pharmacy",
  "park",
  "police",
] as const;

export type PublicOsmCategory = typeof PUBLIC_OSM_CATEGORIES[number];

export interface OverpassImportRequest {
  bounds: GeoBounds;
  categories: PublicOsmCategory[];
  maximumAreaSquareKilometers?: number;
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassElement[];
  osm3s?: {
    timestamp_osm_base?: string;
    copyright?: string;
  };
}

const CATEGORY_SELECTORS: Record<PublicOsmCategory, readonly string[]> = {
  roads: ['way["highway"]'],
  buildings: ['way["building"]', 'relation["building"]'],
  landuse: ['way["landuse"]', 'relation["landuse"]'],
  restaurant: ['nwr["amenity"="restaurant"]'],
  shop: ['nwr["shop"]'],
  hospital: ['nwr["amenity"="hospital"]'],
  school: ['nwr["amenity"="school"]'],
  cafe: ['nwr["amenity"="cafe"]'],
  office: ['nwr["office"]'],
  warehouse: ['nwr["building"="warehouse"]'],
  parking: ['nwr["amenity"="parking"]'],
  station: ['nwr["public_transport"="station"]', 'nwr["railway"="station"]'],
  pharmacy: ['nwr["amenity"="pharmacy"]'],
  park: ['nwr["leisure"="park"]'],
  police: ['nwr["amenity"="police"]'],
};

const PUBLIC_TAG_ALLOWLIST = new Set([
  "name",
  "amenity",
  "shop",
  "office",
  "building",
  "building:levels",
  "height",
  "highway",
  "landuse",
  "public_transport",
  "railway",
  "tourism",
  "leisure",
  "opening_hours",
  "operator",
  "brand",
]);

const RESIDENTIAL_BUILDINGS = new Set([
  "apartments",
  "bungalow",
  "cabin",
  "detached",
  "dormitory",
  "farm",
  "ger",
  "house",
  "houseboat",
  "residential",
  "semidetached_house",
  "static_caravan",
  "terrace",
]);

export function buildOverpassQuery(input: OverpassImportRequest): string {
  const bounds = normalizeBounds(input.bounds);
  const maximumArea = input.maximumAreaSquareKilometers ?? 100;
  const area = boundsAreaSquareKilometers(bounds);
  if (area > maximumArea) {
    throw new Error(`Requested map area is ${area.toFixed(2)} km²; maximum is ${maximumArea} km².`);
  }
  const categories = [...new Set(input.categories)];
  if (categories.length === 0) throw new Error("At least one public OSM category is required.");
  for (const category of categories) {
    if (!PUBLIC_OSM_CATEGORIES.includes(category)) throw new Error(`Unsupported OSM category: ${category}`);
  }

  const bbox = `${formatCoordinate(bounds.south)},${formatCoordinate(bounds.west)},${formatCoordinate(bounds.north)},${formatCoordinate(bounds.east)}`;
  const selectors = categories.flatMap(category => CATEGORY_SELECTORS[category]).map(selector => `  ${selector}(${bbox});`);
  return [
    "[out:json][timeout:25];",
    "(",
    ...selectors,
    ");",
    "out center tags geom;",
  ].join("\n");
}

export function parseOverpassResponse(input: unknown): ImportedPlace[] {
  const response = asOverpassResponse(input);
  const places: ImportedPlace[] = [];
  const seen = new Set<string>();

  for (const element of response.elements) {
    const coordinates = elementCoordinates(element);
    if (!coordinates) continue;
    const tags = element.tags ?? {};
    const publicCategory = classifyPublicCategory(tags, element.type);
    if (!publicCategory) continue;
    const sourceId = `osm:${element.type}:${element.id}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const residential = publicCategory === "residence";
    const publicTags = sanitizePublicTags(tags);
    const geometry = toGeoJsonGeometry(element, coordinates);
    const name = !residential && typeof tags.name === "string" && tags.name.trim()
      ? tags.name.trim().slice(0, 300)
      : undefined;

    places.push(ImportedPlaceSchema.parse({
      sourceId,
      source: "osm",
      publicCategory,
      ...(name ? { name } : {}),
      coordinates,
      ...(geometry ? { geometry } : {}),
      publicTags,
    }));
  }

  return places.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

export function classifyPublicCategory(tags: Record<string, string>, elementType: OverpassElement["type"]): string | undefined {
  const amenity = tags.amenity;
  if (amenity === "restaurant") return "restaurant";
  if (amenity === "hospital") return "hospital";
  if (amenity === "school") return "school";
  if (amenity === "cafe") return "cafe";
  if (amenity === "parking") return "parking";
  if (amenity === "pharmacy") return "pharmacy";
  if (amenity === "police") return "police";
  if (tags.public_transport === "station" || tags.railway === "station") return "station";
  if (tags.shop) return "shop";
  if (tags.office) return "office";
  if (tags.leisure === "park") return "park";
  if (tags.building === "warehouse") return "warehouse";
  if (tags.building && RESIDENTIAL_BUILDINGS.has(tags.building)) return "residence";
  if (tags.building) return "building";
  if (tags.highway && elementType === "way") return "road";
  if (tags.landuse) return "landuse";
  return undefined;
}

export function sanitizePublicTags(tags: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (!PUBLIC_TAG_ALLOWLIST.has(key)) continue;
    if (key === "name" && isResidentialBuilding(tags)) continue;
    output[key] = value.slice(0, 500);
  }
  return output;
}

function asOverpassResponse(input: unknown): OverpassResponse {
  if (!input || typeof input !== "object") throw new Error("Overpass response must be an object.");
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.elements)) throw new Error("Overpass response has no elements array.");
  return { elements: value.elements as OverpassElement[], ...(value.osm3s && typeof value.osm3s === "object" ? { osm3s: value.osm3s as OverpassResponse["osm3s"] } : {}) };
}

function elementCoordinates(element: OverpassElement): Coordinates | undefined {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { latitude: element.lat!, longitude: element.lon!, altitude: 0 };
  }
  if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) {
    return { latitude: element.center.lat, longitude: element.center.lon, altitude: 0 };
  }
  if (Array.isArray(element.geometry) && element.geometry.length > 0) {
    const latitude = element.geometry.reduce((sum, point) => sum + point.lat, 0) / element.geometry.length;
    const longitude = element.geometry.reduce((sum, point) => sum + point.lon, 0) / element.geometry.length;
    return { latitude, longitude, altitude: 0 };
  }
  return undefined;
}

function toGeoJsonGeometry(element: OverpassElement, fallback: Coordinates): GeoJsonGeometry | undefined {
  const geometry = element.geometry?.filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (!geometry || geometry.length === 0) {
    return { type: "Point", coordinates: [fallback.longitude, fallback.latitude] };
  }
  const coordinates = geometry.map(point => [point.lon, point.lat] as [number, number]);
  if (coordinates.length >= 4 && sameCoordinate(coordinates[0]!, coordinates.at(-1)!)) {
    return { type: "Polygon", coordinates: [coordinates] };
  }
  if (coordinates.length >= 2) return { type: "LineString", coordinates };
  return { type: "Point", coordinates: coordinates[0]! };
}

function isResidentialBuilding(tags: Record<string, string>): boolean {
  return Boolean(tags.building && RESIDENTIAL_BUILDINGS.has(tags.building));
}

function sameCoordinate(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;
}

function formatCoordinate(value: number): string {
  return value.toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
}

export function defaultBoundsAround(center: Coordinates, radiusKilometers: number): GeoBounds {
  if (!Number.isFinite(radiusKilometers) || radiusKilometers <= 0 || radiusKilometers > 50) {
    throw new Error("Radius must be between 0 and 50 kilometers.");
  }
  const latitudeDelta = radiusKilometers / 111.32;
  const longitudeScale = Math.max(0.01, Math.cos(center.latitude * Math.PI / 180));
  const longitudeDelta = radiusKilometers / (111.32 * longitudeScale);
  return normalizeBounds({
    south: center.latitude - latitudeDelta,
    west: center.longitude - longitudeDelta,
    north: center.latitude + latitudeDelta,
    east: center.longitude + longitudeDelta,
  });
}

export function overpassRequestSummary(request: OverpassImportRequest): { center: Coordinates; areaSquareKilometers: number; categories: PublicOsmCategory[] } {
  const bounds = normalizeBounds(request.bounds);
  return {
    center: boundsCenter(bounds),
    areaSquareKilometers: boundsAreaSquareKilometers(bounds),
    categories: [...new Set(request.categories)],
  };
}
