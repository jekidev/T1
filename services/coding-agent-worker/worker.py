#!/usr/bin/env python3
"""Authenticated external coding-agent worker.

The API server owns policy. This process owns the isolated Git worktree and provider
process. It never merges pull requests and refuses to publish until the supplied run
contains an accepted policy decision and the current diff matches the validated patch.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

HOST = os.getenv("CODING_AGENT_WORKER_HOST", "0.0.0.0")
PORT = int(os.getenv("CODING_AGENT_WORKER_PORT", "8787"))
ROOT = Path(os.getenv("CODING_AGENT_WORKER_ROOT", "/work")).resolve()
MIRROR = ROOT / "repository.git"
RUNS_ROOT = ROOT / "runs"
STATE_ROOT = ROOT / "state"
MAX_BODY_BYTES = int(os.getenv("CODING_AGENT_WORKER_MAX_BODY_BYTES", str(25 * 1024 * 1024)))
MAX_DIFF_BYTES = int(os.getenv("CODING_AGENT_WORKER_MAX_DIFF_BYTES", str(10 * 1024 * 1024)))
MAX_OUTPUT_BYTES = int(os.getenv("CODING_AGENT_WORKER_MAX_OUTPUT_BYTES", str(1 * 1024 * 1024)))
MAX_RUNTIME_SECONDS = int(os.getenv("CODING_AGENT_WORKER_MAX_RUNTIME_SECONDS", str(60 * 60)))
MAX_COMMAND_SECONDS = int(os.getenv("CODING_AGENT_WORKER_MAX_COMMAND_SECONDS", str(30 * 60)))
TOKEN = os.getenv("CODING_AGENT_WORKER_TOKEN", "")
REPOSITORY_URL = os.getenv("CODING_AGENT_REPOSITORY_URL", "").strip()
LOCAL_REPOSITORY = os.getenv("CODING_AGENT_LOCAL_REPOSITORY", "").strip()
GITHUB_REPOSITORY = os.getenv("CODING_AGENT_GITHUB_REPOSITORY", "").strip()

ACTIVE_PROCESSES: dict[str, subprocess.Popen[str]] = {}
ACTIVE_LOCK = threading.RLock()
MIRROR_LOCK = threading.RLock()
RUN_LOCKS: dict[str, threading.RLock] = {}


class WorkerError(RuntimeError):
    def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class RunContext:
    run_id: str
    provider: str
    branch: str
    base_commit: str
    workspace: Path
    task: dict[str, Any]
    repository_map: dict[str, Any]
    plan: dict[str, Any]


class CodingAgentHandler(BaseHTTPRequestHandler):
    server_version = "T1CodingAgentWorker/1.0"

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(
                HTTPStatus.OK,
                {
                    "status": "ok",
                    "providers": {
                        "openhands": provider_available("openhands"),
                        "aider": provider_available("aider"),
                    },
                    "activeRuns": active_run_ids(),
                },
            )
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "Not found."})

    def do_POST(self) -> None:  # noqa: N802
        try:
            require_auth(self.headers.get("Authorization", ""))
            payload = self._read_json()
            match = re.fullmatch(
                r"/v1/adapters/(openhands|aider)/(analyze|plan|execute|review|publish|stop)",
                urllib.parse.urlsplit(self.path).path,
            )
            if not match:
                raise WorkerError("Unknown coding-agent endpoint.", HTTPStatus.NOT_FOUND)
            provider, action = match.groups()
            result = dispatch(provider, action, payload)
            self._json(HTTPStatus.OK, result)
        except WorkerError as error:
            self._json(error.status, {"error": str(error)})
        except Exception as error:  # pragma: no cover - final containment boundary
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Worker failure: {error}"})

    def log_message(self, fmt: str, *args: object) -> None:
        message = fmt % args
        print(json.dumps({"time": now_iso(), "http": message}), flush=True)

    def _read_json(self) -> dict[str, Any]:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as error:
            raise WorkerError("Invalid Content-Length.") from error
        if length < 1 or length > MAX_BODY_BYTES:
            raise WorkerError("Request body is missing or exceeds the configured limit.", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw)
        except json.JSONDecodeError as error:
            raise WorkerError("Request body must be valid JSON.") from error
        if not isinstance(value, dict):
            raise WorkerError("Request body must be a JSON object.")
        return value

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def dispatch(provider: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
    if action == "analyze":
        repository_map = require_dict(payload, "repositoryMap", fallback=payload)
        return {"repositoryMap": repository_map}
    if action == "plan":
        return {"plan": build_plan(payload)}
    if action == "execute":
        return execute(provider, payload)
    if action == "review":
        return review_patch(payload)
    if action == "publish":
        return publish(provider, payload)
    if action == "stop":
        run_id = safe_id(require_string(payload, "runId"))
        stopped = stop_run(run_id)
        return {"runId": run_id, "stopped": stopped}
    raise WorkerError("Unsupported action.", HTTPStatus.NOT_FOUND)


def build_plan(payload: dict[str, Any]) -> dict[str, Any]:
    task = require_dict(payload, "task")
    repository_map = require_dict(payload, "repositoryMap")
    objective = require_string(task, "objective")[:4000]
    signal = str(task.get("signal", "explicit_user_request"))
    allowed_paths = require_string_list(task, "allowedPaths", minimum=1)
    modules = repository_map.get("modules", [])
    affected_modules: list[str] = []
    if isinstance(modules, list):
        for module in modules:
            if not isinstance(module, dict):
                continue
            root = module.get("root")
            module_id = module.get("id")
            if isinstance(root, str) and any(paths_overlap(root, path) for path in allowed_paths):
                affected_modules.append(str(module_id or root))

    expected_files: list[str] = []
    files = repository_map.get("files", [])
    if isinstance(files, list):
        for file in files:
            path = file.get("path") if isinstance(file, dict) else None
            if isinstance(path, str) and any(path_is_allowed(path, allowed) for allowed in allowed_paths):
                expected_files.append(path)
                if len(expected_files) >= 200:
                    break
    if not expected_files:
        expected_files = [normalize_repo_path(path).rstrip("/**/") for path in allowed_paths]

    validation_steps = select_validation_commands(repository_map, allowed_paths)
    if not validation_steps:
        raise WorkerError("Repository map contains no approved test or build command for this task.")

    risks = [
        "The provider may modify only task.allowedPaths.",
        "Every command runs in a disposable worktree with a hard timeout.",
        "Publication remains a separate step after deterministic validation.",
    ]
    if any(path.startswith(("lib/coding-agent/", "services/coding-agent-worker/")) for path in allowed_paths):
        risks.append("Self-modification requires an external reviewer and cannot be auto-merged.")

    return {
        "objective": objective,
        "reason": f"Concrete signal: {signal}.",
        "affectedModules": sorted(set(affected_modules))[:200],
        "expectedFiles": expected_files[:500],
        "risks": risks,
        "validationSteps": validation_steps,
        "rollbackPlan": "Close the pull request, delete the agent branch, and remove the disposable worktree. The protected base branch is never written directly.",
    }


def execute(provider: str, payload: dict[str, Any]) -> dict[str, Any]:
    context = parse_run_context(provider, payload)
    lock = run_lock(context.run_id)
    with lock:
        if not provider_available(provider):
            raise WorkerError(f"Provider {provider} is not installed or configured.", HTTPStatus.SERVICE_UNAVAILABLE)
        prepare_worktree(context)
        prompt_path = context.workspace / ".coding-agent-task.md"
        prompt_path.write_text(build_provider_prompt(context), encoding="utf-8")
        prompt_path.chmod(0o600)

        limits = require_dict(context.task, "limits")
        runtime_seconds = min(
            MAX_RUNTIME_SECONDS,
            max(60, int(limits.get("maxRuntimeMinutes", 45)) * 60),
        )
        command = provider_command(provider, context, prompt_path)
        provider_result = run_process(
            context.run_id,
            command,
            cwd=context.workspace,
            timeout=runtime_seconds,
            env=provider_environment(provider),
            display_name=f"{provider} agent",
        )
        if provider_result["exitCode"] != 0:
            raise WorkerError(
                f"{provider} exited with code {provider_result['exitCode']}: {provider_result['stderr'][-2000:]}",
                HTTPStatus.UNPROCESSABLE_ENTITY,
            )

        remove_untracked_task_prompt(context.workspace)
        patch = collect_patch(context)
        commands: list[dict[str, Any]] = [provider_result]
        tests: list[dict[str, Any]] = []
        approved_commands = approved_validation_commands(context.repository_map)
        for command_text in require_string_list(context.plan, "validationSteps", minimum=1):
            if command_text not in approved_commands:
                raise WorkerError(f"Validation command is not repository-map approved: {command_text}")
            result = run_process(
                context.run_id,
                shlex.split(command_text),
                cwd=context.workspace,
                timeout=min(MAX_COMMAND_SECONDS, runtime_seconds),
                env=validation_environment(),
                display_name=command_text,
            )
            commands.append(result)
            tests.append(
                {
                    "name": command_text[:240],
                    "command": command_text[:2000],
                    "passed": result["exitCode"] == 0 and not result["timedOut"],
                    "exitCode": result["exitCode"],
                    "durationMs": result["durationMs"],
                    "summary": summarize_command(result),
                }
            )

        state = {
            "runId": context.run_id,
            "provider": provider,
            "branchName": context.branch,
            "baseCommit": context.base_commit,
            "workspace": str(context.workspace),
            "diffSha256": sha256_text(patch["diff"]),
            "changedFiles": patch["changedFiles"],
            "tests": tests,
            "createdAt": now_iso(),
        }
        atomic_write_json(state_path(context.run_id), state)
        return {"patch": patch, "commands": commands, "tests": tests}


def review_patch(payload: dict[str, Any]) -> dict[str, Any]:
    task = require_dict(payload, "task")
    patch = require_dict(payload, "patch")
    changed_files = require_string_list(patch, "changedFiles", minimum=1)
    additions = int(patch.get("additions", 0))
    deletions = int(patch.get("deletions", 0))
    labels = set(require_string_list(task, "labels", minimum=0))
    codes: list[str] = ["review.independent_worker"]
    reasons: list[str] = ["The external worker independently checked scope, patch size and publication state."]
    risk = "low"
    accepted = True
    external = False

    if any(path.startswith(("lib/coding-agent/", "services/coding-agent-worker/")) for path in changed_files):
        risk = "high"
        external = True
        codes.append("review.self_modification")
        reasons.append("Coding-agent source changed and requires an external reviewer.")
        if "self-modification" not in labels:
            accepted = False
            codes.append("review.self_modification_label_missing")
            reasons.append("The required self-modification label is missing.")
    if additions + deletions > 5000:
        risk = max_risk(risk, "high")
        codes.append("review.large_patch")
        reasons.append("The patch is large and needs focused human review.")
    if any(path.endswith(("package.json", "pyproject.toml", "requirements.txt", "Dockerfile")) for path in changed_files):
        risk = max_risk(risk, "medium")
        codes.append("review.dependencies_or_runtime")
        reasons.append("Dependency or runtime configuration changed.")

    return {
        "decision": {
            "accepted": accepted,
            "risk": risk,
            "codes": codes,
            "reasons": reasons,
            "requiresHumanReview": True,
            "requiresExternalReviewer": external,
        },
        "notes": [
            "No merge action is available in this worker.",
            "Publication is allowed only after all recorded validation commands pass.",
        ],
    }


def publish(provider: str, payload: dict[str, Any]) -> dict[str, Any]:
    context = parse_run_context(provider, payload)
    run = require_dict(payload, "run")
    patch = require_dict(payload, "patch")
    decision = require_dict(run, "policyDecision")
    if decision.get("accepted") is not True:
        raise WorkerError("Run policy decision is not accepted.", HTTPStatus.CONFLICT)
    if run.get("status") != "publishing":
        raise WorkerError("Run must be in publishing state.", HTTPStatus.CONFLICT)

    lock = run_lock(context.run_id)
    with lock:
        state = read_state(context.run_id)
        if state.get("provider") != provider or state.get("branchName") != context.branch:
            raise WorkerError("Stored execution state does not match the publication request.", HTTPStatus.CONFLICT)
        if state.get("baseCommit") != context.base_commit:
            raise WorkerError("Stored base commit does not match the publication request.", HTTPStatus.CONFLICT)
        if not all(test.get("passed") is True and test.get("exitCode") == 0 for test in state.get("tests", [])):
            raise WorkerError("Publication refused because validation did not pass.", HTTPStatus.CONFLICT)

        current_patch = collect_patch(context)
        expected_diff = require_string(patch, "diff")
        if current_patch["diff"] != expected_diff:
            raise WorkerError("Worktree diff changed after validation.", HTTPStatus.CONFLICT)
        if sha256_text(current_patch["diff"]) != state.get("diffSha256"):
            raise WorkerError("Validated patch digest does not match the current worktree.", HTTPStatus.CONFLICT)

        ensure_remote_branch_absent(context.branch)
        git(context.workspace, "config", "user.name", os.getenv("CODING_AGENT_GIT_AUTHOR_NAME", "T1 Coding Agent"))
        git(context.workspace, "config", "user.email", os.getenv("CODING_AGENT_GIT_AUTHOR_EMAIL", "coding-agent@localhost"))
        git(context.workspace, "add", "--all")
        objective = require_string(context.task, "objective")
        commit_message = f"agent({provider}): {objective.strip()[:120]}"
        git(context.workspace, "commit", "-m", commit_message)
        git(context.workspace, "push", "origin", f"HEAD:refs/heads/{context.branch}", env=git_environment())
        pull_request_url = create_github_pull_request(context, state)
        state["publishedAt"] = now_iso()
        state["pullRequestUrl"] = pull_request_url
        atomic_write_json(state_path(context.run_id), state)
        return {"branchName": context.branch, "pullRequestUrl": pull_request_url}


def parse_run_context(provider: str, payload: dict[str, Any]) -> RunContext:
    run = require_dict(payload, "run")
    task = require_dict(run, "task")
    repository_map = require_dict(payload, "repositoryMap")
    plan = require_dict(payload, "plan")
    run_id = safe_id(require_string(run, "id"))
    adapter_id = require_string(run, "adapterId")
    if adapter_id != provider:
        raise WorkerError("Run adapter does not match endpoint provider.")
    branch = require_string(run, "branchName")
    expected_prefix = f"agent/{provider}/"
    if not branch.startswith(expected_prefix) or not safe_git_ref(branch):
        raise WorkerError("Branch must use the isolated agent/{provider}/{task-id} convention.")
    base_commit = require_string(run, "baseCommit")
    if not re.fullmatch(r"[a-fA-F0-9]{7,64}", base_commit):
        raise WorkerError("Base commit must be a concrete Git SHA.")
    if repository_map.get("baseCommit") != base_commit:
        raise WorkerError("Repository map and run base commits differ.")
    allowed_paths = require_string_list(task, "allowedPaths", minimum=1)
    protected_paths = repository_map.get("protectedPaths", [])
    if isinstance(protected_paths, list):
        for allowed in allowed_paths:
            if any(paths_overlap(allowed, str(protected)) for protected in protected_paths):
                raise WorkerError(f"Task allowlist overlaps a protected path: {allowed}")
    workspace = (RUNS_ROOT / run_id / "workspace").resolve()
    if RUNS_ROOT not in workspace.parents:
        raise WorkerError("Resolved workspace escaped the worker root.")
    return RunContext(run_id, provider, branch, base_commit.lower(), workspace, task, repository_map, plan)


def prepare_worktree(context: RunContext) -> None:
    ensure_mirror()
    ensure_commit(context.base_commit)
    ensure_remote_branch_absent(context.branch)
    run_root = context.workspace.parent
    if run_root.exists():
        remove_worktree(context.workspace)
        shutil.rmtree(run_root, ignore_errors=True)
    run_root.mkdir(parents=True, mode=0o700)
    git_bare("worktree", "add", "--detach", str(context.workspace), context.base_commit)
    git(context.workspace, "switch", "-c", context.branch)


def ensure_mirror() -> None:
    with MIRROR_LOCK:
        ROOT.mkdir(parents=True, exist_ok=True)
        RUNS_ROOT.mkdir(parents=True, exist_ok=True)
        STATE_ROOT.mkdir(parents=True, exist_ok=True)
        if not MIRROR.exists():
            source = repository_source()
            run_checked(["git", "clone", "--mirror", source, str(MIRROR)], cwd=ROOT, env=git_environment(), timeout=600)
        else:
            git_bare("remote", "update", "--prune", env=git_environment(), timeout=600)


def repository_source() -> str:
    if LOCAL_REPOSITORY:
        source = Path(LOCAL_REPOSITORY).resolve()
        if not source.is_dir():
            raise WorkerError("CODING_AGENT_LOCAL_REPOSITORY is not a directory.", HTTPStatus.SERVICE_UNAVAILABLE)
        return str(source)
    if REPOSITORY_URL:
        return REPOSITORY_URL
    raise WorkerError("Configure CODING_AGENT_REPOSITORY_URL or CODING_AGENT_LOCAL_REPOSITORY.", HTTPStatus.SERVICE_UNAVAILABLE)


def ensure_commit(commit: str) -> None:
    result = run_checked(["git", "--git-dir", str(MIRROR), "cat-file", "-e", f"{commit}^{{commit}}"], cwd=ROOT, check=False)
    if result.returncode != 0:
        raise WorkerError(f"Base commit is unavailable in the repository mirror: {commit}")


def ensure_remote_branch_absent(branch: str) -> None:
    if not MIRROR.exists():
        return
    result = run_checked(
        ["git", "--git-dir", str(MIRROR), "ls-remote", "--exit-code", "--heads", "origin", f"refs/heads/{branch}"],
        cwd=ROOT,
        env=git_environment(),
        timeout=120,
        check=False,
    )
    if result.returncode == 0:
        raise WorkerError(f"Remote agent branch already exists and will not be overwritten: {branch}", HTTPStatus.CONFLICT)
    if result.returncode not in (1, 2):
        raise WorkerError("Could not verify remote branch state.", HTTPStatus.SERVICE_UNAVAILABLE)


def provider_command(provider: str, context: RunContext, prompt_path: Path) -> list[str]:
    variable = f"CODING_AGENT_{provider.upper()}_COMMAND_JSON"
    configured = os.getenv(variable, "").strip()
    if configured:
        try:
            template = json.loads(configured)
        except json.JSONDecodeError as error:
            raise WorkerError(f"{variable} must be a JSON argv array.", HTTPStatus.SERVICE_UNAVAILABLE) from error
        if not isinstance(template, list) or not template or not all(isinstance(item, str) for item in template):
            raise WorkerError(f"{variable} must be a non-empty JSON string array.", HTTPStatus.SERVICE_UNAVAILABLE)
    elif provider == "aider":
        model = os.getenv("CODING_AGENT_AIDER_MODEL", "").strip()
        if not model:
            raise WorkerError("Configure CODING_AGENT_AIDER_MODEL or a custom Aider command.", HTTPStatus.SERVICE_UNAVAILABLE)
        template = [
            "aider",
            "--yes",
            "--no-auto-commits",
            "--no-dirty-commits",
            "--no-stream",
            "--model",
            model,
            "--message-file",
            "{prompt_file}",
        ]
    else:
        template = [
            "python",
            "/app/providers/openhands_runner.py",
            "--workspace",
            "{workspace}",
            "--prompt-file",
            "{prompt_file}",
        ]
    replacements = {
        "{workspace}": str(context.workspace),
        "{prompt_file}": str(prompt_path),
        "{run_id}": context.run_id,
        "{branch}": context.branch,
        "{base_commit}": context.base_commit,
    }
    return [replacements.get(item, item) for item in template]


def provider_available(provider: str) -> bool:
    variable = f"CODING_AGENT_{provider.upper()}_COMMAND_JSON"
    configured = os.getenv(variable, "").strip()
    if configured:
        try:
            argv = json.loads(configured)
        except json.JSONDecodeError:
            return False
        return isinstance(argv, list) and bool(argv) and shutil.which(str(argv[0])) is not None
    if provider == "aider":
        return shutil.which("aider") is not None and bool(os.getenv("CODING_AGENT_AIDER_MODEL", "").strip())
    return Path("/app/providers/openhands_runner.py").is_file() and python_module_available("openhands.sdk")


def python_module_available(name: str) -> bool:
    result = subprocess.run(
        ["python", "-c", f"import {name}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def build_provider_prompt(context: RunContext) -> str:
    allowed_paths = require_string_list(context.task, "allowedPaths", minimum=1)
    return "\n".join(
        [
            "# Controlled coding-agent task",
            "",
            f"Run ID: {context.run_id}",
            f"Base commit: {context.base_commit}",
            f"Working branch: {context.branch}",
            f"Objective: {require_string(context.task, 'objective')}",
            f"Reason: {require_string(context.plan, 'reason')}",
            "",
            "## Allowed repository paths",
            *[f"- {path}" for path in allowed_paths],
            "",
            "## Required validation",
            *[f"- {command}" for command in require_string_list(context.plan, "validationSteps", minimum=1)],
            "",
            "## Mandatory rules",
            "- Work only inside the current repository worktree.",
            "- Modify only the allowlisted paths above.",
            "- Prefer focused patches over complete rewrites.",
            "- Do not read, print or copy environment secrets or credentials.",
            "- Do not create commits, push branches, open pull requests or merge anything.",
            "- Do not disable tests, security controls, branch protection, audit logs or policy validators.",
            "- Do not add binary files, obfuscated code, remote download-to-shell execution or hidden network calls.",
            "- Leave the worktree with source changes only; the worker runs validation and publication separately.",
            "",
            "## Plan",
            json.dumps(context.plan, ensure_ascii=False, indent=2),
        ]
    )


def collect_patch(context: RunContext) -> dict[str, Any]:
    diff = git(context.workspace, "diff", "--binary", "--no-ext-diff", context.base_commit, "--").stdout
    encoded = diff.encode("utf-8")
    if not diff.strip():
        raise WorkerError("Provider completed without producing a source patch.", HTTPStatus.UNPROCESSABLE_ENTITY)
    if len(encoded) > MAX_DIFF_BYTES:
        raise WorkerError("Generated patch exceeds the configured size limit.", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
    changed = [line for line in git(context.workspace, "diff", "--name-only", context.base_commit, "--").stdout.splitlines() if line]
    untracked = [line for line in git(context.workspace, "ls-files", "--others", "--exclude-standard").stdout.splitlines() if line]
    changed_files = sorted(set(changed + untracked))
    if not changed_files:
        raise WorkerError("Patch contains no changed files.")
    validate_changed_files(context, changed_files)
    additions, deletions = diff_stats(context.workspace, context.base_commit)
    patch_id = hashlib.sha256((context.run_id + context.base_commit + diff).encode("utf-8")).hexdigest()[:32]
    return {
        "id": f"patch-{patch_id}",
        "runId": context.run_id,
        "baseCommit": context.base_commit,
        "changedFiles": changed_files,
        "additions": additions,
        "deletions": deletions,
        "diff": diff,
        "explanation": f"Patch generated by {context.provider} in isolated worktree {context.run_id}.",
    }


def validate_changed_files(context: RunContext, changed_files: Iterable[str]) -> None:
    allowed = require_string_list(context.task, "allowedPaths", minimum=1)
    for raw in changed_files:
        path = normalize_repo_path(raw)
        if not any(path_is_allowed(path, entry) for entry in allowed):
            raise WorkerError(f"Provider changed a file outside the task allowlist: {path}", HTTPStatus.UNPROCESSABLE_ENTITY)
        absolute = (context.workspace / path).resolve(strict=False)
        if context.workspace not in absolute.parents and absolute != context.workspace:
            raise WorkerError(f"Changed path escaped the worktree: {path}")
        if absolute.is_symlink():
            raise WorkerError(f"Symlink changes are not allowed: {path}")


def diff_stats(workspace: Path, base_commit: str) -> tuple[int, int]:
    output = git(workspace, "diff", "--numstat", base_commit, "--").stdout
    additions = 0
    deletions = 0
    for line in output.splitlines():
        parts = line.split("\t", 2)
        if len(parts) < 2:
            continue
        if parts[0].isdigit():
            additions += int(parts[0])
        if parts[1].isdigit():
            deletions += int(parts[1])
    return additions, deletions


def select_validation_commands(repository_map: dict[str, Any], allowed_paths: list[str]) -> list[str]:
    approved = list(approved_validation_commands(repository_map))
    module_tokens = {normalize_repo_path(path).split("/")[0:2][0] for path in allowed_paths}
    prioritized = [command for command in approved if any(token in command for token in module_tokens)]
    ordered = prioritized + [command for command in approved if command not in prioritized]
    return ordered[:12]


def approved_validation_commands(repository_map: dict[str, Any]) -> set[str]:
    output: set[str] = set()
    for key in ("testCommands", "buildCommands"):
        value = repository_map.get(key, [])
        if isinstance(value, list):
            output.update(item for item in value if isinstance(item, str) and 0 < len(item) <= 2000)
    extra_raw = os.getenv("CODING_AGENT_EXTRA_VALIDATION_COMMANDS_JSON", "").strip()
    if extra_raw:
        try:
            extra = json.loads(extra_raw)
        except json.JSONDecodeError as error:
            raise WorkerError("CODING_AGENT_EXTRA_VALIDATION_COMMANDS_JSON is invalid.", HTTPStatus.SERVICE_UNAVAILABLE) from error
        if not isinstance(extra, list) or not all(isinstance(item, str) for item in extra):
            raise WorkerError("Extra validation commands must be a JSON string array.", HTTPStatus.SERVICE_UNAVAILABLE)
        output.update(extra)
    return output


def run_process(
    run_id: str,
    argv: list[str],
    *,
    cwd: Path,
    timeout: int,
    env: dict[str, str],
    display_name: str,
) -> dict[str, Any]:
    if not argv or not argv[0]:
        raise WorkerError("Command argv is empty.")
    started = time.monotonic()
    process = subprocess.Popen(
        argv,
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    with ACTIVE_LOCK:
        ACTIVE_PROCESSES[run_id] = process
    timed_out = False
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        terminate_process(process)
        stdout, stderr = process.communicate()
    finally:
        with ACTIVE_LOCK:
            ACTIVE_PROCESSES.pop(run_id, None)
    duration_ms = int((time.monotonic() - started) * 1000)
    return {
        "command": display_name[:2000],
        "exitCode": process.returncode if process.returncode is not None else 124,
        "stdout": truncate_output(stdout),
        "stderr": truncate_output(stderr),
        "durationMs": duration_ms,
        "timedOut": timed_out,
    }


def stop_run(run_id: str) -> bool:
    with ACTIVE_LOCK:
        process = ACTIVE_PROCESSES.get(run_id)
    if process is None:
        return False
    terminate_process(process)
    return True


def terminate_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=10)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def create_github_pull_request(context: RunContext, state: dict[str, Any]) -> str:
    repository = GITHUB_REPOSITORY
    token = github_token()
    if not repository or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise WorkerError("Configure CODING_AGENT_GITHUB_REPOSITORY as owner/name.", HTTPStatus.SERVICE_UNAVAILABLE)
    owner = repository.split("/", 1)[0]
    base_branch = require_string(context.task, "baseBranch")
    title = require_string(context.task, "objective").strip()[:240]
    body = "\n".join(
        [
            "## Controlled coding-agent run",
            "",
            f"- Adapter: `{context.provider}`",
            f"- Run: `{context.run_id}`",
            f"- Base commit: `{context.base_commit}`",
            f"- Branch: `{context.branch}`",
            "- Merge: human review required; worker has no merge operation",
            "",
            "## Validation",
            *[
                f"- {'PASS' if test.get('passed') else 'FAIL'} `{test.get('command', '')}` ({test.get('durationMs', 0)} ms)"
                for test in state.get("tests", [])
            ],
            "",
            "## Plan",
            f"Objective: {require_string(context.plan, 'objective')}",
            f"Rollback: {require_string(context.plan, 'rollbackPlan')}",
        ]
    )
    payload = {
        "title": title or f"Coding-agent run {context.run_id}",
        "head": context.branch,
        "base": base_branch,
        "body": body,
        "draft": True,
        "maintainer_can_modify": False,
    }
    try:
        response = github_request("POST", f"/repos/{repository}/pulls", token, payload)
        url = response.get("html_url")
        if isinstance(url, str):
            return url
        raise WorkerError("GitHub did not return a pull request URL.", HTTPStatus.BAD_GATEWAY)
    except WorkerError as error:
        if error.status != HTTPStatus.UNPROCESSABLE_ENTITY:
            raise
        query = urllib.parse.urlencode({"state": "open", "head": f"{owner}:{context.branch}", "base": base_branch})
        existing = github_request("GET", f"/repos/{repository}/pulls?{query}", token)
        if isinstance(existing, list) and existing and isinstance(existing[0], dict):
            url = existing[0].get("html_url")
            if isinstance(url, str):
                return url
        raise


def github_request(method: str, path: str, token: str, payload: dict[str, Any] | None = None) -> Any:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.github.com{path}",
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "T1-Coding-Agent-Worker/1.0",
            **({"Content-Type": "application/json"} if data is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read(MAX_BODY_BYTES)
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read(64 * 1024).decode("utf-8", errors="replace")
        message = raw
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and isinstance(parsed.get("message"), str):
                message = parsed["message"]
        except json.JSONDecodeError:
            pass
        raise WorkerError(f"GitHub API {error.code}: {message[:2000]}", error.code) from error


def require_auth(header: str) -> None:
    if len(TOKEN) < 24:
        raise WorkerError("Worker authentication is not configured.", HTTPStatus.SERVICE_UNAVAILABLE)
    match = re.fullmatch(r"Bearer\s+(.+)", header, flags=re.IGNORECASE)
    supplied = match.group(1) if match else ""
    if not hmac.compare_digest(TOKEN.encode(), supplied.encode()):
        raise WorkerError("Invalid worker credential.", HTTPStatus.UNAUTHORIZED)


def provider_environment(provider: str) -> dict[str, str]:
    allowed_prefixes = (
        "OPENAI_",
        "ANTHROPIC_",
        "OPENROUTER_",
        "DEEPSEEK_",
        "GOOGLE_",
        "GEMINI_",
        "AZURE_",
        "AWS_",
        "LITELLM_",
        "AIDER_",
        "OPENHANDS_",
    )
    env = validation_environment()
    for key, value in os.environ.items():
        if key.startswith(allowed_prefixes):
            env[key] = value
    env["CODING_AGENT_PROVIDER"] = provider
    return env


def validation_environment() -> dict[str, str]:
    allowed = ("PATH", "HOME", "LANG", "LC_ALL", "TZ", "TMPDIR", "CI", "NODE_ENV", "PNPM_HOME")
    env = {key: os.environ[key] for key in allowed if key in os.environ}
    env.setdefault("CI", "true")
    env.setdefault("NODE_ENV", "test")
    env["GIT_TERMINAL_PROMPT"] = "0"
    return env


def git_environment() -> dict[str, str]:
    env = validation_environment()
    token = github_token(optional=True)
    if token:
        askpass = ROOT / ".git-askpass.sh"
        if not askpass.exists():
            askpass.write_text(
                "#!/bin/sh\ncase \"$1\" in *Username*) printf '%s\\n' 'x-access-token' ;; *) printf '%s\\n' \"$CODING_AGENT_GIT_TOKEN\" ;; esac\n",
                encoding="utf-8",
            )
            askpass.chmod(0o700)
        env["GIT_ASKPASS"] = str(askpass)
        env["CODING_AGENT_GIT_TOKEN"] = token
    return env


def github_token(optional: bool = False) -> str:
    token = os.getenv("CODING_AGENT_GITHUB_TOKEN", "").strip() or os.getenv("GITHUB_TOKEN", "").strip()
    if not token and not optional:
        raise WorkerError("Configure CODING_AGENT_GITHUB_TOKEN for Git push and PR publication.", HTTPStatus.SERVICE_UNAVAILABLE)
    return token


def git(workspace: Path, *args: str, env: dict[str, str] | None = None, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    return run_checked(["git", *args], cwd=workspace, env=env, timeout=timeout)


def git_bare(*args: str, env: dict[str, str] | None = None, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    return run_checked(["git", "--git-dir", str(MIRROR), *args], cwd=ROOT, env=env, timeout=timeout)


def run_checked(
    argv: list[str],
    *,
    cwd: Path,
    env: dict[str, str] | None = None,
    timeout: int = 300,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        argv,
        cwd=cwd,
        env=env or validation_environment(),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
        check=False,
    )
    if check and result.returncode != 0:
        raise WorkerError(f"Command failed ({argv[0]}): {truncate_output(result.stderr)[-2000:]}", HTTPStatus.UNPROCESSABLE_ENTITY)
    return result


def remove_worktree(workspace: Path) -> None:
    if MIRROR.exists() and workspace.exists():
        git_bare("worktree", "remove", "--force", str(workspace), timeout=120)


def remove_untracked_task_prompt(workspace: Path) -> None:
    prompt = workspace / ".coding-agent-task.md"
    if prompt.exists():
        prompt.unlink()


def read_state(run_id: str) -> dict[str, Any]:
    path = state_path(run_id)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as error:
        raise WorkerError("Validated execution state is unavailable for publication.", HTTPStatus.CONFLICT) from error
    if not isinstance(value, dict):
        raise WorkerError("Stored execution state is invalid.", HTTPStatus.CONFLICT)
    return value


def state_path(run_id: str) -> Path:
    return STATE_ROOT / f"{safe_id(run_id)}.json"


def atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.chmod(0o600)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink(missing_ok=True)


def require_dict(container: dict[str, Any], key: str, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    value = container.get(key, fallback)
    if not isinstance(value, dict):
        raise WorkerError(f"{key} must be an object.")
    return value


def require_string(container: dict[str, Any], key: str) -> str:
    value = container.get(key)
    if not isinstance(value, str) or not value.strip():
        raise WorkerError(f"{key} must be a non-empty string.")
    return value


def require_string_list(container: dict[str, Any], key: str, minimum: int = 0) -> list[str]:
    value = container.get(key, [])
    if not isinstance(value, list) or not all(isinstance(item, str) and item.strip() for item in value):
        raise WorkerError(f"{key} must be a string array.")
    if len(value) < minimum:
        raise WorkerError(f"{key} must contain at least {minimum} item(s).")
    return value


def normalize_repo_path(value: str) -> str:
    normalized = str(PurePosixPath(value.replace("\\", "/"))).lstrip("./")
    if not normalized or normalized.startswith("/") or ".." in PurePosixPath(normalized).parts:
        raise WorkerError(f"Invalid repository path: {value}")
    return normalized


def path_is_allowed(path: str, allowed: str) -> bool:
    path = normalize_repo_path(path)
    allowed = normalize_repo_path(allowed)
    if allowed.endswith("/**"):
        prefix = allowed[:-3].rstrip("/")
        return path == prefix or path.startswith(f"{prefix}/")
    if allowed.endswith("/"):
        prefix = allowed.rstrip("/")
        return path == prefix or path.startswith(f"{prefix}/")
    return path == allowed or path.startswith(f"{allowed}/")


def paths_overlap(first: str, second: str) -> bool:
    a = normalize_repo_path(first).rstrip("/**/")
    b = normalize_repo_path(second).rstrip("/**/")
    return a == b or a.startswith(f"{b}/") or b.startswith(f"{a}/")


def safe_id(value: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", value)[:180]
    if not safe or safe in {".", ".."}:
        raise WorkerError("Invalid run identifier.")
    return safe


def safe_git_ref(value: str) -> bool:
    return (
        len(value) <= 240
        and not value.startswith(("/", "."))
        and not value.endswith(("/", ".", ".lock"))
        and ".." not in value
        and "//" not in value
        and not re.search(r"[~^:?*\[\\\s]", value)
    )


def run_lock(run_id: str) -> threading.RLock:
    with ACTIVE_LOCK:
        return RUN_LOCKS.setdefault(run_id, threading.RLock())


def active_run_ids() -> list[str]:
    with ACTIVE_LOCK:
        return sorted(ACTIVE_PROCESSES)


def summarize_command(result: dict[str, Any]) -> str:
    output = str(result.get("stdout", "")).strip() or str(result.get("stderr", "")).strip()
    status = "passed" if result.get("exitCode") == 0 and not result.get("timedOut") else "failed"
    return f"{status}: {output[-8000:]}"[:10000]


def truncate_output(value: str) -> str:
    encoded = value.encode("utf-8", errors="replace")
    if len(encoded) <= MAX_OUTPUT_BYTES:
        return value
    return encoded[-MAX_OUTPUT_BYTES:].decode("utf-8", errors="replace")


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def max_risk(first: str, second: str) -> str:
    order = ["low", "medium", "high", "critical"]
    return first if order.index(first) >= order.index(second) else second


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def main() -> None:
    if len(TOKEN) < 24:
        raise SystemExit("CODING_AGENT_WORKER_TOKEN must contain at least 24 characters.")
    ROOT.mkdir(parents=True, exist_ok=True)
    RUNS_ROOT.mkdir(parents=True, exist_ok=True)
    STATE_ROOT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), CodingAgentHandler)
    print(json.dumps({"event": "coding-agent-worker.started", "host": HOST, "port": PORT}), flush=True)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.server_close()
        for run_id in active_run_ids():
            stop_run(run_id)


if __name__ == "__main__":
    main()
