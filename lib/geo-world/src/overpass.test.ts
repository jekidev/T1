import test from "node:test";
import assert from "node:assert/strict";
import { buildOverpassQuery, parseOverpassResponse } from "./overpass";

void test("Overpass query uses only whitelisted public categories", () => {
  const query = buildOverpassQuery({
    bounds: { south: 55.67, west: 12.55, north: 55.68, east: 12.57 },
    categories: ["restaurant", "hospital", "roads", "buildings"],
  });
  assert.match(query, /amenity"="restaurant/);
  assert.match(query, /amenity"="hospital/);
  assert.match(query, /way\["highway"\]/);
  assert.match(query, /way\["building"\]/);
  assert.doesNotMatch(query, /stashhouse|safehouse/i);
});

void test("large Overpass regions are rejected before network use", () => {
  assert.throws(() => buildOverpassQuery({
    bounds: { south: 55, west: 11, north: 57, east: 14 },
    categories: ["buildings"],
    maximumAreaSquareKilometers: 100,
  }), /maximum is 100/);
});

void test("OSM parsing strips residential names and private address tags", () => {
  const places = parseOverpassResponse({
    elements: [
      {
        type: "way",
        id: 1,
        center: { lat: 55.676, lon: 12.568 },
        tags: {
          building: "residential",
          name: "Private Home Name",
          "addr:housenumber": "10",
          "addr:street": "Private Street",
        },
      },
      {
        type: "node",
        id: 2,
        lat: 55.677,
        lon: 12.569,
        tags: { amenity: "cafe", name: "Public Café", phone: "+45 00000000" },
      },
    ],
  });

  assert.equal(places[0]?.publicCategory, "residence");
  assert.equal(places[0]?.name, undefined);
  assert.deepEqual(places[0]?.publicTags, { building: "residential" });
  assert.equal(places[1]?.publicCategory, "cafe");
  assert.equal(places[1]?.name, "Public Café");
  assert.equal(places[1]?.publicTags.phone, undefined);
});
