# Deployment automation

This folder contains the platform bootstrap flow for Replit, Manus, Termux, and ordinary local environments.

## Main command

```bash
pnpm deployment:start
```

The bootstrap process:

1. Detects the runtime platform.
2. Runs the automatic dependency and environment setup.
3. Checks for an authenticated Google Drive connection or a configured local Drive folder.
4. Stops with the exact authorization action when consent is still required.
5. Synchronizes Google Drive RAG documents.
6. Builds the application.
7. Starts the production server.

## Google Drive authorization

OAuth authorization requires explicit user consent and cannot be silently completed from source code. Tokens must remain in Replit Connections, Manus Connections, or another secure platform secret store.

The bootstrap recognizes these connection indicators:

```text
GOOGLE_DRIVE_CONNECTION_ID
GOOGLE_DRIVE_ACCESS_TOKEN
GOOGLE_DRIVE_RAG_PATH
```

Do not commit any token values.

## Replit

After importing the repository:

```bash
pnpm deployment:start
```

When prompted, open Replit Connections, authorize Google Drive, and rerun the command. Add `OPENROUTER_API_KEY` through Replit Secrets.

## Manus

Connect Google Drive in Manus, then instruct Manus to run:

```bash
pnpm deployment:start
```

Use `deployment/MANUS_PROMPT.md` as the handoff instruction.

## Termux or local computer

Set a Google Drive-backed folder:

```bash
export GOOGLE_DRIVE_RAG_PATH=/path/to/google-drive-rag
pnpm deployment:start
```

On Termux, a typical path is:

```bash
export GOOGLE_DRIVE_RAG_PATH="$HOME/storage/shared/GoogleDriveRAG"
```
