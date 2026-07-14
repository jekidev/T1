# SPEC-002: Transcription Pipeline

- **Spec ID**: SPEC-002
- **Status**: Draft

## Problem Statement
Recorded/uploaded audio needs to become searchable text reliably and
observably.

## Goals
- Convert stored audio into a transcript via OpenAI speech-to-text.
- Track job progress and surface real failures.

## Non-goals
- Speaker diarization (future improvement).

## Functional Requirements
- `/api/recordings/transcribe` creates a `jobs` row, downloads audio from
  Storage, calls OpenAI, saves transcript, updates statuses.
- Failed jobs store the real error message in `jobs.error`.

## Non-functional Requirements
- Handle audio files up to a configurable max size/duration.
- Idempotent retry: re-running transcribe on a failed job doesn't duplicate data.

## User Stories
- As a user, I see my recording move from "transcribing" to "transcribed"
  (or "failed" with a reason) without manual refreshing (polling is fine for MVP).

## Technical Design
- `packages/transcription` exposes `transcribeRecording(recordingId)`.
- Uses OpenAI transcription API server-side only.
- On success, creates a `documents` row and hands off to `packages/rag`.

## Database Changes
- Uses `recordings`, `jobs`, `documents` (see `docs/DATABASE.md`).

## API Changes
- `/api/recordings/transcribe` (POST)

## Security & Privacy Review
- Transcripts are private to the owning user (RLS on `recordings`/`documents`).

## Testing Strategy
- Unit test job status transitions with a mocked OpenAI client interface
  (mock only the network boundary in tests, never in production code).

## Rollback Plan
- Mark job `failed` and leave the recording queryable/re-triggerable.

## Acceptance Criteria
- [ ] Successful transcription updates `recordings.transcript` and job status.
- [ ] Failure sets `status: 'failed'` with a real error message.
- [ ] Transcript triggers RAG ingestion (SPEC-003).

## Future Improvements
- Speaker diarization, language detection, streaming partial transcripts.
