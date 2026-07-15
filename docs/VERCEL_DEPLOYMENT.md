# Vercel deployment

The repository now contains a Vercel-compatible frontend and Express entrypoint:

- `api/index.ts` exports the existing Express application as a Vercel Function.
- `api/[...path].ts` preserves nested `/api/*` routes.
- `scripts/build-vercel.mjs` builds the Vite frontend and copies it into `.vercel-static`.
- `vercel.json` serves functions/files first and falls back to `index.html` for client routing.

## Required project settings

Connect `jekidev/T1` as one Vercel project with the repository root as **Root Directory**.

Add these secrets in Vercel, never in Git:

```text
DATABASE_URL
PUBLIC_BASE_URL
OPENROUTER_API_KEY
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_MAPS_API_KEY
VITE_GOOGLE_MAPS_API_KEY
NETWORK_PERMISSION_ADMIN_TOKEN
FIGMA_ACCESS_TOKEN
HUGGINGFACE_TOKEN
```

Optional deployment automation:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

## Persistent-state requirement

Vercel Functions have ephemeral local storage. The core UI and stateless API routes can run on Vercel, but the following production features require external persistent services:

- generated/imported asset binaries and manifests
- RAG imports and mutable RAG indexes
- world regions and placements
- coding-agent worktrees and worker logs
- long-running GPU/Blender generation
- Signal/Telegram companion services

Until external object storage and durable job/state storage are configured, these features are suitable only for preview sessions. Do not describe a preview deployment as persistent production.

Recommended production split:

```text
Vercel
├── React/Vite frontend
├── Express API function
└── OAuth callbacks

Durable services
├── managed PostgreSQL
├── object storage for assets/RAG
├── GPU/Blender worker
├── coding-agent worker
└── messaging bridge
```

## Build verification

```bash
pnpm install
node scripts/build-vercel.mjs
pnpm typecheck
pnpm test:integration
```

The deploy should not be promoted to production until the root lockfile is regenerated and all commands are green.
