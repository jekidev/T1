# Architecture

## Overview

```
apps/web            Next.js app (pages, API routes, UI)
packages/core        Shared domain types + orchestration logic
packages/rag         Chunking, embeddings, similarity search, answer generation
packages/transcription  Audio upload handling, OpenAI speech-to-text, job state
packages/storage     Supabase Storage helpers (audio/imports buckets)
packages/db          Supabase/Postgres client, schema types, queries
packages/shared      Cross-cutting utils (env validation, logging, types)
```

## Data flow

1. **Recording**: phone → `/record` page → `/api/recordings/create` →
   `packages/storage` (Supabase Storage) → `/api/recordings/transcribe` →
   `packages/transcription` → OpenAI → `packages/db` (transcripts) →
   `packages/rag` (chunk + embed) → pgvector.
2. **Import**: `/uploads` or `/imports` page → `/api/imports/upload` →
   `packages/rag` ingest pipeline → pgvector.
3. **Search/Chat**: `/search` or `/chat` → `/api/rag/search` or `/api/chat`
   → `packages/rag` similarity search → OpenAI chat completion with
   retrieved context and citations.

## Principles

- All OpenAI and Supabase service-role calls happen server-side only
  (API routes / server actions), never in client components.
- `packages/*` are framework-agnostic TypeScript — no Next.js imports there.
- Every mutation touching `recordings`, `imports`, `documents`, or `chunks`
  writes a row to `audit_logs`.
- Background-style work (transcription, embedding) is modeled as rows in
  `jobs` with `status` (`pending`/`processing`/`completed`/`failed`) so it
  can later move to a real queue without changing the data model.
