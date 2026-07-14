# Deployment guide

This repository is prepared for direct import into Replit, continued development through Manus, and local execution on Android/Termux or a computer.

## Replit

Import:

```text
https://github.com/jekidev/T1
```

Use pnpm.

Build command:

```bash
pnpm install --frozen-lockfile && pnpm rag:sync && pnpm build
```

Run command:

```bash
NODE_ENV=production pnpm start
```

Add API keys through Replit Secrets. Do not commit credentials.

## Manus

Use this instruction:

```text
Use https://github.com/jekidev/T1 as the canonical repository. Preserve the existing pnpm workspace, Express API, command-sim frontend, Google Drive RAG workflow, and deployment structure. Work in focused branches and keep credentials out of source control.
```

## Google Drive RAG

Google Drive is the only external RAG source.

Download or sync Drive files into a local folder and set:

```text
GOOGLE_DRIVE_RAG_PATH=/path/to/google-drive-rag
```

Then run:

```bash
pnpm rag:sync
```

Supported formats:

```text
.pdf .txt .md .docx .json .csv
```

The sync script copies unique files into `rag/inbox` and writes `rag/inbox/manifest.json`.

### Termux example

```bash
termux-setup-storage
mkdir -p "$HOME/storage/shared/GoogleDriveRAG"
export GOOGLE_DRIVE_RAG_PATH="$HOME/storage/shared/GoogleDriveRAG"
pnpm rag:sync
```

## Local / Termux

```bash
git clone https://github.com/jekidev/T1.git
cd T1
corepack enable
corepack prepare pnpm@10.13.1 --activate
cp .env.example .env
pnpm install --frozen-lockfile
pnpm rag:sync
pnpm dev
```

Production-style local run:

```bash
NODE_ENV=production pnpm build
pnpm start
```

## Environment variables

```text
PORT=8080
BASE_PATH=/
OPENROUTER_API_KEY=
DATABASE_URL=
GOOGLE_DRIVE_RAG_PATH=rag/google-drive
```
