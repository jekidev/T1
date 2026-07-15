# RAG preservation policy

All existing source material under `rag/**` is immutable, including DeepSeek scripts, prompt files, exports and conversation archives.

## Allowed

- Read and index existing files.
- Add new files in new or existing RAG directories.
- Add provenance manifests beside newly imported files.
- Rebuild the separate runtime index in `.runtime/rag-persistent-memory.json`.
- Create a new content-addressed version when a remote source changes.

## Forbidden

- Delete an existing RAG file.
- Rename or move an existing RAG file.
- Rewrite, redact, abstract, sanitize or overwrite an existing RAG file.
- Replace a DeepSeek script or conversation with a summary.
- Use the runtime index rebuild to mutate source files.

`pnpm check:rag-preservation` enforces the repository rule in CI. Runtime importers use immutable writes: identical files are reused and changed upstream content is stored under a new content-addressed name.
