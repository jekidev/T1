# SPEC-003: RAG Ingestion

- **Spec ID**: SPEC-003
- **Status**: Draft

## Problem Statement
Transcripts and imported documents need to be chunked, embedded, and made
searchable via pgvector.

## Goals
- Normalize and chunk any `documents` row.
- Generate embeddings via OpenAI and store them in `chunks`.
- Provide similarity search with citations.

## Non-goals
- Cross-user search (each user only searches their own memory).

## Functional Requirements
- `/api/rag/ingest` takes a `document_id`, produces `chunks` rows with
  embeddings.
- `/api/rag/search` takes a query string, returns top-k chunks with
  similarity scores and source citations.

## Non-functional Requirements
- Ingestion should be resumable — safe to re-run without duplicating chunks
  (delete-and-replace by `document_id`, or dedupe by `chunk_index`).

## User Stories
- As a user, after importing a file, I can search for a phrase and get back
  relevant excerpts with a link to the source.

## Technical Design
- `packages/rag`: `normalize`, `chunk`, `embed`, `search` functions.
- Postgres function using pgvector `<=>` cosine distance operator, scoped
  by `user_id`.

## Database Changes
- Uses `documents`, `chunks` (pgvector column), see `docs/DATABASE.md`.

## API Changes
- `/api/rag/ingest` (POST)
- `/api/rag/search` (POST)

## Security & Privacy Review
- RLS ensures `chunks`/`documents` are only queryable by their `user_id`.

## Testing Strategy
- Unit tests for chunking boundaries and overlap.
- Integration test: ingest a known document, search a known phrase, assert
  it's returned.

## Rollback Plan
- Ingestion failures mark the `documents` row `status: 'failed'`; safe to
  retry without side effects.

## Acceptance Criteria
- [ ] Ingesting a document produces non-empty `chunks` with embeddings.
- [ ] Search returns relevant chunks with citations for a known query.
- [ ] Re-ingesting a document does not create duplicate chunks.

## Future Improvements
- Hybrid search (keyword + vector), re-ranking, summarized citations.
