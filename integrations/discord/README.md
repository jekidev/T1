# Discord integration

Ported from `jekidev/Telegram-Group-Guard` (`bot/discord_bridge.py`) and reduced to the two capabilities the longevity platform needs:

- **Query RAG memory from Discord** — `/rag`, `/protocols`, `/labs`, `/feeds`, `/status`, `/sync` call the T1 Express API.
- **Push research heads-ups** — `/notify` and `integrations/discord/notify.mjs` post to an incoming webhook, so scrapers and cron jobs can announce new findings.

## Configuration

Keep every value in platform secrets or `.env`, never in git.

```text
DISCORD_BOT_TOKEN=        # command listener; leave empty for webhook-only mode
DISCORD_WEBHOOK_URL=      # incoming webhook for notifications
DISCORD_ADMIN_CHANNEL=    # comma-separated channel IDs; empty means any channel
DISCORD_ALLOW_WRITES=false
T1_API_URL=http://127.0.0.1:8080
T1_API_TOKEN=
```

Bot setup: create an application at <https://discord.com/developers/applications>, add a bot, enable the **Message Content** intent, and invite it with Send Messages, Embed Links and Read Message History.

## Running

```bash
pip install -r integrations/discord/requirements.txt
pnpm discord:bridge                                   # long-running listener
python integrations/discord/discord_bridge.py --command "/rag nmn dosing"   # one-shot
node integrations/discord/notify.mjs "New senolytics preprint indexed"      # webhook only
pnpm rag:scrape-longevity --notify                    # scrape and announce the result
```

Webhook-only mode needs no bot token and works well in Termux, where a persistent gateway connection is unreliable.

## Safety model

- Retrieved RAG text is untrusted reference data: it is quoted with its source path and never treated as an instruction.
- `/sync` is the only write and stays disabled until `DISCORD_ALLOW_WRITES=true`.
- Every research answer carries the "not medical advice" disclaimer.
- The bridge never returns credentials, and channel access is restricted through `DISCORD_ADMIN_CHANNEL`.
