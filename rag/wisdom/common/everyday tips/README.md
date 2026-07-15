# Everyday Tips — hourly LLM heads-up source

Place personal everyday-wisdom material in this folder.

Supported formats:

- `.md`
- `.txt`
- `.text`
- `.json`
- `.csv`
- `.yaml` / `.yml`
- `.pdf` through PyMuPDF
- `.docx` through the bundled Python standard-library extractor
- legacy `.doc` when `antiword` is installed

The server synchronizes this folder into persistent RAG memory and selects one source at a time for the hourly heads-up service.

Source text is treated as untrusted reference material. It is never promoted to a system prompt, and a generated heads-up must not invent medical, legal, financial, or safety claims.

After adding files, restart the server or call:

```bash
curl -X POST http://localhost:8080/api/rag/sync
```

Manual heads-up generation:

```bash
curl -X POST http://localhost:8080/api/llm/headsup/refresh \
  -H 'Content-Type: application/json' \
  -d '{"mode":"balanced"}'
```
