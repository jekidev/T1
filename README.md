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

The setup script:

- verifies Node.js 22+
- enables pnpm through Corepack when needed
- creates `.env` from `.env.example`
- creates required RAG folders
- installs all dependencies
- prints the next Google Drive connection step

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

- `artifacts/command-sim` — React strategy board, map, tutorials, AI workspace and Asset Lab
- `artifacts/api-server` — Express API, RAG, OpenRouter integration, asset jobs and observability
- `lib/strategy-sim` — deterministic Miniplex strategy simulation and command validation
- `lib/asset-pipeline` — asset jobs, provider catalog, metadata, validation and publication gates
- `services/asset-worker` — provider-neutral authenticated GPU/Blender worker boundary

Application routes:

```text
/              saved games and AI New Game
/board/:id     playable strategy board
/asset-lab     image→3D, human and video→animation job management
/analytics     simulation analytics
```

## AI asset generation

The frontend never runs Hunyuan3D, InstantMesh, TripoSR, MPFB2, MakeHuman, DECA, ECON or FreeMoCap directly. Asset Lab submits jobs to the API, which calls separately deployed GPU and Blender workers.

Required deployment variables and provider command examples are in:

```text
deployment/asset-pipeline.env.example
```

Architecture and worker details:

- [`docs/ASSET_PIPELINE.md`](docs/ASSET_PIPELINE.md)
- [`services/asset-worker/README.md`](services/asset-worker/README.md)

A missing worker produces an explicit retryable job failure. It does not generate a placeholder asset. Assets with unverified or restricted licenses cannot enter the production manifest.

## Observability

OpenTelemetry is the common server instrumentation layer. Highlight is the primary optional dashboard/session-replay adapter, while rrweb is the consent-controlled self-hosted fallback.

- Session replay requires explicit user consent.
- Monaco, secret-marked elements, passwords, keys, tokens and canvas content are blocked or masked.
- Self-hosted replay retrieval requires `OBSERVABILITY_REPLAY_ADMIN_TOKEN`.
- Retention is configurable and defaults to seven days for the rrweb fallback.

See [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md).

## Strategy simulation

The new strategy layer is headless and deterministic. React and future Three.js rendering consume simulation state but do not own it. Player, local-bot, behavior-tree and future LLM actions use the same validated command queue.

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

`test:integration` currently includes the deterministic strategy tests, blackmail/board bridge tests and asset-pipeline state/validation tests.

## Replit

1. Import the repository.
2. Run `pnpm setup`.
3. Open Replit Connections and connect Google Drive.
4. Add `OPENROUTER_API_KEY` through Replit Secrets.
5. Ask Replit Agent to use the connected Google Drive account as the only RAG source and preserve the existing `pnpm rag:sync` flow.

Google OAuth credentials must remain in the Replit connection store and must never be committed to GitHub.

## Manus

Give Manus this instruction:

```text
Use https://github.com/jekidev/T1 as the canonical repository. Run pnpm setup first. Preserve the existing pnpm workspace, Express API, command-sim frontend, and Google Drive-only RAG flow. Use the Google Drive connection configured in Manus as the only external RAG source. Keep OAuth tokens and API keys in platform connections or secrets, never in GitHub.
```

## Google Drive RAG

The repository supports Google Drive as the only external RAG source.

When a platform connection is available, Replit or Manus should use that authenticated connection to read Drive files and pass them into the project ingestion flow.

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

The sync script copies supported documents into `rag/inbox`, removes duplicates by SHA-256, and writes `rag/inbox/manifest.json`.

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
