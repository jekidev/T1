# T1 — Google Maps Denmark Streaming World Specification

## Objective

Transform T1 from an urban strategy simulator into a browser-based third-person RPG foundation covering all of Denmark geographically, while loading and rendering only the local area around the active player.

The project must remain operable from an Android phone through Devin AI, GitHub, Google Cloud and the already-connected Google Maps MCP/API.

## Non-negotiable requirements

1. Use the Google Maps MCP/API connection already configured in Devin.
2. Represent all of Denmark through a searchable/indexed geographic catalog.
3. Never render or keep all of Denmark in browser memory.
4. Load a maximum active radius of 1,000 metres around the player.
5. Unload distant map chunks as the player moves.
6. Preserve the existing T1 cards, flashcards, scenarios, RAG, LLM modes and game-state systems.
7. Integrate cards and scenarios as interactions inside the future third-person world.
8. Keep API keys and Google credentials outside GitHub.
9. Do not scrape or commit Google imagery, map tiles or protected Google map content.
10. Build and test for Android browsers first.

## Interpretation of “design all of Denmark”

All of Denmark must be addressable, searchable and dividable into deterministic world chunks. This does not mean generating every building and asset in advance.

The system must maintain a national metadata index containing:

- country and region bounds
- municipalities
- settlements and neighbourhoods
- roads and paths
- named places and points of interest
- coastline and water references
- player spawn locations
- quest locations
- world chunk IDs

Detailed scene data is requested only for chunks near the player.

## Streaming model

### Active radius

- Target active radius: 1,000 metres from player position.
- High-detail radius: 250 metres.
- Medium-detail radius: 250–600 metres.
- Low-detail/context radius: 600–1,000 metres.
- Hard unload threshold: 1,200 metres.

The extra unload margin prevents constant loading/unloading near a chunk boundary.

### Chunk grid

Use deterministic square chunks of 250 × 250 metres in a Denmark-specific projected coordinate system or a stable local-metre conversion.

Each chunk ID must be reproducible from position:

```text
dk:{gridX}:{gridY}
```

At a 1 km radius, only chunks intersecting the active circle are loaded. Do not fetch a simple 2 km square without filtering, because corner chunks may be outside the allowed radius.

### Chunk lifecycle

```text
UNLOADED
  -> REQUESTED
  -> FETCHING
  -> PARSED
  -> ACTIVE
  -> CACHED
  -> DISPOSED
```

Each chunk must support cancellation through AbortController when the player moves away before loading completes.

## Google Maps MCP/API responsibilities

Devin must use the connected Google Maps MCP/API for supported geographic lookups and validation, including where available:

- geocoding and reverse geocoding
- place search and place details
- roads and route-related validation
- elevation or terrain-related queries
- map display or tiles through approved Google APIs
- validating real Danish place names and coordinates

The implementation must isolate Google-specific logic behind adapters:

```text
packages/maps-core/
  GoogleMapsProvider
  WorldChunkProvider
  GeocoderProvider
  PlacesProvider
  ElevationProvider
```

Gameplay code must not directly call Google APIs.

## Runtime architecture

```text
Android browser
  -> T1 web client
  -> WorldStreamManager
  -> T1 map API on Google Cloud Run
  -> Google Maps services through server-side adapters where required
  -> cache/index storage
```

Browser-visible API keys must be strongly restricted by hostname and API. Server-side credentials must be stored in Google Secret Manager.

## Client world modules

Create or preserve modular systems:

```text
artifacts/command-sim/src/world/
  WorldStreamManager.ts
  ChunkGrid.ts
  ChunkCache.ts
  CoordinateSystem.ts
  LevelOfDetail.ts
  WorldOrigin.ts
  WorldTypes.ts

artifacts/command-sim/src/maps/
  GoogleMapAdapter.ts
  GeographicOverlay.ts
  MapDebugPanel.ts

artifacts/command-sim/src/gameplay/
  PlayerController.ts
  ThirdPersonCamera.ts
  InteractionSystem.ts
  QuestLocationSystem.ts
  CardEncounterBridge.ts
```

Adapt paths to the actual repository structure instead of creating duplicate applications.

## Server modules

```text
artifacts/api-server/src/maps/
  maps.routes.ts
  maps.service.ts
  google-maps.provider.ts
  chunk-cache.service.ts
  denmark-index.service.ts
  coordinate.service.ts
```

Required endpoints:

```text
GET /api/maps/chunks?lat={lat}&lng={lng}&radius=1000
GET /api/maps/chunks/{chunkId}
GET /api/maps/geocode?q={query}
GET /api/maps/reverse-geocode?lat={lat}&lng={lng}
GET /api/maps/places/nearby?lat={lat}&lng={lng}&radius={radius}
GET /api/maps/health
```

The server must reject radii above 1,000 metres for ordinary client chunk requests unless an authenticated administrative preprocessing job is being run.

## National Denmark index

Create a lightweight Denmark index that is safe to keep locally or in a database. It should contain references and metadata, not Google imagery.

Suggested shape:

```json
{
  "version": 1,
  "country": "DK",
  "bounds": {
    "north": 57.8,
    "south": 54.4,
    "east": 15.3,
    "west": 7.8
  },
  "regions": [],
  "municipalities": [],
  "settlements": [],
  "chunkIndex": {}
}
```

Exact coverage must include mainland Denmark and Danish islands. Do not include Greenland or the Faroe Islands unless explicitly enabled as separate world packs.

## Rendering strategy

The existing T1 interface must remain usable before the full third-person engine exists.

Implement incrementally:

1. Add a map/world debug page.
2. Show current player location and the active 1 km circle.
3. Show loaded chunk boundaries and lifecycle status.
4. Add a simple player marker/controller.
5. Add procedural low-cost world geometry.
6. Add third-person camera and mobile controls.
7. Connect locations to T1 cards, scenarios and quests.

For Android performance:

- cap device pixel ratio
- default to low quality
- use instancing
- avoid loading full-resolution assets outside 250 m
- dispose geometry, materials and textures when chunks unload
- limit shadows and dynamic lights
- cache parsed chunk data, not unlimited GPU objects
- expose FPS, memory estimate, active chunk count and request count

## Persistence and multiplayer preparation

Store canonical positions as latitude/longitude plus optional altitude. Local engine coordinates are temporary and derived from the current floating origin.

```ts
interface GeographicPosition {
  lat: number;
  lng: number;
  altitude?: number;
}
```

Use a floating world origin to avoid precision errors as the player travels across Denmark.

The future server-authoritative state must use geographic coordinates, world chunk ID and timestamp rather than trusting client-side X/Y/Z alone.

## T1 integration

Do not remove current systems. Bridge them:

- entering a geographic zone can trigger a scenario
- interacting with a place or NPC can open a card encounter
- flashcards can represent dialogue, investigation, training or turn-based combat decisions
- RAG can provide contextual content for a municipality, location or quest
- Light/Balanced/Uber LLM modes remain available

Create a `CardEncounterBridge` that receives a geographic interaction and starts the existing card/scenario flow without duplicating game rules.

## Secrets

Document these environment variables without committing values:

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_MAP_ID=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_MAPS_SERVER_API_KEY=
MAP_CHUNK_RADIUS_METERS=1000
MAP_CHUNK_SIZE_METERS=250
MAP_HIGH_DETAIL_RADIUS_METERS=250
MAP_UNLOAD_RADIUS_METERS=1200
```

If Google Maps MCP injects credentials through Devin, use that connection during development and keep deployment secrets in Google Secret Manager.

## Deliverable sequence

### Milestone 1 — National index and map adapter

- Google Maps MCP connection verified
- Denmark metadata/index service
- coordinate and chunk utilities
- `/api/maps/health`
- map debug page
- 1 km radius visualization

### Milestone 2 — Streaming prototype

- dynamic chunk requests
- cancellation
- cache and unload
- LOD rings
- Android performance panel

### Milestone 3 — Third-person vertical slice

- mobile player controls
- third-person camera
- one real Danish location
- one NPC
- one quest
- one card/flashcard encounter

### Milestone 4 — Denmark traversal

- searchable Danish locations
- teleport/developer travel tool
- floating origin
- persistent player location
- chunk streaming across distant regions

## Acceptance tests

1. Search for locations in at least five widely separated Danish regions.
2. Teleport between Copenhagen, Aarhus, Aalborg, Odense and a Danish island location.
3. Confirm only chunks within 1,000 m are active after each move.
4. Confirm old chunks are disposed after leaving the 1,200 m threshold.
5. Confirm requests are cancelled during rapid movement.
6. Confirm the client remains usable on an Android browser.
7. Confirm no API key or credential is committed.
8. Confirm existing T1 build, RAG and card/scenario tests still pass.
9. Confirm one geographic interaction triggers the existing card/scenario system.
10. Confirm Google map content is accessed only through approved APIs and attribution remains visible where required.
