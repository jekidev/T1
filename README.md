# T1 — Urban Strategy Simulator

Canonical repository for direct import into Replit or continued development through Manus.

> **For AI game creators:** this repo is also ready to be used as the simulation/data layer for a **third-person MMO RPG HTML/browser game**. Read [`docs/AI_GAME_CREATOR.md`](docs/AI_GAME_CREATOR.md) and [`docs/T1_SIMULATION_CONTRACT.md`](docs/T1_SIMULATION_CONTRACT.md), then build your client in `artifacts/third-person-mmo/`. Do not delete existing code; add to it.

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

## Hourly everyday-wisdom heads-up

Put source documents in:

```text
rag/wisdom/common/everyday tips
```

The server synchronizes that subfolder into persistent RAG memory and generates one LLM heads-up every hour. Supported inputs are Markdown, text, JSON, CSV, YAML, PDF, DOCX and legacy DOC when `antiword` is installed.

PDF extraction uses the existing Python knowledge dependency:

```bash
pip install -r requirements-knowledge.txt
```

The board displays heads-ups through an SSE stream. Press the bell button in the heads-up dock to allow normal browser notifications while the app is open. Generate one immediately with:

```bash
curl -X POST http://localhost:8080/api/llm/headsup/refresh \
  -H 'Content-Type: application/json' \
  -d '{"mode":"balanced"}'
```

## User LLM modes

The board provides three user-facing modes:

| Mode | Behavior |
|---|---|
| **Light** | Quiet mode: hourly wisdom and concise user-led advisor replies. |
| **Balanced** | Hourly wisdom plus short coaching after meaningful turns. |
| **Uber** | Active commentary on game-state changes and throttled review-only potential PR proposals. |

Uber proposals are stored by model under:

```text
rag/Code/LLM_scripts/<model-slug>/<timestamp>-potential-pr.md
```

They are not executed, committed or opened as pull requests automatically. Each artifact is a reviewable patch sketch with evidence, validation, rollback and game-state continuation notes. The output is synchronized back into RAG so later development sessions can continue from reviewed proposals.

Configuration is documented in `.env.example`, including:

- `WISDOM_RAG_SUBFOLDER`
- `HEADS_UP_INTERVAL_MS`
- `HEADS_UP_DEFAULT_MODE`
- `LLM_SCRIPT_OUTPUT_DIR`
- `UBER_SCRIPT_INTERVAL_MS`
- `UBER_SOURCE_MAX_CHARS`

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
