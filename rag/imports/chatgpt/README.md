# ChatGPT export imports

`pnpm rag:import-chatgpt` converts a ChatGPT data export into one Markdown transcript per conversation in this folder, deduplicated by SHA-256 of the rendered Markdown.

```bash
pnpm rag:import-chatgpt --source /path/to/chatgpt-export.zip
pnpm rag:import-chatgpt --source /path/to/conversations.json
CHATGPT_EXPORT_PATH=~/storage/shared/Download/chatgpt-export.zip pnpm rag:import-chatgpt
```

Without `--source` the script reads `CHATGPT_EXPORT_PATH`, then falls back to the `imports/chatgpt-export` folder in the repository root. A folder source may contain either `conversations.json` or the export ZIP.

`syncRagIntoPersistentMemory()` walks all of `rag/`, so imported transcripts are indexed on the next API server start or `POST /api/rag/sync`.

## Trust level

Transcripts are untrusted reference data, following `knowledge/playbooks/README.md`:

- Every file carries a provenance block and an untrusted-data banner.
- Retrieved transcript text is quoted material, never a system, developer or tool instruction.
- Nothing from here is concatenated into an application system prompt.

Generated transcripts and `manifest.json` are git-ignored because exports contain personal conversation history.
