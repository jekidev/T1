# Personal Memory Framework

A mobile-first, GitHub-first, spec-driven personal AI memory / RAG system.
Record audio from your phone, upload AI conversations and files, transcribe,
embed, and search/chat with your own personal knowledge base.

## 1. What this project is

Personal Memory Framework (PMF) lets you:
- Record voice notes from your phone and transcribe them automatically.
- Import AI conversations and text/markdown/json/html files.
- Store everything in Supabase (Postgres + Storage + pgvector).
- Chunk and embed content with OpenAI, then search and chat over it (RAG).
- Track daily summaries, export your data, and delete it on demand.

Development follows a **Spec Kit** workflow (see `docs/spec-kit/`): no
feature is implemented without a written spec, and every PR references a
Spec ID. This makes the codebase easy to hand off between AI coding tools
(Replit, Devin, Windsurf, Cursor).

## 2. How to run in Replit

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + OpenAI values
pnpm --filter web dev
```

The web app runs on the port Replit assigns via the `PORT` env var.

## 3. How to connect Supabase

1. Create a project at supabase.com.
2. Copy the Project URL and anon/service role keys into `.env.local`.
3. Enable the `pgvector` extension in the Supabase SQL editor.
4. Run the schema migration described in `docs/DATABASE.md`.
5. Create two Storage buckets: `audio` and `imports`.

## 4. How to add your OpenAI API key

Add `OPENAI_API_KEY` to `.env.local` (never commit it, never expose it
client-side). It is used server-side only, in API routes and background jobs.

## 5. How to push to GitHub

```bash
git init
git add .
git commit -m "chore: initial Personal Memory Framework skeleton"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

See `docs/GITHUB_WORKFLOW.md` for branch/PR conventions.

## 6. How to continue in Devin / Windsurf / Cursor

Read `AI_CONTEXT.md` first, then the tool-specific file (`DEVIN.md`,
`WINDSURF.md`). `project.index.json` is the machine-readable map of the
repo — keep it updated as you build. See `docs/DEVIN_WINDSURF_HANDOFF.md`.

## 7. How the Spec Kit workflow works

Idea → Specification → Architecture Review → Task Breakdown →
Implementation → Testing → Documentation Update → Pull Request → Merge →
Archive Spec. See `docs/spec-kit/SPEC_GUIDE.md`.

## 8. How RAG works

See `docs/RAG_PIPELINE.md`. Short version: ingest → normalize → chunk →
embed → store in pgvector → similarity search → cite → generate answer.

## 9. How transcription works

See `docs/TRANSCRIPTION_PIPELINE.md`. Short version: upload audio → store
in Supabase Storage → create a job → send to OpenAI speech-to-text → save
transcript → chunk + embed → mark job complete/failed.

## 10. Current MVP limitations

- No real-time streaming transcription (batch only).
- No mobile native app — mobile-first responsive web only.
- No multi-user sharing/collaboration — single-owner memory store.
- Background jobs run inline in API routes, not a dedicated worker/queue yet.
- No fine-grained RBAC — one authenticated user owns all their data.

## Privacy notice

Only record conversations where you have consent or a legal right to
record. You are responsible for complying with applicable recording and
privacy laws in your jurisdiction.

## Repository layout

See `project.index.json` and `docs/ARCHITECTURE.md`.
