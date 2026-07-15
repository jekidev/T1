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

- `artifacts/command-sim` — React strategy board, AI workspace, live meters, Syndicate dashboard, Asset Lab and Geo World Lab
- `artifacts/api-server` — Express API, RAG/import gates, OpenRouter, asset jobs, OSM world import, coding-agent control and observability
- `lib/strategy-sim` — deterministic simulation, Blue/Red assessment, NPC routines, status, syndicates, commands and fog views
- `lib/asset-pipeline` — asset jobs, provider catalog, metadata, validation and publication gates
- `lib/geo-world` — WGS84/local coordinates, Overpass parsing, public/place-role separation, chunks, placement and fog utilities
- `lib/coding-agent` — repository maps, OpenHands/Aider adapters, network policy, patch validation, run state and audit contracts
- `services/asset-worker` — provider-neutral authenticated GPU/Blender worker boundary

Application routes:

```text
/                    saved games and AI New Game
/board/:id           playable strategy board, team dynamics and Syndicate dashboard
/asset-lab           image→3D, human and video→animation jobs
/geo-lab             bounded OSM import and saved asset placement
/analytics           simulation analytics
/coding-agent        protected OpenHands/Aider inspector
```

## Realtime Blue / Red dynamics

New Game asks the user to select Red, Blue or Observer and an initial self-assessed moral position from 0 to 100.

The value moves deterministically through actions, risk, karma, integrity, proportionality, public consequences, legitimacy and outcomes. Each side has its own moral spectrum; Blue is not automatically good and Red is not automatically evil.

The board recalculates complementary success estimates, collective morale, moral spectrum, risk pressure, coherence, confidence and explainable factors.

See [`docs/TEAM_DYNAMICS.md`](docs/TEAM_DYNAMICS.md).

## Fictional syndicate system

The OpenRA-inspired architecture is reimplemented as TypeScript data, validated commands and deterministic events; OpenRA code/assets are not copied.

Implemented foundation:

- layered fictional council/cell hierarchy
- recruitment and role requirements
- multidimensional power
- territory influence, ownership thresholds and fog states
- generic businesses and resources
- relationships, grievances, loyalty crises and defections
- deterministic long-term strategy selection
- replay-compatible command IDs and events
- board dashboard with Hierarchy, Territory, Economy, Members, Relationships, Intelligence, Businesses, Events, Reputation and Strategy
- downloadable employee gameplay briefs

Real cases and institutions may inform sourced structural patterns, while private people remain fictional. Religion, ethnicity, mental-health status, disability and substance-use history are never used as crime or competence modifiers.

See [`docs/SYNDICATE_SYSTEM.md`](docs/SYNDICATE_SYSTEM.md).

## Ask First and Ultra network access

All application-controlled retrieval and coding-agent tool egress defaults to **Ask First**.

- Ask First without approved hosts/capabilities is deny-all.
- RAG imports display a one-request approval for the exact origin/path and re-ask for redirects.
- Coding-agent runs bind approved hosts/capabilities to the run before execution.
- Ultra requires explicit temporary confirmation and remains blocked from private networks, cloud metadata, protected paths, secrets, branch bypass and automatic merge.
- RAG downloads resolve DNS, reject private results and pin TLS to a validated public address.
- Coding-agent workers must return a firewall audit; unapproved egress rejects the patch before PR publication.

See [`docs/NETWORK_ACCESS.md`](docs/NETWORK_ACCESS.md).

## Controlled coding agent

OpenHands is the primary autonomous adapter and Aider is the focused-edit adapter through one provider-independent contract.

```text
explicit signal
→ repository map
→ task and network policy
→ agent/{adapter}/{task-id}
→ isolated worktree/container
→ patch + tests + firewall audit
→ deterministic validation
→ independent review
→ agent-branch pull request
→ human review
```

The API server does not run coding-agent shell commands locally, cannot write to the protected default branch and has no merge endpoint.

See [`docs/CODING_AGENT.md`](docs/CODING_AGENT.md).

## RAG, books and world refresh

The AI workspace supports:

- immutable account RAG paths under `rag/accounts/<account>/...`
- Ask First/Ultra-gated Project Gutenberg *The Art of War* import
- explicit Hugging Face text-file imports
- `Update the world`, which rebuilds persistent RAG and assigns a new revision to NPC knowledge

Hugging Face imports accept only `.md`, `.txt`, `.json`, `.jsonl`, `.csv`, `.yaml` and `.yml`. Model weights, pickle files, binaries and executables are not downloaded or run. Existing RAG source files are not overwritten.

See [`rag/accounts/default/alt-wisdom/books/SOURCE_MANIFEST.md`](rag/accounts/default/alt-wisdom/books/SOURCE_MANIFEST.md).

## Geospatial world

The editable world uses OpenStreetMap/Overpass as its initial public geometry and POI source. Raw OverpassQL is not accepted from browsers or LLMs.

```text
selected WGS84 bounds
→ bounded Overpass import
→ privacy-safe public categories
→ deterministic chunks
→ persistent region
→ validated asset placement
```

Residential names and private address/contact tags are stripped. Real residences cannot be assigned fictional safehouse/stashhouse roles. Google Earth photogrammetry is not scraped or converted into permanent assets.

See [`docs/GEO_WORLD.md`](docs/GEO_WORLD.md).

## AI asset generation

Asset Lab submits jobs to separately deployed GPU and Blender workers. Missing workers fail explicitly; placeholders are not silently substituted. Unverified/restricted licenses cannot enter the production manifest.

- [`docs/ASSET_PIPELINE.md`](docs/ASSET_PIPELINE.md)
- [`services/asset-worker/README.md`](services/asset-worker/README.md)
- `deployment/asset-pipeline.env.example`

## Observability

OpenTelemetry is the common server layer. Highlight is the optional primary replay adapter and rrweb is the consent-controlled fallback.

Passwords, keys, tokens, Monaco, secret-marked elements, patch diffs and canvas content are blocked or masked. Coding-agent spans contain identifiers/counts rather than tokens or source diffs.

See [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md).

## Strategy simulation and fog of war

The strategy layer is headless and deterministic. React and future Three.js rendering consume state but do not own it. Player, bot, behaviour-tree and future LLM proposals use validated commands.

`exportFactionView` omits unseen dynamic enemies, limits hidden/static memory to stale snapshots and keeps pending commands/full event logs outside faction views.

- [`docs/STRATEGY_ECS_ANALYSIS.md`](docs/STRATEGY_ECS_ANALYSIS.md)
- [`docs/BLACKMAIL_SYSTEM.md`](docs/BLACKMAIL_SYSTEM.md)
- [`lib/strategy-sim/README.md`](lib/strategy-sim/README.md)

## Validation

```bash
pnpm typecheck
pnpm test:integration
pnpm build
```

`test:integration` includes strategy, team assessment, moral replay, syndicate commands/economy/loyalty, NPC memory/routines, character status, blackmail, fog, board bridge, coding-agent policy/network audit, asset pipeline and geospatial tests.

The feature branch changes workspace manifests without a regenerated `pnpm-lock.yaml`. It is not merge-ready until the lockfile is regenerated and typecheck, tests and build complete successfully.

The external coding-agent worker also requires an end-to-end firewall test against a disposable repository; application-level audit contracts do not replace infrastructure isolation.

## Replit

1. Import `https://github.com/jekidev/T1`.
2. Run `pnpm setup`.
3. Connect Google Drive through Replit Connections.
4. Add `OPENROUTER_API_KEY` through Replit Secrets.
5. Add only required asset, world, coding-agent and observability settings from `deployment/asset-pipeline.env.example`.
6. Keep OAuth credentials, API keys and worker/admin tokens in platform secrets.

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
