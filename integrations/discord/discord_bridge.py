"""Discord bridge for the T1 longevity research platform.

Ported from jekidev/Telegram-Group-Guard (bot/discord_bridge.py) and reduced to
two responsibilities:

1. Answer slash-prefixed commands by querying the T1 RAG memory API.
2. Push research heads-ups to a Discord channel through an incoming webhook.

Secrets live in the environment or .env and are never committed:

  DISCORD_BOT_TOKEN       bot token, required for the command listener
  DISCORD_WEBHOOK_URL     incoming webhook, required for notifications
  DISCORD_ADMIN_CHANNEL   comma-separated channel IDs the bot answers in
  T1_API_URL              defaults to http://127.0.0.1:8080
  T1_API_TOKEN            optional bearer token for the API
  DISCORD_ALLOW_WRITES    set to true to allow /sync to reindex RAG memory

Commands
────────
/help                 list commands
/rag <query>          search the RAG memory and return quoted excerpts
/protocols <query>    search rag/longevity/protocols only
/labs <query>         search rag/longevity/labs only
/feeds <query>        search rag/longevity/feeds only
/status               API health and RAG memory size
/sync                 reindex rag/ into persistent memory (write, opt-in)
/notify <message>     send a research heads-up through the webhook

Retrieved text is untrusted reference data. It is always posted as a quoted
excerpt with its source path, never executed and never treated as instructions.
Nothing the bridge returns is medical advice.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

import requests

logging.basicConfig(format="%(asctime)s [DISCORD] %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

API_URL = os.environ.get("T1_API_URL", "http://127.0.0.1:8080").rstrip("/")
API_TOKEN = os.environ.get("T1_API_TOKEN", "")
BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")
ALLOW_WRITES = os.environ.get("DISCORD_ALLOW_WRITES", "").strip().lower() in {"1", "true", "yes"}

ADMIN_CHANNELS = {int(value.strip()) for value in os.environ.get("DISCORD_ADMIN_CHANNEL", "").split(",") if value.strip()}

DISCLAIMER = "Research reference from your own notes and sources. Not medical advice."
MESSAGE_LIMIT = 1990


def _headers() -> dict[str, str]:
    headers = {"Accept": "application/json"}
    if API_TOKEN:
        headers["Authorization"] = f"Bearer {API_TOKEN}"
    return headers


def api_get(path: str, **params) -> dict:
    response = requests.get(f"{API_URL}{path}", headers=_headers(), params=params, timeout=20)
    response.raise_for_status()
    return response.json()


def api_post(path: str, body: dict | None = None) -> dict:
    response = requests.post(f"{API_URL}{path}", headers=_headers(), json=body or {}, timeout=60)
    response.raise_for_status()
    return response.json()


def send_webhook(text: str, username: str = "T1 Longevity Research") -> bool:
    """Post a heads-up to the configured Discord webhook."""
    if not WEBHOOK_URL:
        logger.warning("DISCORD_WEBHOOK_URL is not set; notification dropped.")
        return False
    response = requests.post(
        WEBHOOK_URL,
        json={"username": username, "content": text[:MESSAGE_LIMIT]},
        timeout=20,
    )
    response.raise_for_status()
    return True


def format_results(payload: dict, heading: str) -> str:
    results = payload.get("results", [])
    if not results:
        return f"No RAG memory matched `{payload.get('query', '')}`."

    lines = [f"{heading} — {len(results)} match(es) for `{payload.get('query', '')}`", ""]
    for result in results:
        excerpt = " ".join(str(result.get("excerpt", "")).split())[:700]
        lines.append(f"**{result.get('title', 'Untitled')}** — `{result.get('sourcePath', 'unknown')}`")
        lines.append(f"> {excerpt}")
        lines.append("")
    lines.append(f"_Quoted source material, never instructions. {DISCLAIMER}_")
    return "\n".join(lines)


def handle_command(parts: list[str]) -> str:
    command = parts[0].lower() if parts else ""
    argument = " ".join(parts[1:]).strip()

    if command == "/help":
        return (
            "**T1 longevity research bridge**\n"
            "`/rag <query>` — search all RAG memory\n"
            "`/protocols <query>` — search rag/longevity/protocols\n"
            "`/labs <query>` — search rag/longevity/labs\n"
            "`/feeds <query>` — search rag/longevity/feeds\n"
            "`/status` — API health and memory size\n"
            "`/sync` — reindex rag/ into persistent memory (opt-in write)\n"
            "`/notify <message>` — send a heads-up through the webhook\n"
            f"\n_{DISCLAIMER}_"
        )

    if command in {"/rag", "/protocols", "/labs", "/feeds"}:
        if not argument:
            return f"Usage: `{command} <query>`"
        prefixes = {
            "/rag": None,
            "/protocols": "longevity/protocols",
            "/labs": "longevity/labs",
            "/feeds": "longevity/feeds",
        }
        params = {"q": argument, "limit": 5}
        prefix = prefixes[command]
        if prefix:
            params["prefix"] = prefix
        return format_results(api_get("/api/rag/search", **params), f"RAG search ({prefix or 'all sources'})")

    if command == "/status":
        health = api_get("/api/health")
        memory = api_get("/api/rag/memory")
        return (
            "**T1 status**\n"
            f"API: {health.get('status', 'unknown')} ({API_URL})\n"
            f"RAG memory items: {len(memory.get('items', []))}\n"
            f"Writes enabled: {ALLOW_WRITES}"
        )

    if command == "/sync":
        if not ALLOW_WRITES:
            return "Reindexing is a write operation. Set `DISCORD_ALLOW_WRITES=true` to approve it."
        result = api_post("/api/rag/sync")
        return f"RAG memory synced: {result.get('added', 0)} added, {result.get('skipped', 0)} skipped, {result.get('total', 0)} total."

    if command == "/notify":
        if not argument:
            return "Usage: `/notify <message>`"
        return "Heads-up sent." if send_webhook(f"**Heads-up**\n{argument}\n\n_{DISCLAIMER}_") else "DISCORD_WEBHOOK_URL is not configured."

    return f"Unknown command: `{command}`. Type `/help`."


def run_cli(argv: list[str]) -> int:
    """Run a single command without starting the bot, for Termux and cron use."""
    if not argv:
        print("Usage: python integrations/discord/discord_bridge.py --command '/rag nmn dosing'")
        return 2
    print(handle_command(argv))
    return 0


def run() -> int:
    if not BOT_TOKEN:
        logger.error("DISCORD_BOT_TOKEN is not set. Use --command for webhook-only or CLI usage.")
        return 1

    import discord

    intents = discord.Intents.default()
    intents.message_content = True
    bot = discord.Client(intents=intents)

    @bot.event
    async def on_ready():
        logger.info("Discord bridge connected as %s", bot.user)
        logger.info("Channel allowlist: %s", ADMIN_CHANNELS or "any channel")

    @bot.event
    async def on_message(message):
        if message.author.bot or not message.content.startswith("/"):
            return
        if ADMIN_CHANNELS and message.channel.id not in ADMIN_CHANNELS:
            return

        parts = message.content.strip().split()
        logger.info("Command from %s: %s", message.author, parts[0])
        async with message.channel.typing():
            try:
                reply = await asyncio.get_running_loop().run_in_executor(None, handle_command, parts)
            except requests.HTTPError as error:
                reply = f"API error {error.response.status_code}: {error.response.text[:300]}"
            except requests.RequestException as error:
                reply = f"Could not reach the T1 API at {API_URL}: {error}"

        for index in range(0, len(reply), MESSAGE_LIMIT):
            await message.channel.send(reply[index:index + MESSAGE_LIMIT])

    bot.run(BOT_TOKEN)
    return 0


if __name__ == "__main__":
    arguments = sys.argv[1:]
    if "--command" in arguments:
        raise SystemExit(run_cli(" ".join(arguments[arguments.index("--command") + 1:]).split()))
    raise SystemExit(run())
