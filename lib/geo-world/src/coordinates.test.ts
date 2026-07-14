import test from "node:test";
import assert from "node:assert/strict";
import { boundsAreaSquareKilometers, distanceMeters, geoToLocal, localToGeo } from "./coordinates";

void test("geo and local coordinates round trip around Copenhagen", () => {
  const origin = { latitude: 55.6761, longitude: 12.5683, altitude: 7 };
  const point = { latitude: 55.6812, longitude: 12.5774, altitude: 19 };
  const local = geoToLocal(point, origin);
  const restored = localToGeo(local, origin);

  assert.ok(Math.abs(restored.latitude - point.latitude) < 1e-8);
  assert.ok(Math.abs(restored.longitude - point.longitude) < 1e-8);
  assert.ok(Math.abs(restored.altitude - point.altitude) < 1e-8);
});

void test("distance calculation is deterministic", () => {
  const distance = distanceMeters(
    { latitude: 55.6761, longitude: 12.5683, altitude: 0 },
    { latitude: 55.6861, longitude: 12.5683, altitude: 0 },
  );
  assert.ok(distance > 1_100 && distance < 1_120);
});

void test("bounds area reports plausible square kilometers", () => {
  const area = boundsAreaSquareKilometers({ south: 55.67, west: 12.55, north: 55.68, east: 12.57 });
  assert.ok(area > 1 && area < 2);
});
