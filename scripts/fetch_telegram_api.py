#!/usr/bin/env python3
"""
Fetch Telegram API id and hash from my.telegram.org.

This is a non-interactive, environment-driven reimplementation of the flow in
Anon4You/Telegram-Api (MIT). It is intended as a one-time setup helper for the
Telegram MCP server.

Environment variables:
  TELEGRAM_FETCH_PHONE    Phone number with country code, e.g. +4512345678
  TELEGRAM_FETCH_CODE     One-time login code sent to the Telegram account
  TELEGRAM_FETCH_UPDATE_DOTENV  Set to 1 to write TELEGRAM_API_ID and
                          TELEGRAM_API_HASH back into .env

The script only reads the values it needs and never writes the phone number or
login code anywhere. If TELEGRAM_FETCH_UPDATE_DOTENV is not set, the API
id/hash are printed to stdout in KEY=value form.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

MY_TELEGRAM_AUTH_SEND = "https://my.telegram.org/auth/send_password"
MY_TELEGRAM_AUTH_LOGIN = "https://my.telegram.org/auth/login"
MY_TELEGRAM_APPS = "https://my.telegram.org/apps"


def fail(message: str, code: int = 1) -> None:
    print(message, file=sys.stderr)
    sys.exit(code)


def update_dotenv(api_id: str, api_hash: str) -> None:
    env_path = Path(".env")
    if not env_path.exists():
        fail("Cannot update .env: file not found. Create it from .env.example first.")

    text = env_path.read_text(encoding="utf-8")

    def upsert(key: str, value: str) -> None:
        nonlocal text
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        line = f"{key}={value}"
        if pattern.search(text):
            text = pattern.sub(line, text)
        else:
            text += f"\n{line}\n"

    upsert("TELEGRAM_API_ID", api_id)
    upsert("TELEGRAM_API_HASH", api_hash)
    env_path.write_text(text, encoding="utf-8")
    print("Updated .env with TELEGRAM_API_ID and TELEGRAM_API_HASH.")


def extract_value(soup: BeautifulSoup, label: str) -> str | None:
    label_tag = soup.find("label", string=label)
    if not label_tag:
        return None
    value_div = label_tag.find_next_sibling("div")
    if not value_div:
        return None
    value_span = value_div.find("span")
    if not value_span:
        return None
    return value_span.get_text(strip=True)


def main() -> None:
    phone = os.environ.get("TELEGRAM_FETCH_PHONE", "").strip()
    code = os.environ.get("TELEGRAM_FETCH_CODE", "").strip()

    if not phone:
        fail(
            "Set TELEGRAM_FETCH_PHONE to your phone number with country code, "
            "e.g. +4512345678"
        )
    if not code:
        fail("Set TELEGRAM_FETCH_CODE to the one-time code sent by Telegram")
    if not phone.startswith("+"):
        fail("TELEGRAM_FETCH_PHONE must include the country code and start with '+'")

    session = requests.Session()
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://my.telegram.org/",
    }

    send_resp = session.post(
        MY_TELEGRAM_AUTH_SEND,
        data={"phone": phone},
        headers=headers,
        timeout=60,
    )
    if "Sorry, too many tries" in send_resp.text:
        fail("Telegram rate-limited this phone number. Try again later.")

    try:
        send_data = send_resp.json()
    except Exception as exc:
        fail(f"Could not parse my.telegram.org response: {exc}")

    random_hash = send_data.get("random_hash")
    if not random_hash:
        fail(f"No random_hash in response: {send_resp.text[:200]}")

    session.post(
        MY_TELEGRAM_AUTH_LOGIN,
        data={"phone": phone, "random_hash": random_hash, "password": code},
        headers=headers,
        timeout=60,
    )

    apps_resp = session.get(MY_TELEGRAM_APPS, headers=headers, timeout=60)
    soup = BeautifulSoup(apps_resp.text, "html.parser")

    api_id = extract_value(soup, "App api_id:")
    api_hash = extract_value(soup, "App api_hash:")

    if not api_id or not api_hash:
        fail(
            "Could not extract API id/hash from my.telegram.org. "
            "Check the code and try again after 24h."
        )

    print(f"TELEGRAM_API_ID={api_id}")
    print(f"TELEGRAM_API_HASH={api_hash}")

    update_env_flag = os.environ.get("TELEGRAM_FETCH_UPDATE_DOTENV", "").lower()
    if update_env_flag in ("1", "true", "yes"):
        update_dotenv(api_id, api_hash)


if __name__ == "__main__":
    main()
