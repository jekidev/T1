# MCP integration layer

## Implemented inside T1

- Memory store and API
- Read-only allowlisted filesystem access
- MCP registry and configuration health
- Telegram authentication proxy
- A* and Dijkstra path-planning API
- Controlled observe → diagnose → propose → approve evolution workflow

## API endpoints

```text
GET    /api/mcp/servers
GET    /api/mcp/memory
POST   /api/mcp/memory
DELETE /api/mcp/memory/:id
GET    /api/mcp/filesystem/list?path=features
GET    /api/mcp/filesystem/read?path=features/README.md

GET    /api/telegram/auth/status
POST   /api/telegram/auth/start
POST   /api/telegram/auth/verify
POST   /api/telegram/auth/logout

POST   /api/path-planning/plan

GET    /api/evolve/proposals
POST   /api/evolve/analyze
POST   /api/evolve/proposals/:id/decision
```

## Vendor installation

Telegram MCP requires [uv](https://docs.astral.sh/uv/). Install it and ensure `uv` is on your `PATH` before running the vendor setup.

Run:

```bash
pnpm setup:mcp
```

This clones:

- `chigwell/telegram-mcp` into `integrations/vendor/telegram-mcp`
- `megahomyak/tg_auth_api` into `integrations/vendor/tg_auth_api`

For `telegram-mcp`, the setup script also runs `uv sync` in `integrations/vendor/telegram-mcp` to install the locked Python dependencies and create the project environment. If `uv` is missing, the clone will finish but the dependency sync is skipped and a warning is printed.

The auth repository is treated as an external service behind `TELEGRAM_AUTH_API_URL`. Its exact startup command and endpoint names may differ by revision; configure or adapt the proxy before production use. Secrets and Telegram session strings must remain in the hosting platform secret store.

## Telegram API id and hash

`Anon4You/Telegram-Api` is cloned into `integrations/vendor/telegram-api` and its Python dependencies are installed by `pnpm setup:mcp`. It is an optional helper that fetches the app-level `api_id` and `api_hash` from `my.telegram.org`.

Run the non-interactive fetcher:

```bash
TELEGRAM_FETCH_PHONE=+4512345678 \
  TELEGRAM_FETCH_CODE=12345 \
  TELEGRAM_FETCH_UPDATE_DOTENV=1 \
  pnpm mcp:fetch-telegram-api
```

When `TELEGRAM_FETCH_UPDATE_DOTENV=1` is set, `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` are written to `.env`. The phone number and one-time code are never logged or persisted.

You can also run the underlying Python script directly:

```bash
python scripts/fetch_telegram_api.py
```

## Multi-account sessions

All Telegram accounts share the same `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`. `telegram-mcp` supports multiple accounts through labelled session strings:

```bash
# Generate the default session
uv --directory integrations/vendor/telegram-mcp run session_string_generator.py

# Generate a labelled account, e.g. 'work'
uv --directory integrations/vendor/telegram-mcp run session_string_generator.py --phone
```

Set the generated strings in `.env`:

```text
TELEGRAM_SESSION_STRING=...
TELEGRAM_SESSION_STRING_WORK=...
TELEGRAM_SESSION_STRING_PERSONAL=...
```

Then run the Telegram MCP server. Each account becomes selectable through the `account` parameter on multi-account tools.

## Telegram modify mode

`TELEGRAM_EXPOSED_TOOLS=all` exposes read and modifying Telegram tools. T1 marks Telegram writes as approval-required. The AI must show the intended recipients, action and payload before a modifying call is authorized.

## External MCP services

- GitHub MCP uses GitHub's remote MCP endpoint.
- Hugging Face Hub MCP uses the Hub MCP endpoint.
- Google Maps uses a server-side adapter and `GOOGLE_MAPS_API_KEY`.
- Playwright MCP runs through `npx @playwright/mcp@latest` in an approved development runtime.
- RSSHub is accessed through `RSSHUB_BASE_URL`.

Browser code never receives provider tokens and cannot directly spawn arbitrary stdio processes.
