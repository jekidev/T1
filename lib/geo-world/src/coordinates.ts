import { CoordinatesSchema, GeoBoundsSchema, type Coordinates, type GeoBounds } from "./types";

const EARTH_RADIUS_METERS = 6_378_137;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface LocalPosition {
  x: number;
  y: number;
  z: number;
}

export function normalizeCoordinates(input: unknown): Coordinates {
  const coordinates = CoordinatesSchema.parse(input);
  return {
    latitude: clamp(coordinates.latitude, -90, 90),
    longitude: normalizeLongitude(coordinates.longitude),
    altitude: coordinates.altitude,
  };
}

export function normalizeBounds(input: unknown): GeoBounds {
  return GeoBoundsSchema.parse(input);
}

export function geoToLocal(coordinatesInput: Coordinates, originInput: Coordinates): LocalPosition {
  const coordinates = normalizeCoordinates(coordinatesInput);
  const origin = normalizeCoordinates(originInput);
  const originLatitudeRadians = origin.latitude * DEG_TO_RAD;
  const deltaLatitude = (coordinates.latitude - origin.latitude) * DEG_TO_RAD;
  const deltaLongitude = shortestLongitudeDelta(origin.longitude, coordinates.longitude) * DEG_TO_RAD;

  return {
    x: deltaLongitude * Math.cos(originLatitudeRadians) * EARTH_RADIUS_METERS,
    y: coordinates.altitude - origin.altitude,
    z: deltaLatitude * EARTH_RADIUS_METERS,
  };
}

export function localToGeo(position: LocalPosition, originInput: Coordinates): Coordinates {
  const origin = normalizeCoordinates(originInput);
  const latitude = origin.latitude + (position.z / EARTH_RADIUS_METERS) * RAD_TO_DEG;
  const cosLatitude = Math.cos(origin.latitude * DEG_TO_RAD);
  if (Math.abs(cosLatitude) < 1e-9) throw new Error("Local longitude conversion is unstable at the poles.");
  const longitude = origin.longitude + (position.x / (EARTH_RADIUS_METERS * cosLatitude)) * RAD_TO_DEG;
  return normalizeCoordinates({
    latitude,
    longitude,
    altitude: origin.altitude + position.y,
  });
}

export function distanceMeters(aInput: Coordinates, bInput: Coordinates): number {
  const a = normalizeCoordinates(aInput);
  const b = normalizeCoordinates(bInput);
  const latitude1 = a.latitude * DEG_TO_RAD;
  const latitude2 = b.latitude * DEG_TO_RAD;
  const deltaLatitude = (b.latitude - a.latitude) * DEG_TO_RAD;
  const deltaLongitude = shortestLongitudeDelta(a.longitude, b.longitude) * DEG_TO_RAD;
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function boundsCenter(boundsInput: GeoBounds): Coordinates {
  const bounds = normalizeBounds(boundsInput);
  return {
    latitude: (bounds.south + bounds.north) / 2,
    longitude: (bounds.west + bounds.east) / 2,
    altitude: 0,
  };
}

export function boundsAreaSquareKilometers(boundsInput: GeoBounds): number {
  const bounds = normalizeBounds(boundsInput);
  const southWest: Coordinates = { latitude: bounds.south, longitude: bounds.west, altitude: 0 };
  const northWest: Coordinates = { latitude: bounds.north, longitude: bounds.west, altitude: 0 };
  const southEast: Coordinates = { latitude: bounds.south, longitude: bounds.east, altitude: 0 };
  const height = distanceMeters(southWest, northWest);
  const width = distanceMeters(southWest, southEast);
  return (height * width) / 1_000_000;
}

export function pointInBounds(pointInput: Coordinates, boundsInput: GeoBounds): boolean {
  const point = normalizeCoordinates(pointInput);
  const bounds = normalizeBounds(boundsInput);
  return point.latitude >= bounds.south
    && point.latitude <= bounds.north
    && point.longitude >= bounds.west
    && point.longitude <= bounds.east;
}

export function coordinateKey(coordinatesInput: Coordinates, precision = 6): string {
  const coordinates = normalizeCoordinates(coordinatesInput);
  return `${coordinates.latitude.toFixed(precision)},${coordinates.longitude.toFixed(precision)},${coordinates.altitude.toFixed(2)}`;
}

function shortestLongitudeDelta(from: number, to: number): number {
  let delta = normalizeLongitude(to) - normalizeLongitude(from);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function normalizeLongitude(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 && value > 0 ? 180 : normalized;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
