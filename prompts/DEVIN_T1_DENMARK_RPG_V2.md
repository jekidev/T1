# Devin task — T1 Denmark RPG world foundation v2

Use `https://github.com/jekidev/T1` as the only canonical repository.

This task supersedes the earlier generic map prompt. It is based on the current `main` architecture and the existing open branches.

## Read first

Before editing, read these files and inspect the referenced modules:

- `README.md`
- `package.json`
- `pnpm-workspace.yaml`
- `.env.example`
- `docs/GOOGLE_MAPS_DENMARK_WORLD_SPEC.md`
- `prompts/DEVIN_GOOGLE_MAPS_DENMARK_STREAMING.md`
- `artifacts/command-sim/package.json`
- `artifacts/command-sim/src/App.tsx`
- `artifacts/command-sim/src/lib/game/types.ts`
- `artifacts/command-sim/src/lib/game/scenarioCompiler.ts`
- `artifacts/command-sim/src/lib/game/simulationEngine.ts`
- `artifacts/command-sim/src/lib/game/narrativeEngine.ts`
- `artifacts/command-sim/src/pages/board/index.tsx`
- `artifacts/api-server/package.json`
- `artifacts/api-server/src/index.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/lib/workspace-openrouter.ts` if present on the working ref
- `knowledge/config/retrieval-policy.json`
- `knowledge/features/feature-catalog.json`
- `README_BEFORE_ANY_CHANGES_KNOWLEDGE.md`
- `README_KNOWLEDGE_INTEGRATION.md`

Also inspect without merging:

- PR #3 — isolated Three.js graphics runtime foundation
- PR #4 — strategy, geo-world, world-generation and controlled-agent foundation
- Issue #23 — Google Maps Denmark world streaming

Use `git diff main...<branch>` or GitHub PR diffs to identify reusable modules.

## Current architecture that must be preserved

The current project is a pnpm workspace with:

- React 19 + Vite command-sim frontend in `artifacts/command-sim`
- Wouter routes currently including `/`, `/board/:id` and `/analytics`
- Express 5 API in `artifacts/api-server`
- persisted `BoardState` JSON as the canonical scenario state
- geographic fields already present in `GeoPosition`, `BoardZone.geoBounds` and `BoardWorldState`
- deterministic turn simulation and dynamic narrative events
- existing scenario/card-style board interactions
- Google Drive RAG and safe/quarantine knowledge policy
- OpenRouter heads-up system and Light/Balanced/Uber modes
- Android/Termux, Replit and Manus setup/deployment scripts
- graphics assets under the existing RAG graphics folders

Do not replace this with a new app, Next.js project, Unity project or Unreal project.

## Branch strategy

Create:

```text
feature/t1-denmark-rpg-world-v2
```

Base it on current `main`.

Do not merge PR #3 or PR #4 wholesale. They are not merge-ready and contain unrelated changes.

You may selectively port or adapt clean modules from those branches only after reviewing them. Especially inspect:

### From PR #3

- `src/config/graphics.ts`
- `src/engines/core/EngineAdapter.ts`
- `src/state/useGraphicsStore.ts`
- `src/game/scenes/PrimaryGameScene.tsx`
- `src/game/entities/Player3D.tsx`
- `src/game/physics/PhysicsWorld.tsx`
- `src/pages/graphics-lab.tsx`

### From PR #4

- `lib/geo-world/src/coordinates.ts`
- `lib/geo-world/src/chunks.ts`
- `lib/geo-world/src/types.ts`
- `lib/geo-world/src/placement.ts`
- `artifacts/api-server/src/lib/overpass-client.ts`
- `artifacts/api-server/src/routes/workspace-maps.ts`
- `artifacts/api-server/src/routes/world-generation.ts`
- `artifacts/command-sim/src/lib/world-config.ts`
- `artifacts/command-sim/src/pages/geo-lab/index.tsx`
- `artifacts/command-sim/src/pages/board/world-map-underlay.tsx`

Port only what is compatible with current `main`, current package versions and the Google Maps requirement. Preserve provenance in commit messages.

## Required Google Maps MCP usage

Use the Google Maps MCP/API connection already configured in Devin.

1. Verify it with harmless lookups for Copenhagen and one non-Copenhagen Danish location.
2. Record only capability names and test results, never credentials.
3. Do not ask the user to paste an API key.
4. Do not scrape, download or commit Google imagery, Street View media or tiles.
5. Keep Google-specific calls behind provider interfaces.
6. Store deployment credentials in Google Secret Manager or platform secrets.

Google Maps is the canonical geographic lookup/display provider for this milestone. Gameplay state remains provider-independent.

## Product objective

Create the first repository-integrated foundation for a browser-based third-person T1 RPG/MMORPG world covering all of Denmark logically.

“All of Denmark” means:

- every Danish location can be searched and addressed
- Denmark is divided into deterministic geographic chunks
- the player can move or developer-teleport between distant Danish regions
- only the local world near the player is requested and rendered

The browser must never load the whole country.

## Streaming limits

Use these defaults:

```text
chunk size: 250 m × 250 m
active radius: 1,000 m
high-detail radius: 250 m
medium-detail radius: 600 m
low-detail radius: 1,000 m
unload radius: 1,200 m
```

Only chunks intersecting the 1 km circle may be active. Do not treat the full 2 km bounding square as active.

Required lifecycle:

```text
UNLOADED -> REQUESTED -> FETCHING -> PARSED -> ACTIVE -> CACHED -> DISPOSED
```

Use `AbortController` for stale requests and deduplicate simultaneous requests for the same chunk.

## Implementation scope for this PR

Implement one complete map-to-game vertical foundation, not the full MMORPG.

### A. Shared geographic package

Prefer a reusable workspace package:

```text
lib/geo-world/
```

If the clean PR #4 package can be safely ported, reuse and simplify it. Otherwise create the minimum package on this branch.

It must expose typed, tested functions for:

- WGS84 latitude/longitude validation
- geographic distance
- stable local metre conversion
- 250 m chunk IDs
- chunk bounds and centre
- chunks intersecting a radius
- LOD classification
- floating-origin conversion
- Denmark bounds validation

Do not encode Google response types into the shared domain package.

### B. API server map subsystem

Add the subsystem inside the existing Express server, following its current route-registration and logging patterns.

Suggested paths:

```text
artifacts/api-server/src/lib/maps/
  maps-provider.ts
  google-maps-provider.ts
  denmark-index.ts
  chunk-cache.ts
  maps-service.ts

artifacts/api-server/src/routes/maps.ts
```

Required endpoints:

```text
GET /api/maps/health
GET /api/maps/geocode?q=
GET /api/maps/reverse-geocode?lat=&lng=
GET /api/maps/places/nearby?lat=&lng=&radius=
GET /api/maps/chunks?lat=&lng=&radius=1000
GET /api/maps/chunks/:chunkId
```

Requirements:

- use Zod or the repository’s established validation approach
- reject invalid coordinates
- reject ordinary radius requests above 1,000 m
- never return secrets or stack traces
- structured Pino logging without API keys or full provider payloads
- provider interface plus Google implementation
- request timeout and cancellation
- deduplicated in-flight chunk generation
- bounded memory cache with TTL and maximum entries
- provider failures return a safe degraded response where possible
- `/health` reports capability status, not credentials

### C. Denmark index

Implement a lightweight national metadata catalog, not a pre-generated 3D copy of Denmark.

Include or generate references for:

- five Danish regions
- municipalities
- settlements and neighbourhoods
- islands
- development spawn points
- deterministic chunk addressing

Exclude Greenland and the Faroe Islands by default, but design the type so they can be separate world packs later.

Do not populate an enormous static JSON file from Google responses. Prefer a small seed catalog plus searchable provider-backed lookups and cache.

### D. Frontend world route

Add a new lazy route to the existing Wouter app, for example:

```text
/world
```

Do not replace `/board/:id`.

Use existing UI components and mobile patterns. The route must work before full 3D rendering is enabled.

Required first view:

- Google map surface or approved provider display
- player marker
- visible 1 km active circle
- 250 m chunk overlay
- chunk lifecycle/LOD status
- Danish place search
- developer teleport presets: Copenhagen, Aarhus, Odense, Aalborg and Bornholm
- current latitude/longitude
- active/in-flight/cached/disposed chunk counts
- request and cancellation counts
- Low/Medium/High quality selector, default Low on Android
- link back to the existing board

Add the route lazily so the main board bundle is not forced to load graphics/map dependencies.

### E. World stream manager

Create a framework-independent manager under the frontend’s existing architecture, not inside one React component.

Suggested placement:

```text
artifacts/command-sim/src/lib/world/
```

It must:

- accept canonical geographic player position
- compute required chunk set
- fetch only newly required chunks
- cancel obsolete requests
- classify LOD
- preserve a 1.2 km unload hysteresis
- dispose render resources through injected callbacks
- expose observable/snapshot state suitable for Zustand or React Query
- survive teleport between distant Danish locations
- never depend directly on Google Maps SDK objects

### F. BoardState integration

Use the existing domain instead of inventing a parallel save model.

Extend `BoardWorldState` and/or add versioned optional fields only when required. Maintain backward compatibility with existing persisted boards.

Canonical persistent positions must remain latitude/longitude plus optional altitude and chunk ID. Local 3D coordinates are derived and non-authoritative.

If the board schema version changes, add a migration path and tests.

### G. Existing T1 gameplay bridge

Implement a minimal provider-independent interface such as:

```ts
interface GeographicEncounter {
  placeId?: string;
  position: GeoPosition;
  chunkId: string;
  interactionType: "place" | "npc" | "zone" | "quest";
  scenarioId?: string;
}
```

Create a `CardEncounterBridge` or equivalent that converts one geographic interaction into the existing scenario/board flow.

For the demonstration:

- choose one real Danish public location using Google Maps MCP
- create a clearly fictional, non-operational T1 encounter associated with it
- entering or selecting the location opens an existing board/scenario interaction
- do not duplicate the simulation or narrative engines
- preserve `FactStatus` and source/provenance semantics

### H. Third-person preparation

Do not build a complete third-person engine in this PR.

Prepare a small adapter boundary for a later renderer:

- player geographic position
- floating world origin
- local x/y/z conversion
- chunk activation/deactivation callbacks
- interaction callbacks
- graphics quality state

If clean code from PR #3 can be ported without lockfile or build breakage, expose an optional lazy 3D debug scene. Otherwise keep the renderer adapter mocked and ensure the map/world foundation is complete.

Do not add heavy graphics dependencies unless they are actually used and validated in this PR.

## Android-first constraints

Test at approximately 360 px and 412 px widths.

- touch controls only where interaction is required
- no hover-only action
- no full-country data in client memory
- cap map/render resolution where supported
- default quality Low on Android
- avoid large synchronous JSON parsing
- keep main board route responsive
- expose a simple performance/debug panel

## Security and policy constraints

Preserve:

- pnpm `minimumReleaseAge: 1440`
- current RAG safety and quarantine policy
- immutable-source/change-control rules
- no API keys in GitHub
- no Google provider payloads in RAG by default
- no operational criminal guidance generated from map context
- no arbitrary browser/search tool added to the normal advisor

Do not modify or delete existing source documents in `rag/**` or `knowledge/sources/**`.

Do not weaken the current network, retrieval or source-status safeguards.

## Environment variables

Add placeholders/defaults only, matching how the server currently loads environment variables:

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_SERVER_API_KEY=
GOOGLE_MAPS_MAP_ID=
GOOGLE_CLOUD_PROJECT_ID=
MAP_CHUNK_RADIUS_METERS=1000
MAP_CHUNK_SIZE_METERS=250
MAP_HIGH_DETAIL_RADIUS_METERS=250
MAP_MEDIUM_DETAIL_RADIUS_METERS=600
MAP_UNLOAD_RADIUS_METERS=1200
MAP_CHUNK_CACHE_TTL_MS=300000
MAP_CHUNK_CACHE_MAX_ENTRIES=256
```

Do not expose the server API key to the browser. If a browser key is required by the approved Maps SDK, restrict it by hostname and API and document that distinction.

## Tests

At minimum add tests for:

- coordinate validation
- distance calculation
- coordinate round trip
- deterministic chunk ID
- chunk bounds
- circle/chunk intersection
- Denmark bounds
- LOD classification
- radius cap
- in-flight request deduplication
- AbortController cancellation
- 1.2 km unload hysteresis
- cache TTL and maximum size
- health response secret redaction
- BoardState backward compatibility or migration
- one geographic encounter opening the existing scenario flow

## Validation commands

Run from repository root:

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

Also run all tests added for the geographic package and API routes.

If the lockfile must change, regenerate it with the repository’s pnpm version and commit it. Do not bypass the pnpm preinstall guard.

Run `pnpm knowledge:validate` if the task changes any knowledge metadata. It should not need to change source knowledge content.

## Manual acceptance tests

Document evidence for:

1. Google Maps MCP lookup succeeds for Copenhagen and Bornholm or another island.
2. `/world` loads on a narrow Android-sized viewport.
3. Teleport between Copenhagen, Aarhus, Odense, Aalborg and Bornholm.
4. Active chunks stay within the 1 km circle.
5. Chunks beyond 1.2 km unload.
6. Rapid teleport cancels stale requests.
7. No duplicate fetches for one chunk.
8. Main scenario list and `/board/:id` still work.
9. One map interaction opens the existing T1 scenario/card flow.
10. No secret appears in source, bundle, logs or health output.

## Git and PR requirements

- make logical commits
- push `feature/t1-denmark-rpg-world-v2`
- open a draft PR against `main`
- reference issue #23
- explain which code, if any, was selectively ported from PR #3 or PR #4
- include changed architecture, tests, build status and Android evidence
- do not auto-merge
- do not close PR #3 or PR #4 unless explicitly instructed

## Completion response

Return only:

1. draft PR URL
2. concise architecture summary
3. files/modules created or changed
4. Google Maps MCP capabilities actually used
5. tests/typecheck/build results
6. Android validation performed
7. any secrets/cloud configuration still needed
8. explicit list of known limitations for the next third-person milestone

Do not stop after analysis or a plan. Implement the vertical foundation, validate it and open the draft PR.