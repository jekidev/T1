# Deployment guide

This repository is prepared for direct import into Replit, continued development through Manus, and local execution on Android/Termux or a computer.

## One-command setup

Run:

```bash
pnpm setup
```

The setup script verifies Node.js 22+, enables pnpm through Corepack when needed, creates `.env`, creates the required RAG folders, installs dependencies, and prints the next connection steps.

Recent pnpm versions also ship a built-in `setup` command. If pnpm intercepts the call, run `pnpm run setup` instead.

## Replit

Import:

```text
https://github.com/jekidev/T1
```

Then:

```bash
pnpm setup
```

Connect Google Drive through Replit Connections. Store `OPENROUTER_API_KEY` and other credentials in Replit Secrets.

Use these deployment commands:

```bash
pnpm rag:sync && pnpm build
```

Store `DISCORD_BOT_TOKEN`, `DISCORD_WEBHOOK_URL` and `NCBI_API_KEY` in Replit Secrets as well if you use the Discord bridge or PubMed scraping. With the repository imported into Replit, everything below can be driven from Chrome on a phone: the Replit shell runs `pnpm rag:import-chatgpt`, `pnpm rag:scrape-longevity` and `pnpm dev`, and the Discord bridge gives the same access from the Discord app.

```bash
NODE_ENV=production pnpm start
```

The Replit Agent should use the authenticated Google Drive connection as the only external RAG source. OAuth tokens must remain in the Replit connection store.

## Manus

Connect Google Drive in Manus and use this instruction:

```text
Use https://github.com/jekidev/T1 as the canonical repository. Run pnpm setup first. Preserve the existing pnpm workspace, Express API, command-sim frontend, and Google Drive-only RAG flow. Use the authenticated Google Drive connection configured in Manus as the only external RAG source. Keep OAuth tokens and API keys in platform connections or secrets, never in GitHub.
```

## Google Drive RAG

Google Drive is the only external RAG source.

Platform mode:

- Replit or Manus authenticates Google Drive through its own connection UI.
- The platform agent reads Drive through that authenticated connection.
- Files are passed into the existing ingestion flow and represented in `rag/inbox`.
- No OAuth refresh token, client secret, or access token is committed to the repository.

Local mode:

```text
GOOGLE_DRIVE_RAG_PATH=/path/to/google-drive-rag
```

Then:

```bash
pnpm rag:sync
```

Supported formats:

```text
.pdf .txt .md .docx .json .csv
```

The sync script copies unique files into `rag/inbox` and writes `rag/inbox/manifest.json`.

## Longevity research content

```bash
pnpm rag:import-chatgpt --source /path/to/chatgpt-export.zip   # ChatGPT export to rag/imports/chatgpt
pnpm rag:scrape-longevity                                      # configured sources to rag/longevity/feeds
pnpm rag:scrape-longevity --notify                             # and announce new items on Discord
```

Drop personal protocols in `rag/longevity/protocols` and lab results in `rag/longevity/labs`. Everything under `rag/` is walked by `syncRagIntoPersistentMemory()` on API start, and can be re-indexed with `POST /api/rag/sync`. Imported and scraped text is untrusted reference data and is never used as a system prompt.

Search it from anywhere with `GET /api/rag/search?q=...&prefix=longevity/protocols`, or from Discord with `/rag`, `/protocols`, `/labs` and `/feeds` (see `integrations/discord/README.md`).

## Android / Termux

```bash
pkg update
pkg install git nodejs
termux-setup-storage

git clone https://github.com/jekidev/T1.git
cd T1
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm setup
pnpm dev
```

To use downloaded Google Drive files:

```bash
mkdir -p "$HOME/storage/shared/GoogleDriveRAG"
export GOOGLE_DRIVE_RAG_PATH="$HOME/storage/shared/GoogleDriveRAG"
pnpm rag:sync
```

All new scripts are dependency-free Node 22 ESM and run unchanged in Termux:

```bash
export CHATGPT_EXPORT_PATH="$HOME/storage/shared/Download/chatgpt-export.zip"
pnpm rag:import-chatgpt
pnpm rag:scrape-longevity

pkg install python
pip install -r integrations/discord/requirements.txt
python integrations/discord/discord_bridge.py --command "/rag nmn dosing"
node integrations/discord/notify.mjs "New senolytics preprint indexed"
```

The ZIP reader uses `node:zlib` only, so no unzip binary is needed. For webhook-only notifications, skip `DISCORD_BOT_TOKEN` and set `DISCORD_WEBHOOK_URL`; a persistent gateway connection is unreliable on a phone.

## Local computer

```bash
git clone https://github.com/jekidev/T1.git
cd T1
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm setup
pnpm dev
```

Production-style run:

```bash
pnpm build
NODE_ENV=production pnpm start
```

## Environment variables

```text
PORT=8080
BASE_PATH=/
OPENROUTER_API_KEY=
DATABASE_URL=
GOOGLE_DRIVE_RAG_PATH=rag/google-drive
CHATGPT_EXPORT_PATH=imports/chatgpt-export
LONGEVITY_SOURCES_FILE=integrations/longevity-sources.json
NCBI_API_KEY=
DISCORD_BOT_TOKEN=
DISCORD_WEBHOOK_URL=
DISCORD_ADMIN_CHANNEL=
T1_API_URL=http://127.0.0.1:8080
```

`DISCORD_BOT_TOKEN` and `DISCORD_WEBHOOK_URL` belong in the platform secret store or a local `.env`, which is git-ignored.
