#!/usr/bin/env python3
"""Network-gated entrypoint for the coding-agent worker.

The API sends a run-bound authorization. This module writes that authorization to the
shared policy volume, gives the provider a per-run proxy credential, and returns the
firewall audit required by the deterministic TypeScript validator. The worker must be
attached only to the internal Docker network defined in docker-compose.yml.
"""

from __future__ import annotations

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
AUDIT_ROOT = POLICY_ROOT / "audit"
PENDING_ROOT = POLICY_ROOT / "pending"
PROXY_HOST = os.getenv("NETWORK_GATE_PROXY_HOST", "network-gate")
PROXY_PORT = int(os.getenv("NETWORK_GATE_PROXY_PORT", "8888"))
INFRA_TOKEN = os.getenv("NETWORK_GATE_INFRA_TOKEN", "")
_thread_state = threading.local()
_original_execute = base.execute
_original_review = base.review_patch
_original_build_prompt = base.build_provider_prompt

ALLOWED_CAPABILITIES = {
    "web_search",
    "web_fetch",
    "package_registry",
    "source_docs",
    "issue_tracker",
}


def execute(provider: str, payload: dict[str, Any]) -> dict[str, Any]:
    context = base.parse_run_context(provider, payload)
    authorization = validate_authorization(base.require_dict(payload, "networkAuthorization"))
    nonce = secrets.token_urlsafe(32)
    clear_run_network_records(context.run_id)
    write_policy(context.run_id, authorization, nonce)
    _thread_state.context = context
    _thread_state.network_nonce = nonce
    _thread_state.network_authorization = authorization
    try:
        result = _original_execute(provider, payload)
        result["networkAudit"] = collect_network_audit(context.run_id, authorization)
        return result
    finally:
        _thread_state.context = None
        _thread_state.network_nonce = None
        _thread_state.network_authorization = None


def review_patch(payload: dict[str, Any]) -> dict[str, Any]:
    result = _original_review(payload)
    task = base.require_dict(payload, "task")
    network_policy = task.get("networkPolicy", {})
    mode = str(network_policy.get("mode", "ask_first")) if isinstance(network_policy, dict) else "ask_first"
    decision = result.get("decision")
    if isinstance(decision, dict):
        codes = decision.setdefault("codes", [])
        reasons = decision.setdefault("reasons", [])
        if mode == "ultra":
            codes.append("review.network_ultra")
            reasons.append("The user explicitly approved Ultra. Review fetched sources, licenses and dependency changes before merge.")
            decision["risk"] = max_risk(str(decision.get("risk", "low")), "high")
            decision["requiresExternalReviewer"] = True
        else:
            codes.append("review.network_ask_first")
            reasons.append("Agent egress was deny-all or restricted to the exact Ask First hosts and capabilities encoded in the run.")
    notes = result.setdefault("notes", [])
    notes.append(f"Network policy requested by task: {mode}.")
    return result


def build_provider_prompt(context: base.RunContext) -> str:
    authorization = getattr(_thread_state, "network_authorization", None)
    if not isinstance(authorization, dict):
        raise base.WorkerError("Provider network authorization is unavailable.")
    mode = str(authorization["mode"])
    if mode == "deny":
        policy_text = "Ask First has no pre-approved host/capability pair. Arbitrary web and package access is blocked. Stop and report any required host and capability."
    elif mode == "allowlisted":
        policy_text = (
            "Ask First is restricted to hosts "
            f"{', '.join(authorization['allowedHosts'])} and capabilities "
            f"{', '.join(authorization['allowedCapabilities'])}. Do not attempt any other destination or capability."
        )
    else:
        policy_text = "The user explicitly approved Ultra for this isolated run. Public HTTPS is available; private networks and metadata endpoints remain blocked. Record sources and licenses."
    return _original_build_prompt(context) + "\n\n## Enforced network authorization\n- " + policy_text + "\n"


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
        "CODING_AGENT_NETWORK_MODE": str(getattr(_thread_state, "network_authorization", {}).get("mode", "deny")),
    })
    return environment


def validation_environment() -> dict[str, str]:
    # Validation commands receive no network-gate credential. Because the worker is
    # on an internal-only network, package downloads and telemetry fail closed.
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


def validate_authorization(value: dict[str, Any]) -> dict[str, Any]:
    mode = str(value.get("mode", ""))
    if mode not in {"deny", "allowlisted", "ultra"}:
        raise base.WorkerError("Unknown network authorization mode.")
    hosts = value.get("allowedHosts", [])
    capabilities = value.get("allowedCapabilities", [])
    if not isinstance(hosts, list) or not all(isinstance(item, str) and normalize_domain(item) for item in hosts):
        raise base.WorkerError("allowedHosts must contain public DNS hostnames.")
    if not isinstance(capabilities, list) or not all(item in ALLOWED_CAPABILITIES for item in capabilities):
        raise base.WorkerError("allowedCapabilities contains an unsupported value.")
    if mode == "deny" and (hosts or capabilities):
        raise base.WorkerError("Deny authorization cannot include allowed hosts or capabilities.")
    if mode == "allowlisted" and (not hosts or not capabilities):
        raise base.WorkerError("Allowlisted authorization requires hosts and capabilities.")
    for required in ("requireHttps", "blockPrivateNetworks", "rejectRedirectsUntilRevalidated", "auditRequired"):
        if value.get(required) is not True:
            raise base.WorkerError(f"Network authorization requires {required}=true.")
    expires_at = str(value.get("expiresAt", ""))
    try:
        expires_epoch = time.mktime(time.strptime(expires_at.replace(".000Z", "Z"), "%Y-%m-%dT%H:%M:%SZ"))
    except ValueError as error:
        raise base.WorkerError("Network authorization has an invalid expiresAt timestamp.") from error
    if expires_epoch <= time.time():
        raise base.WorkerError("Network authorization expired before execution.")
    return {
        "mode": mode,
        "allowedHosts": sorted({normalize_domain(item) for item in hosts}),
        "allowedCapabilities": sorted(set(capabilities)),
        "requireHttps": True,
        "blockPrivateNetworks": True,
        "rejectRedirectsUntilRevalidated": True,
        "auditRequired": True,
        "expiresAt": expires_at,
        "expiresAtEpoch": expires_epoch,
    }


def write_policy(run_id: str, authorization: dict[str, Any], nonce: str) -> None:
    POLICY_ROOT.mkdir(parents=True, exist_ok=True)
    payload = {
        **authorization,
        "runId": run_id,
        "nonce": nonce,
        "modelProviderDomains": model_domains(),
        "createdAt": base.now_iso(),
    }
    base.atomic_write_json(POLICY_ROOT / f"{base.safe_id(run_id)}.json", payload)


def collect_network_audit(run_id: str, authorization: dict[str, Any]) -> dict[str, Any]:
    requests: list[dict[str, Any]] = []
    prefix = f"{base.safe_id(run_id)}-"
    if AUDIT_ROOT.is_dir():
        for path in sorted(AUDIT_ROOT.glob(f"{prefix}*.json")):
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(value, dict):
                continue
            request = {
                "at": str(value.get("at", "")),
                "capability": str(value.get("capability", "web_fetch")),
                "method": str(value.get("method", "GET")),
                "origin": str(value.get("origin", "")),
                "path": str(value.get("path", "/")),
                "allowed": bool(value.get("allowed", False)),
                "reason": str(value.get("reason", "firewall decision")),
            }
            requests.append(request)
    return {
        "mode": authorization["mode"],
        "enforcement": "sandbox_firewall",
        "requests": requests[-10_000:],
        "privateNetworkBlocked": True,
        "metadataEndpointsBlocked": True,
        "redirectsRevalidated": True,
    }


def clear_run_network_records(run_id: str) -> None:
    prefix = f"{base.safe_id(run_id)}-"
    for root in (AUDIT_ROOT, PENDING_ROOT):
        if not root.is_dir():
            continue
        for path in root.glob(f"{prefix}*.json"):
            path.unlink(missing_ok=True)


def model_domains() -> list[str]:
    raw = os.getenv(
        "NETWORK_GATE_MODEL_DOMAINS",
        "openrouter.ai,api.openai.com,api.anthropic.com,api.deepseek.com,generativelanguage.googleapis.com",
    )
    return sorted({domain for value in raw.split(",") if (domain := normalize_domain(value))})


def proxy_url(identity: str, token: str) -> str:
    credentials = f"{urllib.parse.quote(identity, safe='')}:{urllib.parse.quote(token, safe='')}"
    return f"http://{credentials}@{PROXY_HOST}:{PROXY_PORT}"


def normalize_domain(value: str) -> str:
    domain = value.strip().lower().rstrip(".")
    if not domain or len(domain) > 253 or any(character in domain for character in "/*@:"):
        raise base.WorkerError(f"Invalid network host: {value}")
    if "." not in domain:
        raise base.WorkerError(f"Approved host must be a public DNS hostname: {value}")
    return domain.encode("idna").decode("ascii")


def sanitized_environment() -> dict[str, str]:
    allowed = ("PATH", "HOME", "LANG", "LC_ALL", "TZ", "TMPDIR", "CI", "NODE_ENV", "PNPM_HOME", "COREPACK_HOME")
    environment = {key: os.environ[key] for key in allowed if key in os.environ}
    environment.setdefault("CI", "true")
    environment.setdefault("NODE_ENV", "test")
    environment["GIT_TERMINAL_PROMPT"] = "0"
    return environment


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
