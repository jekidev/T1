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
GET    /api/rag/search?q=nmn&prefix=longevity/protocols
GET    /api/mcp/memory
POST   /api/mcp/memory
DELETE /api/mcp/memory/:id
GET    /api/mcp/filesystem/list?path=features
GET    /api/mcp/filesystem/read?path=features/README.md
GET    /api/mcp/servers/:id/health

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

Run:

```bash
pnpm setup:mcp
```

This clones and builds:

- `chigwell/telegram-mcp` into `integrations/vendor/telegram-mcp`
- `jekidev/telegram-mcp-1` into `integrations/vendor/telegram-mcp-1` (Telegram MCP v2)
- `megahomyak/tg_auth_api` into `integrations/vendor/tg_auth_api`
- `gonchasobaka/agents-sms` into `integrations/vendor/agents-sms` (5sim / SMS-Activate / OnlineSim)
- `jiridudekusy/signal-cli-mcp` into `integrations/vendor/signal-cli-mcp`

The auth repository is treated as an external service behind `TELEGRAM_AUTH_API_URL`. Its exact startup command and endpoint names may differ by revision; configure or adapt the proxy before production use. Secrets and Telegram session strings must remain in the hosting platform secret store.

## 5sim / SMS provider MCP

`agents-sms` is a local stdio MCP for buying virtual phone numbers and receiving SMS codes. Set at least one provider key (`FIVESIM_API_KEY`, `SMSACTIVATE_API_KEY`, or `ONLINESIM_API_KEY`) before enabling the server. Purchasing numbers is treated as an approval-required write.

It is patched by T1 to:

- Cache `findCheapestProvider` price lookups for 5 minutes, so consecutive `buy_number` calls for the same service/country are fast.
- Cache `get_sms` status responses for 5 seconds, reducing provider polling.
- Cache `list_services` results for 5 minutes by country/search, so price browsing is fast and avoids repeated provider API calls.
- Redact configured provider API keys from all tool output and stderr logs.
- Start successfully even when no provider keys are set, returning an empty provider list for smoke tests.

Run the smoke test with `pnpm test:5sim-smoke`.

## Longevity scraping

Feeds and PubMed queries are configured in `integrations/longevity-sources.json` and fetched by `pnpm rag:scrape-longevity` into `rag/longevity/feeds`, where the RAG memory sync indexes them. Sources that block plain HTTP clients (currently `peter-attia`) stay disabled and should be fetched through the RSSHub or Playwright MCP instead.

## Discord research bridge

`integrations/discord/discord_bridge.py` answers `/rag`, `/protocols`, `/labs`, `/feeds`, `/status` and `/sync` from Discord by calling the T1 API, and posts research heads-ups through an incoming webhook. Reindexing is the only write and requires `DISCORD_ALLOW_WRITES=true`. See `integrations/discord/README.md`.

## Signal CLI MCP

`signal-cli-mcp` proposes sending Signal messages and creating groups, but nothing is sent without explicit human approval through a local web GUI. It requires a running `signal-cli-rest-api` instance; start it with the `docker-compose.yml` in `integrations/vendor/signal-cli-mcp` and link the device via the QR code endpoint. Set `SIGNAL_ACCOUNT` to the registered E.164 number.

## Telegram MCP v2

`telegram-mcp-1` is an alternative Telegram MCP server based on `telethon` with 80+ tools grouped into accounts, chats, messages, contacts, media, groups, folders and profile. It runs with `uv --directory integrations/vendor/telegram-mcp-1 run main.py` and requires `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` and `TELEGRAM_SESSION_STRING` (or `TELEGRAM_SESSION_NAME` for file-based sessions). Writes are marked approval-required.

## Telegram modify mode

`TELEGRAM_EXPOSED_TOOLS=all` exposes read and modifying Telegram tools for the original `telegram` MCP. T1 marks Telegram writes as approval-required. The AI must show the intended recipients, action and payload before a modifying call is authorized.

## External MCP services

- GitHub MCP uses GitHub's remote MCP endpoint.
- Hugging Face Hub MCP uses the Hub MCP endpoint.
- Google Maps uses a server-side adapter and `GOOGLE_MAPS_API_KEY`.
- Playwright MCP runs through `npx @playwright/mcp@latest` in an approved development runtime. Enabled by default for longevity scraping of sources that block plain HTTP clients.
- RSSHub is accessed through `RSSHUB_BASE_URL`. Enabled by default as the feed source for longevity research.
- The Discord research bridge runs locally through `integrations/discord/discord_bridge.py` and needs `DISCORD_BOT_TOKEN` or `DISCORD_WEBHOOK_URL`.
- 5sim / SMS provider MCP runs locally through `integrations/vendor/agents-sms`.
- Signal CLI MCP runs locally through `integrations/vendor/signal-cli-mcp` and depends on `signal-cli-rest-api`.
- Telegram MCP v2 runs locally through `integrations/vendor/telegram-mcp-1`.

Browser code never receives provider tokens and cannot directly spawn arbitrary stdio processes.
