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

Run:

```bash
pnpm setup:mcp
```

This clones and builds:

- `chigwell/telegram-mcp` into `integrations/vendor/telegram-mcp`
- `megahomyak/tg_auth_api` into `integrations/vendor/tg_auth_api`
- `gonchasobaka/agents-sms` into `integrations/vendor/agents-sms` (5sim / SMS-Activate / OnlineSim)
- `jiridudekusy/signal-cli-mcp` into `integrations/vendor/signal-cli-mcp`

The auth repository is treated as an external service behind `TELEGRAM_AUTH_API_URL`. Its exact startup command and endpoint names may differ by revision; configure or adapt the proxy before production use. Secrets and Telegram session strings must remain in the hosting platform secret store.

## 5sim / SMS provider MCP

`agents-sms` is a local stdio MCP for buying virtual phone numbers and receiving SMS codes. Set at least one provider key (`FIVESIM_API_KEY`, `SMSACTIVATE_API_KEY`, or `ONLINESIM_API_KEY`) before enabling the server. Purchasing numbers is treated as an approval-required write.

## Signal CLI MCP

`signal-cli-mcp` proposes sending Signal messages and creating groups, but nothing is sent without explicit human approval through a local web GUI. It requires a running `signal-cli-rest-api` instance; start it with the `docker-compose.yml` in `integrations/vendor/signal-cli-mcp` and link the device via the QR code endpoint. Set `SIGNAL_ACCOUNT` to the registered E.164 number.

## Telegram modify mode

`TELEGRAM_EXPOSED_TOOLS=all` exposes read and modifying Telegram tools. T1 marks Telegram writes as approval-required. The AI must show the intended recipients, action and payload before a modifying call is authorized.

## External MCP services

- GitHub MCP uses GitHub's remote MCP endpoint.
- Hugging Face Hub MCP uses the Hub MCP endpoint.
- Google Maps uses a server-side adapter and `GOOGLE_MAPS_API_KEY`.
- Playwright MCP runs through `npx @playwright/mcp@latest` in an approved development runtime.
- RSSHub is accessed through `RSSHUB_BASE_URL`.
- 5sim / SMS provider MCP runs locally through `integrations/vendor/agents-sms`.
- Signal CLI MCP runs locally through `integrations/vendor/signal-cli-mcp` and depends on `signal-cli-rest-api`.

Browser code never receives provider tokens and cannot directly spawn arbitrary stdio processes.
