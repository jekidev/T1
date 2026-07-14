# Geospatial world, public places and fog of war

## Current implementation

This branch now contains the first functional geospatial milestone:

```text
bounded WGS84 area
→ server-built Overpass query
→ public OSM features
→ privacy-safe category mapping
→ deterministic world chunks
→ persistent world region
→ tactical vector preview
→ click placement
→ server validation
→ persistent versioned placement
```

Implemented modules:

- `@workspace/geo-world`
- `POST /api/world/regions/import-osm`
- `GET /api/world/regions`
- `GET /api/world/regions/:id`
- `POST /api/world/locations/validate-role`
- `POST /api/world/assets/validate-placement`
- `GET /api/world/assets/placements`
- `POST /api/world/assets/placements`
- `DELETE /api/world/assets/placements/:id`
- `POST /api/mcp/tools/search_osm_features`
- `POST /api/mcp/tools/generate_world_region`
- `/geo-lab`

The current tactical preview is an adapter-neutral SVG vector renderer. It deliberately avoids introducing another external dependency while the branch lockfile is already pending regeneration. MapLibre is the next tactical-map adapter, not a replacement for the geospatial domain layer.

## Data-source boundary

The editable game world uses open or explicitly licensed geographic data.

```text
OpenStreetMap / Overpass
→ roads, buildings, land use and public POIs

Google Places, optional server adapter
→ current public business/place metadata

Game world generator
→ fictional gameplay roles
```

The project does not download, scrape or convert Google Earth buildings, photogrammetry or textures into permanent assets.

Officially streamed photorealistic tiles may later be added as an external visual source under provider terms. They must remain distinct from editable world assets.

## Public category versus gameplay role

The core safety boundary is represented by two separate records:

```ts
interface ImportedPlace {
  sourceId: string
  source: "osm" | "google_places"
  publicCategory: string
  name?: string
  coordinates: Coordinates
  geometry?: GeoJsonGeometry
  publicTags: Record<string, string>
}

interface GameplayLocationRole {
  placeId: string
  role:
    | "business"
    | "residence"
    | "warehouse"
    | "safehouse"
    | "stashhouse"
    | "hospital"
    | "police"
    | "social_hub"
  fictionalized: boolean
  assignedBy: "generator" | "scenario" | "player"
}
```

Rules enforced by code:

- OSM queries use a fixed public-category allowlist.
- Address, phone and contact tags are not copied into imported place records.
- Names are removed from residential building records.
- `safehouse` and `stashhouse` are never derived from OSM tags.
- Fiction-only roles require `fictionalized: true`.
- A real residential feature cannot be assigned `safehouse` or `stashhouse`.
- Public category remains unchanged when a separate scenario role is validated.

## Coordinate system

The domain layer uses:

- WGS84 latitude/longitude/altitude for persistence and external data
- a local tangent-plane approximation for gameplay and rendering
- x = east
- y = altitude
- z = north

Functions:

```ts
geoToLocal(coordinates, origin)
localToGeo(position, origin)
distanceMeters(a, b)
pointInBounds(point, bounds)
```

This keeps game transforms compact while preserving a stable geographic anchor.

## OpenStreetMap / Overpass importer

Supported public query categories:

- roads
- buildings
- land use
- restaurant
- shop
- hospital
- school
- cafe
- office
- warehouse
- parking
- station
- pharmacy
- park
- police

The client does not accept raw OverpassQL from the browser or LLM. It builds queries from validated bounds and whitelisted categories.

Operational controls:

- maximum area
- maximum response bytes
- request timeout
- minimum interval between requests
- in-memory result cache
- bounded cache size
- fixed administrator-configured endpoints
- HTTPS requirement, except localhost development
- no endpoint credentials in URLs
- OpenTelemetry `game.world.import` span

## World chunks

World chunks use deterministic slippy-map tile coordinates:

```text
zoom/x/y
```

Each chunk stores:

```ts
interface WorldChunk {
  id: string
  bounds: GeoBounds
  lod: number
  state: "unloaded" | "loading" | "loaded" | "sleeping"
  assetIds: string[]
  npcIds: string[]
}
```

`selectStreamingChunks` distinguishes visible and nearby sleeping chunks. This is the basis for later MapLibre, 3D Tiles and Three.js streaming adapters.

## Authoritative asset placement

Placement records include both geographic and local coordinates:

```ts
interface PlacedWorldAsset {
  id: string
  assetId: string
  geoPosition: Coordinates
  localTransform: {
    position: [number, number, number]
    rotation: [number, number, number, number]
    scale: [number, number, number]
  }
  gameRole?: string
  placedBy: string
  createdAt: string
  version: number
}
```

Server validation checks:

- position is inside the saved region
- altitude range
- maximum scale
- asset is a built-in world marker or a published asset-manifest entry
- gameplay placement role allowlist
- optimistic version increment

The current built-in assets are:

```text
builtin:map-marker
builtin:vision-beacon
```

Generated assets become placeable only after license review, validation and publication into the game asset manifest.

## Fog of war

The strategy simulation now exposes `exportFactionView` instead of requiring clients to receive the full authoritative snapshot.

A faction view contains:

- visible friendly entities
- detected enemy entities
- stale memory for previously observed static entities
- omitted entity IDs for server diagnostics
- updated faction memory

Dynamic enemy units outside vision are omitted entirely. Hidden units may remain omitted even inside ordinary vision. Static buildings, territories and resources may be returned as old snapshots after they leave vision.

The full simulation snapshot, pending commands and event log must remain server-side in multiplayer deployments.

## Repository evaluation

| Repository | Intended role | Current branch status |
|---|---|---|
| `OSM2World/OSM2World` | Offline OSM-to-3D conversion worker | adapter contract planned; not vendored |
| `CesiumGS/cesium` | terrain, global coordinates and large-area streaming | evaluated for later terrain adapter |
| `NASA-AMMOS/3DTilesRendererJS` | direct 3D Tiles rendering in Three.js/R3F | preferred Three.js tiles adapter |
| `maplibre/maplibre-gl-js` | tactical 2D/2.5D map | next frontend renderer adapter |
| `visgl/deck.gl` | high-volume overlays and heatmaps | optional analytics layer |
| `Turfjs/turf` | advanced polygon and buffer operations | domain API designed so Turf can replace simple geometry functions |
| `openstreetmap/overpass` | bounded public geographic import | integrated through native server client |
| `googlemaps/google-maps-services-js` | optional public Places/geocoding MCP | not enabled; server-only design retained |
| `yjs/yjs` | collaborative editor state | next editor phase |
| `colyseus/colyseus` | authoritative multiplayer placement and commands | next multiplayer phase |
| `ondras/rot.js` | grid FOV reference | optional for grid scenes |
| `mourner/rbush` | fast 2D spatial index | next large-world optimization |
| `gkjohnson/three-mesh-bvh` | terrain/building raycasts | graphics-branch integration |
| `a16z-infra/ai-town` | social-agent architecture reference | NPC phase reference, not embedded runtime |
| `joonspk-research/generative_agents` | memory/reflection/planning reference | NPC memory phase reference |
| `Mugen87/yuka` | goals, perception and steering | planned adapter between NPC planning and commands |
| `nikkorn/mistreevous` | deterministic behavior trees | planned NPC action layer |
| `tdlib/telegram-bot-api` | official Telegram bot service | optional messaging service |
| `grammyjs/grammY` | TypeScript Telegram Bot API adapter | preferred Telegram application adapter |
| `telegraf/telegraf` | alternate Telegram adapter | fallback evaluation |
| `AsamK/signal-cli` | user-owned Signal linked device | optional isolated service |
| `bbernhard/signal-cli-rest-api` | Signal REST boundary | optional deployment adapter |
| `statelyai/xstate` | status workflows | optional character-status UI/state adapter |
| `colinhacks/zod` | schema validation | already used across the project |
| `immerjs/immer` | immutable command updates | optional UI/editor helper |
| `d3/d3` | status and history visualization | optional analytics adapter |

None of these repositories should be copied wholesale into the frontend. Each external runtime receives a narrow adapter and explicit authority boundary.

## Next implementation order

1. Regenerate the pnpm lockfile and make current CI executable.
2. Add MapLibre tactical renderer behind the existing geospatial contracts.
3. Connect Three.js/R3F terrain and asset raycasting from the graphics branch.
4. Add OSM2World as an isolated conversion worker that emits GLB/3D Tiles.
5. Add spatial indexing and chunk streaming persistence.
6. Add Colyseus authoritative rooms and Yjs editor documents.
7. Add deterministic NPC roles and schedules.
8. Add generative memory/dialogue only for high-value events.
9. Add opt-in Telegram Bot integration.
10. Add optional Signal linked-device service.
