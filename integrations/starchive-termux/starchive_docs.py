#!/usr/bin/env python3
"""Export GitHub starred repositories to CSV through the GitHub MCP server.

The default remote endpoint is GitHub's current hosted MCP server. Credentials
are read safely from GITHUB_TOKEN, GH_TOKEN, or an existing `gh auth login`;
no token is embedded in this file.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlparse

import requests

MCP_URL = "https://api.githubcopilot.com/mcp/"
MCP_PROTOCOL_VERSION = "2025-06-18"
GITHUB_API_URL = "https://api.github.com"
USER_AGENT = "STARCHIVE-Termux/2.0"
CSV_FIELDS = [
    "repo_full_name",
    "repo_url",
    "description",
    "language",
    "stars",
    "updated_at",
    "starred_at",
]


def token_from_environment_or_gh() -> str | None:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return token.strip()
    if shutil.which("gh"):
        try:
            result = subprocess.run(
                ["gh", "auth", "token"],
                check=True,
                capture_output=True,
                text=True,
                timeout=15,
            )
            return result.stdout.strip() or None
        except (subprocess.SubprocessError, OSError):
            return None
    return None


def session_for(token: str | None) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
            "User-Agent": USER_AGENT,
        }
    )
    if token:
        session.headers["Authorization"] = f"Bearer {token}"
    return session


def api_session_for(token: str | None) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "Accept": "application/vnd.github+json",
            "Accept": "application/vnd.github.star+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": USER_AGENT,
        }
    )
    if token:
        session.headers["Authorization"] = f"Bearer {token}"
    return session


def response_payload(response: requests.Response) -> dict[str, Any]:
    response.raise_for_status()
    if "text/event-stream" not in response.headers.get("content-type", ""):
        return cast(dict[str, Any], response.json())
    for line in reversed(response.text.splitlines()):
        if line.startswith("data:"):
            return cast(dict[str, Any], json.loads(line[5:].strip()))
    raise RuntimeError("GitHub MCP returned an empty event stream")


def mcp_request(
    session: requests.Session,
    method: str,
    params: dict[str, Any],
    request_id: int,
    session_id: str | None = None,
) -> tuple[dict[str, Any], str | None]:
    headers = {}
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    response = session.post(
        os.environ.get("GITHUB_MCP_URL", MCP_URL),
        headers=headers,
        json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": params},
        timeout=60,
    )
    return response_payload(response), response.headers.get("Mcp-Session-Id") or session_id


def mcp_initialize(session: requests.Session) -> str | None:
    payload, session_id = mcp_request(
        session,
        "initialize",
        {
            "protocolVersion": MCP_PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": {"name": "starchive-termux", "version": "2.0.0"},
        },
        1,
    )
    if "error" in payload:
        raise RuntimeError(payload["error"].get("message", "MCP initialization failed"))
    session.post(
        os.environ.get("GITHUB_MCP_URL", MCP_URL),
        headers={"Mcp-Session-Id": session_id} if session_id else {},
        json={"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
        timeout=60,
    )
    return session_id


def mcp_tools(session: requests.Session, session_id: str | None) -> list[str]:
    payload, _ = mcp_request(session, "tools/list", {}, 2, session_id)
    if "error" in payload:
        raise RuntimeError(payload["error"].get("message", "MCP tool discovery failed"))
    return [
        tool["name"]
        for tool in payload.get("result", {}).get("tools", [])
        if isinstance(tool, dict) and isinstance(tool.get("name"), str)
    ]


def fetch_all_starred(
    session: requests.Session, username: str | None
) -> list[dict[str, Any]]:
    session_id = mcp_initialize(session)
    if "list_starred_repositories" not in mcp_tools(session, session_id):
        raise LookupError(
            "The configured GitHub MCP server does not expose "
            "list_starred_repositories"
        )
    repositories: list[dict[str, Any]] = []
    page = 1
    while True:
        arguments: dict[str, Any] = {"page": page, "perPage": 100, "sort": "created", "direction": "desc"}
        if username:
            arguments["username"] = username
        payload, session_id = mcp_request(
            session,
            "tools/call",
            {"name": "list_starred_repositories", "arguments": arguments},
            page + 2,
            session_id,
        )
        if "error" in payload:
            raise RuntimeError(payload["error"].get("message", "GitHub MCP request failed"))
        result = payload.get("result", {})
        structured = result.get("structuredContent")
        if isinstance(structured, dict):
            page_repositories = structured.get("repositories", structured.get("items", []))
        else:
            content = result.get("content", [])
            text = next(
                (item.get("text", "") for item in content if item.get("type") == "text"),
                "",
            )
            try:
                decoded = json.loads(text)
            except json.JSONDecodeError:
                decoded = []
            page_repositories = decoded.get("repositories", decoded.get("items", [])) if isinstance(decoded, dict) else decoded
        if not isinstance(page_repositories, list) or not page_repositories:
            break
        repositories.extend(item for item in page_repositories if isinstance(item, dict))
        if len(page_repositories) < 100:
            break
        page += 1
    return repositories


def fetch_all_starred_via_api(
    session: requests.Session, username: str | None
) -> list[dict[str, Any]]:
    path = f"/users/{username}/starred" if username else "/user/starred"
    url: str | None = f"{GITHUB_API_URL}{path}?per_page=100"
    repositories: list[dict[str, Any]] = []
    while url:
        response = session.get(url, timeout=60)
        response.raise_for_status()
        page = response.json()
        if not isinstance(page, list):
            raise ValueError("GitHub returned an unexpected starred repository response")
        repositories.extend(page)
        url = response.links.get("next", {}).get("url")
    return repositories


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def repository_starred_at(repository: dict[str, Any]) -> str:
    return str(repository.get("starredAt") or repository.get("starred_at") or "")


def filter_repositories(
    repositories: list[dict[str, Any]],
    since: str | None,
    language: str | None,
    topic: str | None,
    minimum_stars: int | None,
) -> list[dict[str, Any]]:
    since_timestamp = parse_timestamp(since)
    normalized_language = language.casefold() if language else None
    normalized_topic = topic.casefold() if topic else None
    filtered = []
    for repository in repositories:
        starred_at = repository_starred_at(repository)
        if since_timestamp and (
            not starred_at or parse_timestamp(starred_at) <= since_timestamp
        ):
            continue
        if normalized_language and str(repository.get("language") or "").casefold() != normalized_language:
            continue
        topics = repository.get("topics") or repository.get("topicNames") or []
        if normalized_topic and normalized_topic not in {
            str(item).casefold() for item in topics
        }:
            continue
        stars = repository.get("stargazerCount", repository.get("stargazers_count", 0))
        if minimum_stars is not None and int(stars or 0) < minimum_stars:
            continue
        filtered.append(repository)
    return filtered


def rows_for_repositories(repositories: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [
        {
            "repo_full_name": repo.get("fullName") or repo.get("full_name", ""),
            "repo_url": repo.get("html_url") or repo.get("url", ""),
            "description": repo.get("description") or "",
            "language": repo.get("language") or "",
            "stars": repo.get("stargazerCount", repo.get("stargazers_count", "")),
            "updated_at": repo.get("updatedAt", repo.get("updated_at", "")) or "",
            "starred_at": repo.get("starredAt", repo.get("starred_at", "")) or "",
        }
        for repo in repositories
    ]
    for row in rows:
        if not row["repo_full_name"]:
            raise ValueError("CSV validation failed: repo_full_name is required")
        parsed_url = urlparse(str(row["repo_url"]))
        if parsed_url.scheme != "https" or not parsed_url.netloc:
            raise ValueError(
                f"CSV validation failed: invalid repo_url for {row['repo_full_name']}"
            )
        try:
            stars = int(row["stars"] or 0)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"CSV validation failed: stars is not an integer for {row['repo_full_name']}"
            ) from exc
        if stars < 0:
            raise ValueError(
                f"CSV validation failed: stars is negative for {row['repo_full_name']}"
            )
        row["stars"] = stars
    return rows


def load_last_export(state_file: Path) -> str | None:
    if not state_file.exists():
        return None
    with state_file.open(encoding="utf-8") as handle:
        state = json.load(handle)
    return state.get("last_export_at")


def save_last_export(state_file: Path, repositories: list[dict[str, Any]]) -> None:
    timestamps = [
        parse_timestamp(repository_starred_at(repository))
        for repository in repositories
        if repository_starred_at(repository)
    ]
    latest = max((timestamp for timestamp in timestamps if timestamp), default=None)
    if latest is None:
        return
    state_file.parent.mkdir(parents=True, exist_ok=True)
    with state_file.open("w", encoding="utf-8") as handle:
        json.dump({"last_export_at": latest.isoformat()}, handle)


def export_csv(
    destination: Path,
    repositories: list[dict[str, Any]],
) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    rows = rows_for_repositories(repositories)
    with destination.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=CSV_FIELDS,
        )
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--username",
        default=os.environ.get("GITHUB_USERNAME"),
        help="GitHub username; omit to use the authenticated account",
    )
    parser.add_argument(
        "--output", default="output/starred_repos.csv", help="CSV output path"
    )
    parser.add_argument("--since", help="Only include repositories starred after this ISO timestamp")
    parser.add_argument(
        "--incremental",
        action="store_true",
        help="Use and update the last-export timestamp state file",
    )
    parser.add_argument(
        "--state-file",
        default=".starchive/last-export.json",
        help="Incremental export state path",
    )
    parser.add_argument("--language", help="Filter by exact programming language")
    parser.add_argument("--topic", help="Filter by an exact repository topic")
    parser.add_argument("--min-stars", type=int, help="Filter by minimum star count")
    parser.add_argument(
        "--allow-custom-mcp",
        action="store_true",
        help="Approve use of a non-default GITHUB_MCP_URL",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = token_from_environment_or_gh()
    mcp_url = os.environ.get("GITHUB_MCP_URL", MCP_URL)
    if mcp_url != MCP_URL and not args.allow_custom_mcp:
        print(
            "Custom GitHub MCP endpoint requires explicit approval. "
            "Re-run with --allow-custom-mcp.",
            file=sys.stderr,
        )
        return 7
    session = session_for(token)
    try:
        since = args.since
        state_file = Path(args.state_file)
        if args.incremental and not since:
            since = load_last_export(state_file)
        try:
            starred = fetch_all_starred(session, args.username)
        except LookupError as exc:
            print(f"Notice: {exc}; using GitHub REST fallback.", file=sys.stderr)
            starred = fetch_all_starred_via_api(api_session_for(token), args.username)
        selected = filter_repositories(
            starred, since, args.language, args.topic, args.min_stars
        )
        count = export_csv(Path(args.output), selected)
        if args.incremental:
            save_last_export(state_file, starred)
        print(f"Exported {count} starred repositories to {args.output}")
        return 0
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        print(f"GitHub request failed (HTTP {status}): {exc}", file=sys.stderr)
        return 4
    except requests.RequestException as exc:
        print(f"Network request failed: {exc}", file=sys.stderr)
        return 5
    except (RuntimeError, ValueError) as exc:
        print(f"GitHub MCP request failed: {exc}", file=sys.stderr)
        return 6


if __name__ == "__main__":
    raise SystemExit(main())
