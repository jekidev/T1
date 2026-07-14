# RAG Pipeline

1. **Ingest source** — a recording transcript, an imported file, or an
   AI conversation becomes a `documents` row.
2. **Normalize text** — strip formatting artifacts, normalize whitespace,
   decode HTML/JSON into plain text (`packages/rag`).
3. **Chunk text** — split into overlapping chunks (target ~500-800 tokens,
   ~15% overlap) preserving order via `chunk_index`.
4. **Generate embeddings** — OpenAI embeddings API, one call per chunk
   (or batched), model configurable via `packages/rag` config.
5. **Store chunks** — insert into `chunks` with `embedding vector(1536)`.
6. **Search similar chunks** — pgvector cosine similarity search scoped to
   `user_id`, top-k configurable.
7. **Return citations** — each search result includes `document_id`,
   `chunk_id`, and source metadata so answers can be traced back.
8. **Generate answer with context** — OpenAI chat completion using the
   retrieved chunks as context, returning the answer plus citations.

No step in this pipeline may be mocked. If OpenAI or Supabase calls fail,
the job is marked `failed` in `jobs` with the real error message.
