# AI Context

Read this first if you are an AI coding assistant (Devin, Windsurf, Cursor,
Replit Agent) continuing work on this repo.

## What this is
Personal Memory Framework: Next.js + TypeScript + Tailwind + Supabase
(Auth/Postgres/Storage/pgvector) + OpenAI (transcription, embeddings, chat).
A personal RAG system for voice recordings and imported text/AI conversations.

## Ground truth files
- `project.index.json` — machine-readable map of apps, packages, docs,
  scripts, DB tables, API routes, env vars, active/completed specs, TODOs.
- `docs/ARCHITECTURE.md` — system design.
- `docs/DATABASE.md` — schema.
- `docs/spec-kit/SPEC_GUIDE.md` — how specs work, and why you must write one
  before implementing anything.

## Hard rules
1. No feature without a spec in `specs/active/` first.
2. Never fake transcription, embeddings, or RAG results. Surface real errors.
3. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` client-side.
4. Update `project.index.json` and relevant docs whenever architecture changes.
5. Every PR references a Spec ID (see `.github/PULL_REQUEST_TEMPLATE.md`).

## Where to start
1. Read `project.index.json` → `next_actions`.
2. Read the relevant active spec in `specs/active/`.
3. Implement in the matching package under `packages/*` or `apps/web`.
4. Update docs + index, open a PR.
