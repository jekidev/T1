# T1 — Operation København (Biohacking / Longevity Webapp)

An AI-first longevity and biohacking research platform. The AI continuously observes, explains, and coaches based on Google Drive RAG knowledge, PubMed data, and user-driven scenarios. Built as a pnpm monorepo with an Express API and a React/Vite frontend (with a Nuxt frontend in progress).

## Run & Operate

- **Start all services**: use the workflow run buttons (API Server + Nordlys Command)
- **API server** (port from `PORT` env): `pnpm --filter @workspace/api-server run dev`
- **React frontend** (command-sim): `pnpm --filter @workspace/command-sim run dev`
- **Install deps**: `pnpm install`
- **RAG sync**: `pnpm rag:sync`
- **MCP vendor setup**: `pnpm setup:mcp`
- **Typecheck**: `pnpm run typecheck`
- **Build**: `pnpm run build`

## Stack

- **Monorepo**: pnpm workspaces, Node.js 20, TypeScript 5.9
- **API**: Express 5 (`artifacts/api-server`)
- **Frontend (current)**: React + Vite + shadcn/ui (`artifacts/command-sim`) — dark blue tactical theme
- **Frontend (in progress)**: Nuxt 3 — black/white/gray + purple/blue/orange theme
- **LLM**: OpenRouter (multi-model rotation) — requires `OPENROUTER_API_KEY` secret
- **RAG**: Google Drive-oriented; files go in `rag/` or set `GOOGLE_DRIVE_RAG_PATH`
- **Maps**: Google Maps (falls back to OpenStreetMap if `VITE_GOOGLE_MAPS_API_KEY` is empty)

## Required Secrets

- `OPENROUTER_API_KEY` — must be added via Replit Secrets for LLM features to work
- `SESSION_SECRET` — already configured

## Where things live

- `artifacts/api-server/src/` — Express routes, LLM, RAG, observability
- `artifacts/command-sim/src/` — React frontend (pages, components, game lib)
- `artifacts/api-server/src/lib/openrouter.ts` — LLM routing
- `artifacts/api-server/src/lib/rag-memory.ts` — RAG ingestion
- `artifacts/command-sim/src/index.css` — design tokens / CSS variables
- `docs/` — project specs, Figma notes, world spec
- `rag/` — RAG inbox and Google Drive sync folder
- `scripts/` — setup, RAG sync, MCP vendor install

## Architecture decisions

- LLM routing via OpenRouter with `rotate | static | off` modes — falls back to deterministic output when LLM unavailable
- RAG deduplication by SHA-256; persistent memory injected into every advisor request
- Google Drive is the only external RAG source — OAuth tokens stay in Replit connections, never in GitHub
- Three-column resizable board layout: left palette rail, center map canvas, right advisor/properties rail
- MCP registry in `integrations/mcp/` — write/modify ops require explicit approval

## Frontend direction (active)

- **Building**: New Nuxt 3 frontend (`artifacts/nuxt-frontend`)
- **Theme**: black/white/gray base + purple/blue/orange accent palette
- **Goal**: replaces the React command-sim UI, works as a pure webapp (Replit/GitHub), structure ready for future Tauri desktop packaging

## User preferences

- Push to GitHub regularly — user is on free plan and works across Devin → Replit → Manus
- Keep OAuth tokens and API keys in platform secrets, never in GitHub
- Preserve existing pnpm workspace, Express API, and Google Drive RAG flow
- Use `observe → diagnose → propose → approve → apply → validate` workflow for all changes
