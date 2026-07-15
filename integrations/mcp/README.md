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

## Telegram modify mode

`TELEGRAM_EXPOSED_TOOLS=all` exposes read and modifying Telegram tools. T1 marks Telegram writes as approval-required. The AI must show the intended recipients, action and payload before a modifying call is authorized.

## External MCP services

- GitHub MCP uses GitHub's remote MCP endpoint.
- Hugging Face Hub MCP uses the Hub MCP endpoint.
- Google Maps uses a server-side adapter and `GOOGLE_MAPS_API_KEY`.
- Playwright MCP runs through `npx @playwright/mcp@latest` in an approved development runtime.
- RSSHub is accessed through `RSSHUB_BASE_URL`.

Browser code never receives provider tokens and cannot directly spawn arbitrary stdio processes.
