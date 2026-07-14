# Transcription Pipeline

1. **Upload audio** — client records via the browser `MediaRecorder` API on
   `/record`, or uploads an existing audio file on `/uploads`.
2. **Store file** — audio is uploaded to the Supabase Storage `audio`
   bucket; `recordings.audio_url` stores the path.
3. **Create transcription job** — a `jobs` row (`job_type: 'transcription'`)
   is created with `status: 'pending'`.
4. **Send to OpenAI speech-to-text** — the server downloads the audio from
   Storage and calls the OpenAI transcription API.
5. **Save transcript** — result is written to `recordings.transcript` and a
   `documents` row is created from it.
6. **Chunk transcript** — handed off to the RAG pipeline (`packages/rag`).
7. **Embed chunks** — embeddings generated and stored in `chunks`.
8. **Mark job completed or failed** — `jobs.status` updated; on failure the
   real error message is stored in `jobs.error`, and the recording's status
   becomes `failed` (never silently marked as success).
