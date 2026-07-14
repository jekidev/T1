#!/usr/bin/env python3
"""Run one controlled OpenHands SDK conversation inside an existing worktree."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
from pathlib import Path

from openhands.sdk import Agent, Conversation, LLM, Tool
from openhands.tools.file_editor import FileEditorTool
from openhands.tools.task_tracker import TaskTrackerTool
from openhands.tools.terminal import TerminalTool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--prompt-file", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    workspace = Path(args.workspace).resolve()
    prompt_file = Path(args.prompt_file).resolve()
    if not workspace.is_dir():
        raise SystemExit("Workspace does not exist.")
    if workspace not in prompt_file.parents:
        raise SystemExit("Prompt file must be inside the worktree.")

    model = os.getenv("CODING_AGENT_OPENHANDS_MODEL", "").strip()
    api_key = (
        os.getenv("CODING_AGENT_OPENHANDS_API_KEY", "").strip()
        or os.getenv("OPENROUTER_API_KEY", "").strip()
        or os.getenv("OPENAI_API_KEY", "").strip()
        or os.getenv("ANTHROPIC_API_KEY", "").strip()
        or os.getenv("DEEPSEEK_API_KEY", "").strip()
    )
    if not model:
        raise SystemExit("CODING_AGENT_OPENHANDS_MODEL is required.")
    enforce_model_network_mode(model)
    if not api_key:
        raise SystemExit("A model API key is required for OpenHands.")

    llm_options: dict[str, object] = {"model": model, "api_key": api_key}
    base_url = os.getenv("CODING_AGENT_OPENHANDS_BASE_URL", "").strip()
    if base_url:
        llm_options["base_url"] = base_url

    llm = LLM(**llm_options)
    agent = Agent(
        llm=llm,
        tools=[
            Tool(name=TerminalTool.name),
            Tool(name=FileEditorTool.name),
            Tool(name=TaskTrackerTool.name),
        ],
    )
    conversation = Conversation(agent=agent, workspace=str(workspace))
    conversation.send_message(prompt_file.read_text(encoding="utf-8"))
    conversation.run()

    intent = subprocess.run(
        ["git", "add", "--intent-to-add", "--all"],
        cwd=workspace,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    if intent.returncode != 0:
        raise SystemExit(f"Could not register new files for diff collection: {intent.stderr}")


def enforce_model_network_mode(model: str) -> None:
    normalized = model.lower()
    browsing_model = (
        normalized.endswith(":online")
        or "/online" in normalized
        or normalized.startswith("perplexity/")
        or re.search(r"(?:^|/)sonar(?:-|$)", normalized) is not None
        or re.search(r"search[-_ ]preview|web[-_ ]search|internet[-_ ]search|grounded[-_ ]search", normalized) is not None
    )
    if browsing_model and os.getenv("CODING_AGENT_NETWORK_MODE", "deny") != "ultra":
        raise SystemExit(
            "The selected OpenHands model has integrated web access. "
            "It is forbidden in Ask First/deny mode; explicitly create an Ultra run or use a non-browsing model."
        )


if __name__ == "__main__":
    main()
