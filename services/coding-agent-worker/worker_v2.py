#!/usr/bin/env python3
"""Network-gated entrypoint for the coding-agent worker.

The worker container must be attached only to an internal Docker network. The
`network_gate.py` proxy is the sole dual-homed egress service. Every execute call
must carry a run-bound AgentNetworkAuthorization and returns a complete tool-egress
audit required by the TypeScript policy layer before publication.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import threading
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import worker as base

POLICY_ROOT = Path(os.getenv("NETWORK_GATE_POLICY_ROOT", "/network-policies")).resolve()
AUDIT_ROOT = POLICY_ROOT / "audit"
PENDING_ROOT = POLICY_ROOT / "pending"
PROXY_HOST = os.getenv("NETWORK_GATE_PROXY_HOST", "network-gate")
PROXY_PORT = int(os.getenv("NETWORK_GATE_PROXY_PORT", "8888"))
INFRA_TOKEN = os.getenv("NETWORK_GATE_INFRA_TOKEN", "")
POLICY_TTL_SECONDS = int(os.getenv("NETWORK_GATE_POLICY_TTL_SECONDS", str(2 * 60 * 60)))
ALLOWED_CAPABILITIES = {"web_search", "web_fetch", "package_registry", "source_docs", "issue_tracker"}
_thread_state = threading.local()
_original_execute = base.execute
_original_review = base.review_patch
_original_publish = base.publish
_original_build_prompt = base.build_provider_prompt


def execute(provider: str, payload: dict[str, Any]) -> dict[str, Any]:
    context = base.parse_run_context(provider, payload)
    authorization = require_network_authorization(payload)
    nonce = secrets.token_urlsafe(32)
    clear_run_network_records(context.run_id)
    write_policy(context.run_id, authorization, nonce)
    _thread_state.context = context
    _thread_state.network_nonce = nonce
    _thread_state.network_authorization = authorization
    try:
        result = _original_execute(provider, payload)
        network_audit = build_network_audit(context.run_id, authorization)
        result["networkAudit"] = network_audit
        state = base.read_state(context.run_id)
        state["networkAuditSha256"] = canonical_hash(network_audit)
        state["networkAuthorizationSha256"] = canonical_hash(authorization)
        state["networkRequestCount"] = len(network_audit["requests"])
        base.atomic_write_json(base.state_path(context.run_id), state)
        return result
    finally:
        _thread_state.context = None
        _thread_state.network_nonce = None
        _thread_state.network_authorization = None


def review_patch(payload: dict[str, Any]) -> dict[str, Any]:
    result = _original_review(payload)
    task = base.require_dict(payload, "task")
    policy = require_task_network_policy(task)
    decision = result.get("decision")
    if isinstance(decision, dict):
        codes = decision.setdefault("codes", [])
        reasons = decision.setdefault("reasons", [])
        if policy["mode"] == "ultra":
            codes.append("review.network_ultra")
            reasons.append("The user explicitly selected Ultra. Review fetched sources, licenses and dependency changes before merge.")
            decision["risk"] = max_risk(str(decision.get("risk", "low")), "high")
            decision["requiresExternalReviewer"] = True
        elif policy["approvedHosts"] and policy["approvedCapabilities"]:
            codes.append("review.network_allowlisted")
            reasons.append("Tool egress was limited to run-bound hosts and capabilities approved before execution.")
            decision["risk"] = max_risk(str(decision.get("risk", "low")), "medium")
        else:
            codes.append("review.network_denied")
            reasons.append("Tool/browser internet access was denied for this run.")
    result.setdefault("notes", []).append(f"Requested network mode: {policy['mode']}.")
    return result


def publish(provider: str, payload: dict[str, Any]) -> dict[str, Any]:
    context = base.parse_run_context(provider, payload)
    run = base.require_dict(payload, "run")
    submitted_audit = base.require_dict(run, "networkAudit")
    state = base.read_state(context.run_id)
    stored_hash = str(state.get("networkAuditSha256", ""))
    if not stored_hash or canonical_hash(submitted_audit) != stored_hash:
        raise base.WorkerError("Network audit does not match the validated execution record.")
    authorization = require_task_authorization_for_publish(run)
    current_audit = build_network_audit(context.run_id, authorization)
    if canonical_hash(current_audit) != stored_hash:
        raise base.WorkerError("Network audit changed after validation; publication is refused.")
    return _original_publish(provider, payload)


def build_provider_prompt(context: base.RunContext) -> str:
    authorization = getattr(_thread_state, "network_authorization", None)
    if not isinstance(authorization, dict):
        raise base.WorkerError("Provider network authorization is unavailable.")
    mode = str(authorization["mode"])
    hosts = list(authorization["allowedHosts"])
    capabilities = list(authorization["allowedCapabilities"])
    policy_text = {
        "deny": "Tool/browser internet access is disabled. Do not attempt web search, URL fetches, package downloads, telemetry, or issue lookups. Model-provider transport is available only so this conversation can run.",
        "allowlisted": f"Tool/browser internet access is restricted by an external firewall to these hosts: {', '.join(hosts)}; capabilities: {', '.join(capabilities)}. Stop and report any additional need; do not attempt a bypass.",
        "ultra": "The user explicitly selected Ultra for this isolated run. Public HTTPS tool egress is permitted through the audited firewall. Private networks, cloud metadata, HTTP, unvalidated redirects, secrets and protected repository paths remain blocked. Record sources, versions and licenses.",
    }[mode]
    return _original_build_prompt(context) + "\n\n## Enforced network authorization\n- " + policy_text + "\n"


def provider_environment(provider: str) -> dict[str, str]:
    context = getattr(_thread_state, "context", None)
    nonce = getattr(_thread_state, "network_nonce", None)
    authorization = getattr(_thread_state, "network_authorization", None)
    if context is None or not nonce or not isinstance(authorization, dict):
        raise base.WorkerError("Provider network context is unavailable.")
    environment = sanitized_environment()
    allowed_prefixes = ("OPENAI_", "ANTHROPIC_", "OPENROUTER_", "DEEPSEEK_", "GOOGLE_", "GEMINI_", "AZURE_", "AWS_", "LITELLM_", "AIDER_", "OPENHANDS_")
    explicit = {"CODING_AGENT_AIDER_MODEL", "CODING_AGENT_OPENHANDS_MODEL", "CODING_AGENT_OPENHANDS_API_KEY", "CODING_AGENT_OPENHANDS_BASE_URL"}
    for key, value in os.environ.items():
        if key.startswith(allowed_prefixes) or key in explicit:
            environment[key] = value
    proxy = proxy_url(context.run_id, nonce)
    environment.update({
        "HTTP_PROXY": proxy, "HTTPS_PROXY": proxy, "ALL_PROXY": proxy,
        "http_proxy": proxy, "https_proxy": proxy, "all_proxy": proxy,
        "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost",
        "CODING_AGENT_PROVIDER": provider,
        "CODING_AGENT_NETWORK_MODE": str(authorization["mode"]),
        "CODING_AGENT_DISABLE_BUILTIN_WEB_TOOLS": "1",
        "DO_NOT_TRACK": "1",
    })
    return environment


def validation_environment() -> dict[str, str]:
    environment = sanitized_environment()
    environment.update({
        "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost",
        "HTTP_PROXY": "http://127.0.0.1:9", "HTTPS_PROXY": "http://127.0.0.1:9", "ALL_PROXY": "http://127.0.0.1:9",
        "http_proxy": "http://127.0.0.1:9", "https_proxy": "http://127.0.0.1:9", "all_proxy": "http://127.0.0.1:9",
        "DO_NOT_TRACK": "1",
    })
    return environment


def git_environment() -> dict[str, str]:
    if len(INFRA_TOKEN) < 24:
        raise base.WorkerError("NETWORK_GATE_INFRA_TOKEN must contain at least 24 characters.")
    environment = sanitized_environment()
    proxy = proxy_url("infrastructure", INFRA_TOKEN)
    environment.update({
        "HTTP_PROXY": proxy, "HTTPS_PROXY": proxy, "ALL_PROXY": proxy,
        "http_proxy": proxy, "https_proxy": proxy, "all_proxy": proxy,
        "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost",
        "GIT_TERMINAL_PROMPT": "0",
    })
    github_token = base.github_token(optional=True)
    if github_token:
        askpass = base.ROOT / ".git-askpass.sh"
        if not askpass.exists():
            askpass.write_text("#!/bin/sh\ncase \"$1\" in *Username*) printf '%s\\n' 'x-access-token' ;; *) printf '%s\\n' \"$CODING_AGENT_GIT_TOKEN\" ;; esac\n", encoding="utf-8")
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


def require_network_authorization(payload: dict[str, Any]) -> dict[str, Any]:
    value = base.require_dict(payload, "networkAuthorization")
    mode = str(value.get("mode", ""))
    if mode not in {"deny", "allowlisted", "ultra"}:
        raise base.WorkerError("networkAuthorization.mode must be deny, allowlisted or ultra.")
    hosts = normalize_hosts(value.get("allowedHosts", []))
    capabilities = normalize_capabilities(value.get("allowedCapabilities", []))
    for required in ("requireHttps", "blockPrivateNetworks", "rejectRedirectsUntilRevalidated", "auditRequired"):
        if value.get(required) is not True:
            raise base.WorkerError(f"networkAuthorization.{required} must be true.")
    expires_at = require_future_datetime(value.get("expiresAt"))
    if mode == "deny" and (hosts or capabilities):
        raise base.WorkerError("Deny authorization cannot contain hosts or capabilities.")
    if mode == "allowlisted" and (not hosts or not capabilities):
        raise base.WorkerError("Allowlisted authorization requires hosts and capabilities.")
    if mode == "ultra" and hosts:
        raise base.WorkerError("Ultra must not contain a separate host allowlist.")
    return {"mode": mode, "allowedHosts": hosts, "allowedCapabilities": capabilities, "requireHttps": True, "blockPrivateNetworks": True, "rejectRedirectsUntilRevalidated": True, "auditRequired": True, "expiresAt": expires_at.isoformat().replace("+00:00", "Z")}


def require_task_network_policy(task: dict[str, Any]) -> dict[str, Any]:
    value = task.get("networkPolicy", {})
    if not isinstance(value, dict):
        raise base.WorkerError("task.networkPolicy must be an object.")
    mode = str(value.get("mode", "ask_first"))
    if mode not in {"ask_first", "ultra"}:
        raise base.WorkerError("Unknown task network mode.")
    return {"mode": mode, "approvedHosts": normalize_hosts(value.get("approvedHosts", [])), "approvedCapabilities": normalize_capabilities(value.get("approvedCapabilities", []))}


def require_task_authorization_for_publish(run: dict[str, Any]) -> dict[str, Any]:
    task = base.require_dict(run, "task")
    policy = require_task_network_policy(task)
    audit = base.require_dict(run, "networkAudit")
    expected = "ultra" if policy["mode"] == "ultra" else ("allowlisted" if policy["approvedHosts"] and policy["approvedCapabilities"] else "deny")
    if str(audit.get("mode", "")) != expected:
        raise base.WorkerError("Published network audit mode does not match the task policy.")
    return {"mode": expected, "allowedHosts": policy["approvedHosts"] if expected == "allowlisted" else [], "allowedCapabilities": policy["approvedCapabilities"] if expected == "allowlisted" else sorted(ALLOWED_CAPABILITIES) if expected == "ultra" else [], "requireHttps": True, "blockPrivateNetworks": True, "rejectRedirectsUntilRevalidated": True, "auditRequired": True, "expiresAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}


def write_policy(run_id: str, authorization: dict[str, Any], nonce: str) -> None:
    POLICY_ROOT.mkdir(parents=True, exist_ok=True)
    expiry_epoch = min(parse_datetime(str(authorization["expiresAt"])).timestamp(), time.time() + POLICY_TTL_SECONDS)
    payload = {"runId": run_id, "nonce": nonce, "mode": authorization["mode"], "allowedHosts": authorization["allowedHosts"], "allowedCapabilities": authorization["allowedCapabilities"], "requireHttps": True, "blockPrivateNetworks": True, "rejectRedirectsUntilRevalidated": True, "modelProviderDomains": model_domains(), "createdAt": base.now_iso(), "expiresAtEpoch": expiry_epoch}
    base.atomic_write_json(POLICY_ROOT / f"{base.safe_id(run_id)}.json", payload)


def build_network_audit(run_id: str, authorization: dict[str, Any]) -> dict[str, Any]:
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
            capability = str(value.get("capability", "web_fetch"))
            if capability not in ALLOWED_CAPABILITIES:
                continue
            method = str(value.get("method", "GET"))
            if method not in {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"}:
                method = "GET"
            requests.append({"at": str(value.get("at", base.now_iso())), "capability": capability, "method": method, "origin": str(value.get("origin", "https://invalid.example")), "path": str(value.get("path", "/"))[:1000] or "/", "allowed": bool(value.get("allowed", False)), "reason": str(value.get("reason", "Network gate decision"))[:2000]})
            if len(requests) >= 10_000:
                break
    return {"mode": authorization["mode"], "enforcement": "sandbox_firewall", "requests": requests, "privateNetworkBlocked": True, "metadataEndpointsBlocked": True, "redirectsRevalidated": True}


def clear_run_network_records(run_id: str) -> None:
    prefix = f"{base.safe_id(run_id)}-"
    for root in (AUDIT_ROOT, PENDING_ROOT):
        if root.is_dir():
            for path in root.glob(f"{prefix}*.json"):
                try:
                    path.unlink()
                except FileNotFoundError:
                    pass


def model_domains() -> list[str]:
    raw = os.getenv("NETWORK_GATE_MODEL_DOMAINS", "openrouter.ai,api.openai.com,api.anthropic.com,api.deepseek.com,generativelanguage.googleapis.com")
    return sorted({domain for value in raw.split(",") if (domain := normalize_host(value))})


def proxy_url(identity: str, token: str) -> str:
    credentials = f"{urllib.parse.quote(identity, safe='')}:{urllib.parse.quote(token, safe='')}"
    return f"http://{credentials}@{PROXY_HOST}:{PROXY_PORT}"


def normalize_hosts(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise base.WorkerError("Network hosts must be a string array.")
    output: list[str] = []
    for item in value:
        host = normalize_host(item)
        if not host:
            raise base.WorkerError(f"Invalid public network host: {item}")
        if host not in output:
            output.append(host)
    return sorted(output)


def normalize_capabilities(value: Any) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise base.WorkerError("Network capabilities must be a string array.")
    output = sorted(set(value))
    if any(item not in ALLOWED_CAPABILITIES for item in output):
        raise base.WorkerError("Unsupported network capability.")
    return output


def normalize_host(value: str) -> str | None:
    host = value.strip().lower().rstrip(".")
    if not host or len(host) > 253 or any(character in host for character in "/*@:"):
        return None
    if "." not in host or not all(character.isalnum() or character in ".-" for character in host):
        return None
    return host.encode("idna").decode("ascii")


def require_future_datetime(value: Any) -> datetime:
    if not isinstance(value, str):
        raise base.WorkerError("Network authorization expiry is required.")
    parsed = parse_datetime(value)
    if parsed.timestamp() <= time.time():
        raise base.WorkerError("Network authorization expired before execution.")
    return parsed


def parse_datetime(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise base.WorkerError("Invalid network authorization datetime.") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def canonical_hash(value: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()


def max_risk(first: str, second: str) -> str:
    order = ["low", "medium", "high", "critical"]
    return first if order.index(first) >= order.index(second) else second


base.execute = execute
base.review_patch = review_patch
base.publish = publish
base.build_provider_prompt = build_provider_prompt
base.provider_environment = provider_environment
base.validation_environment = validation_environment
base.git_environment = git_environment

if __name__ == "__main__":
    base.main()
