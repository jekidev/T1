# Architecture

## Client

React + Vite + React Router. `AppProvider` håndterer historier. `TtsProvider` ligger over routerens routes og remountes derfor ikke ved intern navigation.

## Server

Express på port 8787. Serveren er proxy for AI, TTS, modelkatalog, secret store og GitHub-status.

## Persistence

- Manuskripter: localStorage i MVP
- TTS-session og audio blobs: IndexedDB
- Secrets: krypteret filserver

## Næste arkitekturtrin

- Postgres/Supabase med row-level security
- Brugerlogin og server-side projektlager
- Job queue til lange AI-analyser og TTS-batches
- Object storage til lyd
- GitHub App/OAuth til automatiske backups
