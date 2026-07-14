# T1 — Urban Strategy Simulator

Canonical repository for direct import into Replit or continued development through Manus.

## Fast start

```bash
pnpm setup
pnpm dev
```

Production build and start:

```bash
pnpm build
NODE_ENV=production pnpm start
```

## Main modules

- `artifacts/command-sim` — React strategy board, tutorials, AI workspace, Asset Lab and Geo World Lab
- `artifacts/api-server` — Express API, RAG, OpenRouter, asset jobs, OSM world import, coding-agent control and observability
- `lib/strategy-sim` — deterministic simulation, realtime Blue/Red assessment, NPC routines, status, command validation and fog views
- `lib/asset-pipeline` — asset jobs, provider catalog, metadata, validation and publication gates
- `lib/geo-world` — WGS84/local coordinates, Overpass parsing, public/place-role separation, chunks, placement and fog utilities
- `lib/coding-agent` — repository maps, OpenHands/Aider adapters, task policy, patch validation, run state and audit contracts
- `services/asset-worker` — provider-neutral authenticated GPU/Blender worker boundary

Application routes:

```text
/              saved games and AI New Game
/board/:id     playable strategy board and live team dynamics
/asset-lab     image→3D, human and video→animation jobs
/geo-lab       bounded OSM import, feature inspection and saved asset placement
/analytics     simulation analytics
```

## Realtime Blue / Red dynamics

New Game asks the user to select a Red, Blue or Observer perspective and an initial self-assessed moral position from 0 to 100.

The value is not permanent. It moves through deterministic events based on:

- actions
- risk and exposure
- karma
- integrity and proportionality
- civilian/public consequences
- legitimacy and outcomes

Each side has its own moral spectrum. Blue is not automatically good and Red is not automatically evil.

After every relevant event or turn, the board recalculates:

- complementary Blue/Red estimated success percentages
- collective morale
- moral spectrum
- risk pressure
- alignment coherence
- model confidence
- explainable weighted factors

See [`docs/TEAM_DYNAMICS.md`](docs/TEAM_DYNAMICS.md).

## Controlled coding agent

The project supports OpenHands as the primary autonomous adapter and Aider as the focused-edit adapter through one provider-independent contract.

The API server does not run coding-agent shell commands locally and cannot merge a PR. Execution happens through an authenticated external sandbox bridge:

```text
explicit signal
→ repository map
→ policy validation
→ agent/{adapter}/{task-id}
→ isolated worktree/container
→ patch
→ secret scan and tests
→ pull request
→ human review
```

Protected paths, self-modification rules, patch limits, test requirements, persistent audit records and OpenTelemetry events are implemented in `lib/coding-agent` and the protected `/api/coding-agent/*` routes.

See [`docs/CODING_AGENT.md`](docs/CODING_AGENT.md).

## Geospatial world

The editable world uses OpenStreetMap/Overpass as its initial public geometry and POI source. The server builds bounded queries from a fixed category allowlist; raw OverpassQL is not accepted from browsers or LLMs.

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

Required deployment variables and provider examples are in:

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
- Coding-agent spans contain identifiers and counts, not tokens, command output or source diffs.

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

`test:integration` includes strategy, team assessment, moral replay, NPC memory/routines, character status, blackmail, fog of war, board bridge, coding-agent policy, asset-pipeline and geospatial tests.

The feature branch changes workspace manifests without a regenerated `pnpm-lock.yaml`. Do not treat it as merge-ready until the lockfile is regenerated and typecheck, tests and build complete successfully.

## Replit

1. Import `https://github.com/jekidev/T1`.
2. Run `pnpm setup`.
3. Connect Google Drive through Replit Connections.
4. Add `OPENROUTER_API_KEY` through Replit Secrets.
5. Add only the required asset, Overpass, coding-agent and observability settings from `deployment/asset-pipeline.env.example`.
6. Keep OAuth credentials, API keys and worker/admin tokens in platform secrets, never in GitHub.

## Google Drive RAG

For local or Termux use, place downloaded Drive files in `rag/google-drive`, or set:

```text
GOOGLE_DRIVE_RAG_PATH=/path/to/google-drive-rag
```

Then run:

```bash
pnpm rag:sync
```

DeepSeek scripts, conversations and existing RAG content are preserved; the coding-agent repository map does not ingest their full contents.

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
