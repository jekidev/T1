# T1 — Urban Strategy Simulator

Canonical repository for the Urban Strategy Simulator.

## Use with Replit

Import this repository directly:

```text
https://github.com/jekidev/T1
```

Build:

```bash
pnpm install --frozen-lockfile && pnpm rag:sync && pnpm build
```

Run:

```bash
NODE_ENV=production pnpm start
```

Add `OPENROUTER_API_KEY` and other credentials through Replit Secrets.

## Use with Manus

Give Manus the repository URL and instruct it to preserve the existing pnpm workspace, Express API, command-sim frontend, Google Drive RAG flow, and deployment files.

## Google Drive RAG

Set `GOOGLE_DRIVE_RAG_PATH` to a local folder containing files downloaded or synced from Google Drive, then run:

```bash
pnpm rag:sync
```

The script copies supported documents into `rag/inbox`, removes duplicates by SHA-256, and writes `rag/inbox/manifest.json`.

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

See `DEPLOYMENT.md` for the complete setup.
