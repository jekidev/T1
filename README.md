# T1 — Urban Strategy Simulator

Canonical repository for direct import into Replit or continued development through Manus.

## Fast start

Import:

```text
https://github.com/jekidev/T1
```

Run one setup command:

```bash
pnpm setup
```

Then start development:

```bash
pnpm dev
```

Production build and start:

```bash
pnpm build
NODE_ENV=production pnpm start
```

## Main modules

- `artifacts/command-sim` — React strategy board, tutorials, AI workspace, Asset Lab and Geo World Lab
- `artifacts/api-server` — Express API, RAG, OpenRouter, asset jobs, OSM world import and observability
- `lib/strategy-sim` — deterministic Miniplex simulation, command validation and faction-filtered fog views
- `lib/asset-pipeline` — asset jobs, provider catalog, metadata, validation and publication gates
- `lib/geo-world` — WGS84/local coordinates, Overpass parsing, public/place-role separation, chunks, placement and fog utilities
- `services/asset-worker` — provider-neutral authenticated GPU/Blender worker boundary

Application routes:

```text
/              saved games and AI New Game
/board/:id     playable strategy board
/asset-lab     image→3D, human and video→animation jobs
/geo-lab       bounded OSM import, feature inspection and saved asset placement
/analytics     simulation analytics
```

## Geospatial world

The editable world uses OpenStreetMap/Overpass as its initial public geometry and POI source. The server builds bounded queries from a fixed category allowlist; raw OverpassQL is not accepted from browsers or LLMs.

Implemented flow:

```text
selected WGS84 bounds
→ bounded Overpass import
→ roads, buildings, land use and public POIs
→ privacy-safe category mapping
→ deterministic world chunks
→ persistent region
→ tactical vector preview
→ validated, versioned asset placement
```

Public map categories and gameplay roles are separate. Residential names and address tags are stripped, and real residences cannot be assigned fictional `safehouse` or `stashhouse` roles.

The project does not scrape or convert Google Earth photogrammetry into permanent assets. Google Places remains an optional server-side public-place adapter.

See [`docs/GEO_WORLD.md`](docs/GEO_WORLD.md).

## AI asset generation

The frontend never runs Hunyuan3D, InstantMesh, TripoSR, MPFB2, MakeHuman, DECA, ECON or FreeMoCap directly. Asset Lab submits jobs to the API, which calls separately deployed GPU and Blender workers.

Required deployment variables and provider command examples are in:

```text
deployment/asset-pipeline.env.example
```

Architecture and worker details:

- [`docs/ASSET_PIPELINE.md`](docs/ASSET_PIPELINE.md)
- [`services/asset-worker/README.md`](services/asset-worker/README.md)

A missing worker produces an explicit retryable job failure. It does not generate a placeholder asset. Assets with unverified or restricted licenses cannot enter the production manifest. License verification and publication require a separate server-side reviewer credential.

## Observability

OpenTelemetry is the common server instrumentation layer. Highlight is the primary optional dashboard/session-replay adapter, while rrweb is the consent-controlled self-hosted fallback.

- Session replay requires explicit user consent.
- Monaco, secret-marked elements, passwords, keys, tokens and canvas content are blocked or masked.
- Self-hosted replay retrieval requires `OBSERVABILITY_REPLAY_ADMIN_TOKEN`.
- Retention is configurable and defaults to seven days for the rrweb fallback.

See [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md).

## Strategy simulation and fog of war

The strategy layer is headless and deterministic. React and future Three.js rendering consume simulation state but do not own it. Player, local-bot, behavior-tree and future LLM actions use the same validated command queue.

`exportFactionView` is the multiplayer-safe visibility boundary:

- friendly and detected entities are returned live
- enemy dynamic entities outside vision are omitted entirely
- hidden entities can remain omitted inside ordinary vision
- previously observed static objects may return only stale snapshots
- pending commands and the full event log remain outside the faction view

See:

- [`docs/STRATEGY_ECS_ANALYSIS.md`](docs/STRATEGY_ECS_ANALYSIS.md)
- [`docs/BLACKMAIL_SYSTEM.md`](docs/BLACKMAIL_SYSTEM.md)
- [`lib/strategy-sim/README.md`](lib/strategy-sim/README.md)

## Validation

```bash
pnpm typecheck
pnpm test:integration
pnpm build
```

`test:integration` includes deterministic strategy, blackmail, fog-of-war, board bridge, asset-pipeline and geospatial world tests.

The feature branch currently changes workspace manifests without a regenerated `pnpm-lock.yaml`. GitHub workflows are also failing before useful step logs are available. Do not treat the branch as merge-ready until the lockfile is regenerated and typecheck/tests/build have completed successfully.

## Replit

1. Import the repository.
2. Run `pnpm setup`.
3. Open Replit Connections and connect Google Drive.
4. Add `OPENROUTER_API_KEY` through Replit Secrets.
5. Add asset, Overpass and observability settings from `deployment/asset-pipeline.env.example` as needed.
6. Ask Replit Agent to preserve the existing pnpm workspace and Google Drive-only RAG flow.

Google OAuth credentials, API keys, worker tokens and reviewer tokens must remain in platform connection/secret stores and must never be committed to GitHub.

## Manus

Give Manus this instruction:

```text
Use https://github.com/jekidev/T1 as the canonical repository. Run pnpm setup first. Preserve the pnpm workspace, Express API, command-sim frontend, Google Drive-only RAG flow, geospatial public-category/game-role boundary, server-authoritative fog views, and external GPU-worker architecture. Keep OAuth tokens and API keys in platform connections or secrets, never in GitHub.
```

## Google Drive RAG

For local or Termux use, place downloaded Drive files in:

```text
rag/google-drive
```

or set:

```text
GOOGLE_DRIVE_RAG_PATH=/path/to/google-drive-rag
```

Then run:

```bash
pnpm rag:sync
```

## Local / Termux

```bash
git clone https://github.com/jekidev/T1.git
cd T1
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm setup
pnpm dev
```

See `DEPLOYMENT.md` for the detailed flow.
