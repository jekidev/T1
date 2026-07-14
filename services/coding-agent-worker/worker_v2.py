#!/usr/bin/env python3
"""Network-gated entrypoint for the coding-agent worker.

This module reuses the worker's Git/policy implementation while replacing network
handling. The worker container must be attached only to an internal Docker network;
`network_gate.py` is the sole dual-homed egress service.
"""

from __future__ import annotations

import base64
import json
import os
import secrets
import threading
import time
import urllib.parse
from pathlib import Path
from typing import Any

import worker as base

POLICY_ROOT = Path(os.getenv("NETWORK_GATE_POLICY_ROOT", "/network-policies")).resolve()
PROXY_HOST = os.getenv("NETWORK_GATE_PROXY_HOST", "network-gate")
PROXY_PORT = int(os.getenv("NETWORK_GATE_PROXY_PORT", "8888"))
INFRA_TOKEN = os.getenv("NETWORK_GATE_INFRA_TOKEN", "")
POLICY_TTL_SECONDS = int(os.getenv("NETWORK_GATE_POLICY_TTL_SECONDS", str(2 * 60 * 60)))
_thread_state = threading.local()
_original_execute = base.execute
_original_review = base.review_patch
_original_build_prompt = base.build_provider_prompt
_original_validation_environment = base.validation_environment


def network_mode(task: dict[str, Any]) -> str:
    labels = set(base.require_string_list(task, "labels", minimum=0))
    modes = {
        "offline": "network-offline" in labels,
        "ask_first": "network-ask-first" in labels,
        "ultra": "network-ultra-confirmed" in labels,
    }
    selected = [name for name, active in modes.items() if active]
    if len(selected) > 1:
        raise base.WorkerError(f"Conflicting network modes: {', '.join(selected)}")
    return selected[0] if selected else "ask_first"


def approved_domains(task: dict[str, Any]) -> list[str]:
    output: list[str] = []
    for label in base.require_string_list(task, "labels", minimum=0):
        if not label.startswith("network-domain:"):
            continue
        domain = normalize_domain(label.split(":", 1)[1])
        if domain and domain not in output:
            output.append(domain)
    return sorted(output)


def model_domains() -> list[str]:
    raw = os.getenv(
        "NETWORK_GATE_MODEL_DOMAINS",
        "openrouter.ai,api.openai.com,api.anthropic.com,api.deepseek.com,generativelanguage.googleapis.com",
    )
    return sorted({domain for value in raw.split(",") if (domain := normalize_domain(value))})


def execute(provider: str, payload: dict[str, Any]) -> dict[str, Any]:
    context = base.parse_run_context(provider, payload)
    mode = network_mode(context.task)
    nonce = secrets.token_urlsafe(32)
    write_policy(context.run_id, mode, approved_domains(context.task), nonce)
    _thread_state.context = context
    _thread_state.network_nonce = nonce
    try:
        result = _original_execute(provider, payload)
        result["networkPolicy"] = {
            "mode": mode,
            "approvedDomains": approved_domains(context.task),
            "deniedRequests": list_denied_requests(context.run_id),
        }
        return result
    finally:
        _thread_state.context = None
        _thread_state.network_nonce = None


def review_patch(payload: dict[str, Any]) -> dict[str, Any]:
    result = _original_review(payload)
    task = base.require_dict(payload, "task")
    mode = network_mode(task)
    decision = result.get("decision")
    if isinstance(decision, dict):
        codes = decision.setdefault("codes", [])
        reasons = decision.setdefault("reasons", [])
        if mode == "ultra":
            codes.append("review.network_ultra")
            reasons.append("The user explicitly selected Ultra. Review fetched sources, licenses and dependency changes before merge.")
            decision["risk"] = max_risk(str(decision.get("risk", "low")), "high")
        elif mode == "ask_first":
            codes.append("review.network_ask_first")
            reasons.append("Only model transport and user-approved domains were available to the agent.")
        else:
            codes.append("review.network_offline")
            reasons.append("Agent web access was disabled for this run.")
    notes = result.setdefault("notes", [])
    notes.append(f"Network mode: {mode}.")
    denied = list_denied_requests(base.require_string(base.require_dict(payload, "patch"), "runId"))
    if denied:
        notes.append(f"Denied network requests: {', '.join(item['domain'] for item in denied[:20])}.")
    return result


def build_provider_prompt(context: base.RunContext) -> str:
    mode = network_mode(context.task)
    domains = approved_domains(context.task)
    policy_text = {
        "offline": "Web browsing and arbitrary network calls are disabled. Do not attempt them.",
        "ask_first": (
            "Web browsing is blocked unless the user approved the exact domain before this run. "
            f"Approved domains: {', '.join(domains) if domains else 'none'}. If another domain is needed, stop and report it; do not bypass the gate."
        ),
        "ultra": "The user explicitly selected Ultra for this isolated run, so web access is pre-approved. Record sources and licenses in the patch explanation.",
    }[mode]
    return _original_build_prompt(context) + "\n\n## Enforced network policy\n- " + policy_text + "\n"


def provider_environment(provider: str) -> dict[str, str]:
    context = getattr(_thread_state, "context", None)
    nonce = getattr(_thread_state, "network_nonce", None)
    if context is None or not nonce:
        raise base.WorkerError("Provider network context is unavailable.")
    environment = sanitized_environment()
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
    explicit = {
        "CODING_AGENT_AIDER_MODEL",
        "CODING_AGENT_OPENHANDS_MODEL",
        "CODING_AGENT_OPENHANDS_API_KEY",
        "CODING_AGENT_OPENHANDS_BASE_URL",
    }
    for key, value in os.environ.items():
        if key.startswith(allowed_prefixes) or key in explicit:
            environment[key] = value
    proxy = proxy_url(context.run_id, nonce)
    environment.update({
        "HTTP_PROXY": proxy,
        "HTTPS_PROXY": proxy,
        "ALL_PROXY": proxy,
        "http_proxy": proxy,
        "https_proxy": proxy,
        "all_proxy": proxy,
        "NO_PROXY": "127.0.0.1,localhost",
        "no_proxy": "127.0.0.1,localhost",
        "CODING_AGENT_PROVIDER": provider,
        "CODING_AGENT_NETWORK_MODE": network_mode(context.task),
    })
    return environment


def validation_environment() -> dict[str, str]:
    # Tests run without proxy credentials. On the internal-only worker network,
    # this makes accidental package downloads or telemetry calls fail closed.
    environment = sanitized_environment()
    environment.update({
        "NO_PROXY": "*",
        "no_proxy": "*",
        "HTTP_PROXY": "http://127.0.0.1:9",
        "HTTPS_PROXY": "http://127.0.0.1:9",
        "ALL_PROXY": "http://127.0.0.1:9",
        "http_proxy": "http://127.0.0.1:9",
        "https_proxy": "http://127.0.0.1:9",
        "all_proxy": "http://127.0.0.1:9",
    })
    return environment


def git_environment() -> dict[str, str]:
    if len(INFRA_TOKEN) < 24:
        raise base.WorkerError("NETWORK_GATE_INFRA_TOKEN must contain at least 24 characters.")
    environment = sanitized_environment()
    proxy = proxy_url("infrastructure", INFRA_TOKEN)
    environment.update({
        "HTTP_PROXY": proxy,
        "HTTPS_PROXY": proxy,
        "ALL_PROXY": proxy,
        "http_proxy": proxy,
        "https_proxy": proxy,
        "all_proxy": proxy,
        "GIT_TERMINAL_PROMPT": "0",
    })
    github_token = base.github_token(optional=True)
    if github_token:
        askpass = base.ROOT / ".git-askpass.sh"
        if not askpass.exists():
            askpass.write_text(
                "#!/bin/sh\ncase \"$1\" in *Username*) printf '%s\\n' 'x-access-token' ;; *) printf '%s\\n' \"$CODING_AGENT_GIT_TOKEN\" ;; esac\n",
                encoding="utf-8",
            )
            askpass.chmod(0o700)
        environment["GIT_ASKPASS"] = str(askpass)
        environment["CODING_AGENT_GIT_TOKEN"] = github_token
    return environment


def sanitized_environment() -> dict[str, str]:
    allowed = ("PATH", "HOME", "LANG", "LC_ALL", "TZ", "TMPDIR", "CI", "NODE_ENV", "PNPM_HOME", "COREPACK_HOME")
    environment = {key: os.environ[key] for key in allowed if key in os.environ}
    environment.setdefault("CI", "true")
    environment.setdefault("NODE_ENV", "test")
    environment["GIT_TERMINAL_PROMPT"] = "0"
    return environment


def write_policy(run_id: str, mode: str, domains: list[str], nonce: str) -> None:
    POLICY_ROOT.mkdir(parents=True, exist_ok=True)
    path = POLICY_ROOT / f"{base.safe_id(run_id)}.json"
    payload = {
        "runId": run_id,
        "nonce": nonce,
        "mode": mode,
        "approvedDomains": domains,
        "modelProviderDomains": model_domains(),
        "createdAt": base.now_iso(),
        "expiresAtEpoch": time.time() + POLICY_TTL_SECONDS,
    }
    base.atomic_write_json(path, payload)


def list_denied_requests(run_id: str) -> list[dict[str, str]]:
    pending = POLICY_ROOT / "pending"
    if not pending.is_dir():
        return []
    prefix = f"{base.safe_id(run_id)}-"
    output: list[dict[str, str]] = []
    for path in sorted(pending.glob(f"{prefix}*.json")):
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(value, dict) and isinstance(value.get("domain"), str):
            output.append({
                "id": str(value.get("id", "")),
                "domain": value["domain"],
                "requestedAt": str(value.get("requestedAt", "")),
            })
    return output[-100:]


def proxy_url(identity: str, token: str) -> str:
    credentials = f"{urllib.parse.quote(identity, safe='')}:{urllib.parse.quote(token, safe='')}"
    return f"http://{credentials}@{PROXY_HOST}:{PROXY_PORT}"


def normalize_domain(value: str) -> str | None:
    domain = value.strip().lower().replace("https://", "").replace("http://", "").split("/", 1)[0].split(":", 1)[0]
    if not domain or len(domain) > 253:
        return None
    if not all(character.isalnum() or character in ".-" for character in domain):
        return None
    if "." not in domain:
        return None
    return domain.strip(".")


def max_risk(first: str, second: str) -> str:
    order = ["low", "medium", "high", "critical"]
    return first if order.index(first) >= order.index(second) else second


base.execute = execute
base.review_patch = review_patch
base.build_provider_prompt = build_provider_prompt
base.provider_environment = provider_environment
base.validation_environment = validation_environment
base.git_environment = git_environment

if __name__ == "__main__":
    base.main()
