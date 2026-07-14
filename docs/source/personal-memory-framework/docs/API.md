# API Routes

All routes are Next.js route handlers under `apps/web/src/app/api/`. All
require an authenticated Supabase session unless noted. Requests/responses
are JSON.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/recordings/create` | POST | Create a recording record + get a signed upload URL |
| `/api/recordings/transcribe` | POST | Trigger transcription job for a recording |
| `/api/imports/upload` | POST | Upload/import a .txt/.md/.json/.html file |
| `/api/rag/ingest` | POST | Normalize + chunk + embed a document |
| `/api/rag/search` | POST | Similarity search over the user's chunks |
| `/api/chat` | POST | RAG chat: search + generate an answer with citations |
| `/api/summaries/daily` | GET/POST | Fetch or generate a daily summary |
| `/api/export` | GET | Export all of the user's data as JSON |
| `/api/delete` | POST | Permanently delete all of the user's data |
| `/api/specs/list` | GET | List specs (active/completed/archive) from the repo |
| `/api/specs/create` | POST | Scaffold a new spec file from a template |

Errors return `{ "error": { "code": string, "message": string } }` with a
non-2xx status. Never return fabricated success payloads for failed
transcription/embedding/RAG calls — propagate the real error.
