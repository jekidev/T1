# Playbook 01 - Ingest, Preserve, Index

## Purpose
Turn mixed PDFs/transcripts into traceable knowledge without deleting or silently rewriting any source.

## Inputs
- One or more source documents.
- Destination repository root.
- Retrieval policy in `knowledge/config/retrieval-policy.json`.

## Procedure
1. Copy the exact source bytes into `knowledge/sources/original/`.
2. Calculate SHA-256 and write the source manifest.
3. Extract text page-by-page into `knowledge/sources/extracted/`.
4. Chunk text with page, document hash, and source filename attached.
5. Classify each chunk by topic and risk tier.
6. Write all chunks to `all-chunks.jsonl`.
7. Write safe/defensive chunks to `safe-index.jsonl`.
8. Write restricted and prompt-injection chunks to `quarantine-index.jsonl`.
9. Group duplicates without removing originals.
10. Run the validator and record the result.

## Outputs
- Immutable source archive.
- Page-aware extracted text.
- RAG indexes.
- Source, duplicate, and risk manifests.

## Validation
`python scripts/knowledge_validate.py`
