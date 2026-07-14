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
