#!/usr/bin/env python3
"""Run one non-interactive Aider task without committing or publishing."""

from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path


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

    model = os.getenv("CODING_AGENT_AIDER_MODEL", "").strip()
    if not model:
        raise SystemExit("CODING_AGENT_AIDER_MODEL is required.")

    command = [
        "aider",
        "--yes",
        "--no-auto-commits",
        "--no-dirty-commits",
        "--no-stream",
        "--model",
        model,
        "--message-file",
        str(prompt_file),
    ]
    result = subprocess.run(command, cwd=workspace, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)

    # Intent-to-add makes new text files visible in `git diff <base>` without
    # staging their contents or creating a commit. The worker remains the only
    # component allowed to commit and publish after validation.
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


if __name__ == "__main__":
    main()
