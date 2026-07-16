# Devin task — T1 Denmark world streaming with Google Maps MCP

Use the existing repository `https://github.com/jekidev/T1` as the only canonical codebase.

Read `docs/GOOGLE_MAPS_DENMARK_WORLD_SPEC.md` before editing anything.

## Required tool usage

Use the Google Maps MCP/API connection already configured in Devin. Verify the connection first with a harmless location lookup in Denmark. Do not ask the user to paste credentials into chat, code or GitHub.

Use Google Maps services only through approved APIs. Do not scrape, download or commit Google imagery or map tiles.

## Goal

Implement the first working foundation for a third-person RPG/MMORPG world covering all of Denmark logically, while loading and rendering only a 1,000 metre radius around the current player.

“All of Denmark” means a national searchable/indexed world and deterministic chunk addressing. It does not mean loading or generating the entire country in browser memory.

## Preserve the existing project

Keep and integrate:

- pnpm workspace
- Express API
- current command-sim frontend
- existing cards, flashcards, scenario and turn-based logic
- Google Drive RAG
- OpenRouter integration
- Light, Balanced and Uber modes
- current setup and deployment scripts

Do not restart the application in a new repository and do not replace the stack unnecessarily.

## Implement Milestone 1 and Milestone 2 now

### 1. Inspect and document

- Run `pnpm setup` when supported.
- Inspect the real workspace paths before creating files.
- Update paths from the specification to match the repository.
- Write a short architecture note describing how the current frontend and API connect to the new map subsystem.

### 2. Verify Google Maps MCP

- Perform a test lookup for Copenhagen, Denmark.
- Record only non-secret capability information in the implementation notes.
- Never print or commit the API key.

### 3. Denmark national index

Implement a lightweight Denmark index service containing searchable metadata for Danish regions, municipalities, settlements and world chunk references.

The index must cover Denmark and Danish islands, excluding Greenland and the Faroe Islands by default.

Do not store Google tiles or imagery.

### 4. Coordinate system and chunk grid

Implement typed utilities for:

- latitude/longitude
- local metre coordinates
- deterministic 250 × 250 metre chunk IDs
- chunks intersecting a 1,000 metre player radius
- floating world origin
- distance calculations

Use this lifecycle:

```text
UNLOADED -> REQUESTED -> FETCHING -> PARSED -> ACTIVE -> CACHED -> DISPOSED
```

Use AbortController for cancellable requests.

### 5. Map server API

Add modular map routes and providers to the existing API server:

```text
GET /api/maps/health
GET /api/maps/chunks?lat={lat}&lng={lng}&radius=1000
GET /api/maps/chunks/{chunkId}
GET /api/maps/geocode?q={query}
GET /api/maps/reverse-geocode?lat={lat}&lng={lng}
GET /api/maps/places/nearby?lat={lat}&lng={lng}&radius={radius}
```

Requirements:

- validate latitude, longitude and radius
- reject normal client radius values above 1,000 metres
- structured errors without stack traces
- in-memory cache first, with a clean interface for later persistent cache
- Google-specific calls behind provider interfaces
- health endpoint must not expose secrets

### 6. Frontend map debug page

Add a mobile-first debug/world page to the existing frontend.

It must show:

- current latitude/longitude
- selected Danish location
- active 1 km radius
- 250 m chunk boundaries
- chunk state
- request/cancellation counters
- active chunk count
- basic quality selector
- search for a Danish place
- developer teleport between Copenhagen, Aarhus, Aalborg, Odense and one island location

Use the project’s existing UI patterns. Do not redesign unrelated parts.

### 7. Streaming manager

Implement a reusable `WorldStreamManager` or equivalent that:

- computes required chunks from player position
- loads only chunks intersecting the 1 km circle
- keeps high detail within 250 m
- uses medium detail from 250–600 m
- uses low detail from 600–1,000 m
- unloads after 1,200 m
- cancels stale requests
- deduplicates concurrent requests
- disposes client resources correctly

### 8. T1 integration bridge

Create a minimal `CardEncounterBridge` interface connecting a geographic place interaction to the existing card/scenario flow.

Implement one demonstration location in Denmark that can trigger one existing card, flashcard or scenario without duplicating the existing rules engine.

### 9. Environment and secrets

Update `.env.example` with empty placeholders and defaults only:

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

Use the Devin Google Maps MCP connection during development. Document Google Secret Manager for deployment credentials.

### 10. Tests and validation

Add tests for:

- deterministic chunk ID generation
- chunks intersecting a radius
- radius validation
- coordinate conversion round trip
- old chunk unload
- stale request cancellation
- no duplicate requests
- no secrets included in API health response

Run:

```bash
pnpm typecheck
pnpm build
```

Run relevant tests and fix critical failures.

## Android-first requirements

- test responsive layout at narrow phone widths
- no desktop-only controls
- cap rendering resolution where relevant
- default quality to Low on Android
- avoid loading all Denmark data into the browser
- keep the debug page usable with touch

## Git workflow

- create a feature branch named `feature/google-maps-denmark-streaming`
- make logical commits
- push the branch
- open a pull request against `main`
- include screenshots or concise test evidence where possible
- do not merge automatically

## Completion report

Return only:

1. pull request URL
2. implemented modules
3. tests/build status
4. Google Maps MCP capabilities used
5. secrets or Google Cloud configuration still required
6. known limitations for the next third-person milestone

Do not stop at planning. Implement Milestones 1 and 2 and open the pull request.
