# MMO Security Review — T1 Third-Person RPG Data Flow

This review documents how data flows between the MMO client, the T1 API, the database, RAG, and LLM providers, and the safeguards that must stay in place.

## Data flow

```
MMO browser client
        │
        ├─ GET  /api/scenarios/:id          ──> BoardState JSON
        ├─ POST /api/knowledge/query         ──> safe-index snippets
        └─ POST /api/advisor/chat            ──> LLM reply
        │
        ▼
artifacts/api-server
        │
        ├─ read/write pglite/Postgres DB
        ├─ read knowledge/rag/*.jsonl
        └─ call OpenRouter (server-side only)
```

## Key security assertions

1. **Secrets never reach the browser.** `OPENROUTER_API_KEY` is read server-side from `.env`. The MMO client only talks to `/api` routes.
2. **RAG text is data, not instructions.**
   - `knowledge/rag/safe-index.jsonl` contains source snippets.
   - Those snippets are returned by `POST /api/knowledge/query` with `risk_tier`, `source_name`, `page`, and `text`.
   - The MMO client may display them as in-world lore or quest background.
   - They must **never** be inserted into a system prompt or executed as code.
3. **Advisor endpoint already neutralizes source text.**
   - `artifacts/api-server/src/routes/advisor.ts` sends explicit system prompts that tell the model to separate facts, assumptions, and fictional balance.
   - `summarizeBoard` truncates `generatedContent` to 5,000 chars and the full board to 10,000 chars before sending to the LLM.
   - The advisor does not treat `board.notes` or `generatedContent` as instructions.
4. **Quarantine is currently empty, but the safe index still carries provenance.** Every `knowledge/query` result includes `source_name`, `page`, `risk_tier`, `chunk_id`, and `canonical_chunk_id`. The UI can show provenance inline.
5. **Turn resolution is deterministic and local.** `simulateTurn` does not call external APIs. If the MMO client imports it directly, the result is reproducible for the same `seed + turn + action`.

## MMO client responsibilities

When an external AI creator extends the client in `artifacts/third-person-mmo/`, these rules apply:

- **Do not store secrets in browser storage** (`localStorage`, `sessionStorage`, cookies). API credentials stay server-side.
- **Do not call OpenRouter/LLM providers directly from the browser.** Route every LLM request through `/api/advisor/chat`.
- **If you show RAG text to players, truncate and attribute it.** Use the `provenance` object returned by `/api/knowledge/query`.
- **If you include RAG text in advisor requests, add it as a user message, not a system message.** Example: `"Here is background lore the player just read: <snippet>. Reply in character."`
- **Validate the board before rendering.** Use `src/lib/validateBoardMapping.ts` or an equivalent; missing fields should disable the affected UI, not crash it.
- **Do not forward `rawModelOutput` to other players.** It is debugging context and can be large.
- **Never delete or overwrite existing files** without explicit approval (see `AGENTS.md`).

## Server-side safeguards already in place

| Concern | Mitigation |
|---|---|
| OpenRouter key exposure | stored in `.env`/secrets, never logged or sent to browser |
| Prompt injection from RAG | `advisor.ts` system prompts explicitly separate source text from instructions |
| Huge payloads | `summarizeBoard` truncates board JSON before LLM call |
| Quarantine leakage | `POST /api/knowledge/query` defaults to `safe-index.jsonl`; currently `quarantine-index.jsonl` is empty and not searched unless `includeQuarantine: true` |
| Source integrity | `knowledge/sources/original/` is byte-for-byte preserved |
| Replay abuse | `simulateTurn` is deterministic; store action history and replay server-side if needed |

## Recommendations for production deployment

- Serve the MMO client and API over HTTPS.
- Add a Content Security Policy (CSP) that blocks inline scripts not emitted by the build.
- Rate-limit `/api/advisor/chat` per scenario or per user.
- Add session authentication before allowing scenario mutations (`POST/PATCH/DELETE /api/scenarios`).
- Audit any new `advisor` role added for the MMO to ensure it does not grant real-world operational authority.

## Validation

Run before each commit:

```bash
pnpm typecheck
pnpm build
python scripts/knowledge_validate.py
```

These commands are part of CI for PR #22.
