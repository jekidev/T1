# Database Schema

All tables live in Supabase Postgres. `pgvector` extension is required for
`chunks.embedding`. Every table has Row Level Security scoped to `user_id`
(except `audit_logs`, which is insert-only and read-scoped to the owning user).

## users
Managed by Supabase Auth (`auth.users`). App-level profile fields can be
added in a `public.users` table keyed by `auth.users.id`.
- id (uuid, pk, = auth.users.id)
- created_at, updated_at
- metadata (jsonb)

## recordings
- id (uuid, pk)
- user_id (uuid, fk users)
- audio_url (text) — Supabase Storage path
- transcript (text, nullable)
- source_type (text) — 'phone' | 'upload'
- status (text) — 'recorded' | 'transcribing' | 'transcribed' | 'failed'
- duration_seconds (int, nullable)
- metadata (jsonb)
- created_at, updated_at

## imports
- id (uuid, pk)
- user_id (uuid, fk users)
- file_url (text)
- file_type (text) — 'txt' | 'md' | 'json' | 'html'
- source_type (text)
- status (text) — 'pending' | 'processed' | 'failed'
- metadata (jsonb)
- created_at, updated_at

## documents
Normalized text content derived from a recording or import, before chunking.
- id (uuid, pk)
- user_id (uuid, fk users)
- source_id (uuid) — recordings.id or imports.id
- source_type (text)
- content (text)
- status (text)
- metadata (jsonb)
- created_at, updated_at

## chunks
- id (uuid, pk)
- user_id (uuid, fk users)
- document_id (uuid, fk documents)
- content (text)
- embedding (vector(1536))
- chunk_index (int)
- source_type (text)
- status (text)
- metadata (jsonb)
- created_at, updated_at

## tags
- id (uuid, pk)
- user_id (uuid, fk users)
- name (text)
- created_at, updated_at

## daily_summaries
- id (uuid, pk)
- user_id (uuid, fk users)
- summary_date (date)
- content (text)
- source_type (text)
- status (text)
- metadata (jsonb)
- created_at, updated_at

## ai_conversations
Imported chat transcripts from other AI tools.
- id (uuid, pk)
- user_id (uuid, fk users)
- title (text)
- content (jsonb) — normalized message list
- source_type (text)
- status (text)
- metadata (jsonb)
- created_at, updated_at

## jobs
Generic background job tracker for transcription/embedding/summaries.
- id (uuid, pk)
- user_id (uuid, fk users)
- job_type (text) — 'transcription' | 'embedding' | 'summary'
- source_id (uuid)
- source_type (text)
- status (text) — 'pending' | 'processing' | 'completed' | 'failed'
- error (text, nullable)
- metadata (jsonb)
- created_at, updated_at

## audit_logs
- id (uuid, pk)
- user_id (uuid, fk users)
- action (text)
- source_type (text)
- source_id (uuid, nullable)
- metadata (jsonb)
- created_at
