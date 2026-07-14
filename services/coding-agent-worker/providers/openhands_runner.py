#!/usr/bin/env python3
"""Run one controlled OpenHands SDK conversation inside an existing worktree."""

from __future__ import annotations

import argparse
import os
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


if __name__ == "__main__":
    main()
