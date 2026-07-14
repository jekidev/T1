# Realtime observability and session replay

## Architecture

```text
Browser instrumentation
├── local event batching
├── consent-controlled Highlight session replay
└── consent-controlled rrweb self-hosted fallback
          ↓
API observability routes
├── SSE developer stream
├── privacy redaction
├── bounded rrweb retention
└── OpenTelemetry spans
          ↓
OTLP exporter
          ↓
Highlight or another OTLP-compatible dashboard
```

OpenTelemetry is the standard trace API. The existing local event feed remains available as a zero-configuration fallback and developer panel source.

## Server configuration

```bash
OTEL_SERVICE_NAME=operation-kobenhavn-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector.example.com
OTEL_EXPORTER_OTLP_HEADERS=authorization=Bearer%20replace-me
```

`HIGHLIGHT_OTLP_ENDPOINT` can be used instead of `OTEL_EXPORTER_OTLP_ENDPOINT` when Highlight is the selected OTLP backend.

No exporter is started when neither endpoint is configured. Local structured logs and `/api/observability/stream` continue to work.

## Browser configuration

```bash
VITE_HIGHLIGHT_PROJECT_ID=your-highlight-project-id
VITE_SESSION_REPLAY_FALLBACK=rrweb
```

Selection logic:

1. no user consent → no session replay
2. consent + Highlight project ID → Highlight
3. consent + no Highlight ID + rrweb fallback flag → self-hosted rrweb
4. otherwise → replay disabled

Highlight and rrweb are never started simultaneously.

## Consent

A consent card is displayed until the user chooses:

- `Allow diagnostics`
- `No replay`

The decision is stored in local storage under:

```text
operation-kobenhavn-observability-consent
```

Regular error/log/trace telemetry remains privacy-redacted and independent from full session replay. Session replay itself only starts after explicit consent.

## Privacy controls

The browser recorder blocks or masks:

- password fields
- fields whose names contain `token`, `secret` or `key`
- `.monaco-editor`
- `[data-secret]`
- `[data-token]`
- `[data-api-key]`
- `[data-replay-block]`
- canvas contents
- inline images

Highlight runs with:

```text
privacySetting = strict
disableConsoleRecording = true
enableCanvasRecording = false
inlineImages = false
manualStart = true
network request bodies and headers = disabled
storageMode = sessionStorage
```

The server applies a second redaction layer for:

- authorization headers
- cookies
- JWT-like strings
- API-key patterns
- passwords
- secrets
- private keys
- `.env` data

## Retention and replay administration

Self-hosted rrweb fallback defaults to seven days.

```bash
SESSION_REPLAY_RETENTION_DAYS=7
SESSION_REPLAY_ROOT=/persistent/session-replay
OBSERVABILITY_REPLAY_ADMIN_TOKEN=replace-with-a-separate-admin-token
```

Old files are deleted during ingestion and listing. The replay endpoints are:

```text
POST /api/observability/replay/:sessionId
GET  /api/observability/replay
GET  /api/observability/replay/:sessionId
```

The POST endpoint accepts privacy-sanitized, consent-generated rrweb batches. Both GET endpoints are disabled until `OBSERVABILITY_REPLAY_ADMIN_TOKEN` contains at least 24 characters. Retrieval then requires either:

```http
Authorization: Bearer <admin-token>
```

or:

```http
X-Observability-Admin-Token: <admin-token>
```

This token must never be exposed in frontend build variables. Project authentication and authorization should still protect observability administration in a public production deployment. Highlight-hosted retention is controlled in Highlight settings.

## Instrumented spans

Implemented or exposed:

- `asset.source.upload`
- `asset.job.create`
- `asset.generate`
- `asset.artifact.upload`
- `asset.publish`
- `observability.replay.ingest`
- browser network request completion/failure
- browser uncaught errors and rejected promises
- board state changes
- HTTP request completion

The common helper APIs are:

```ts
await withSpan("game.asset.load", attributes, async span => {
  // server operation
})

await withClientSpan("runtime.code.execute", metadata, async () => {
  // browser operation
})
```

The following names are reserved for incremental instrumentation as their subsystems are activated:

- `game.scene.load`
- `game.asset.load`
- `game.simulation.tick`
- `game.navigation.path`
- `game.ai.strategy`
- `game.ai.tool_call`
- `game.multiplayer.sync`
- `asset.optimize`
- `asset.validate`
- `runtime.code.execute`

## Highlight, OpenReplay and rrweb evaluation

| Repository | Role |
|---|---|
| `highlight/highlight` | Primary unified dashboard for replay, errors, logs and traces |
| `openreplay/openreplay` | Optional future self-hosted full dashboard adapter |
| `rrweb-io/rrweb` | Lightweight self-hosted recording fallback used by the current implementation |
| `open-telemetry/opentelemetry-js` | Standard tracing API and OTLP export layer |

Highlight is selected as the primary dashboard because the same platform can correlate session replay, errors, logs and traces. rrweb is retained as a storage-controlled fallback. OpenReplay is not bundled into the application and can be evaluated as an alternate self-hosted deployment without changing the application trace contracts.

## Operational restrictions

Never add these values to span attributes, event payloads or session metadata:

- API keys
- OpenRouter keys
- authentication tokens
- cookies
- raw authorization headers
- `.env` contents
- source files marked secret in Monaco
- worker credentials
- deployment secrets

Use identifiers, status codes, model names, durations and byte counts instead.
