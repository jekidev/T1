# Deployment guide

This repository is prepared for direct import into Replit, continued development through Manus, and local execution on Android/Termux or a computer.

## One-command setup

Run:

```bash
pnpm setup
```

The setup script verifies Node.js 22+, enables pnpm through Corepack when needed, creates `.env`, creates the required RAG folders, installs dependencies, and prints the next connection steps.

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
GOOGLE_DRIVE_RAG_PATH=rag/google-drive
```
