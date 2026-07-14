# SPEC-001: Mobile Recording MVP

- **Spec ID**: SPEC-001
- **Status**: Draft

## Problem Statement
Users need a fast, reliable way to record voice notes from their phone
browser without installing a native app.

## Goals
- Record audio in-browser on `/record` using the MediaRecorder API.
- Upload the recording to Supabase Storage (`audio` bucket).
- Create a `recordings` row and kick off a transcription job.

## Non-goals
- Native iOS/Android app.
- Real-time streaming transcription during recording.

## Functional Requirements
- Start/stop/pause recording controls.
- Show recording duration and a simple waveform/level indicator.
- On stop, upload the audio blob and show upload progress.
- Show real errors if mic permission is denied or upload fails.

## Non-functional Requirements
- Works on iOS Safari and Android Chrome mobile browsers.
- Recording page must be usable one-handed, thumb-reachable controls.

## User Stories
- As a user, I tap Record, speak, tap Stop, and see it appear in my
  recordings list with a "transcribing" status.

## Technical Design
- Client component using `MediaRecorder`, produces a webm/opus (or
  platform-supported) blob.
- `/api/recordings/create` returns a signed upload URL (or accepts a
  multipart upload) and creates the `recordings` row with `status: 'recorded'`.
- On successful upload, client calls `/api/recordings/transcribe`.

## Database Changes
- Uses existing `recordings` and `jobs` tables (see `docs/DATABASE.md`).

## API Changes
- `/api/recordings/create` (POST)
- `/api/recordings/transcribe` (POST)

## Security & Privacy Review
- Only the authenticated owner can create/read their recordings (RLS).
- Show a visible consent reminder before first recording.

## Testing Strategy
- Manual test on iOS Safari + Android Chrome.
- Unit tests for the upload/status state machine.

## Rollback Plan
- Feature-flag the `/record` page; disable it and fall back to `/uploads`
  (manual audio file upload) if recording is broken.

## Acceptance Criteria
- [ ] User can record, stop, and see upload progress.
- [ ] Recording appears in `recordings` with correct `status` transitions.
- [ ] Errors (permission denied, upload failure) are shown, not swallowed.

## Future Improvements
- Background/offline recording with retry queue.
- Live transcription preview.
