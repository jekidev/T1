#!/usr/bin/env python3
"""Forward proxy used as the only coding-agent egress path.

Deploy the worker on an internal Docker network with this proxy as the only dual-homed
service. A provider process authenticates with a per-run nonce. Model API hosts are
allowed so the LLM can function, while arbitrary browsing is denied unless the user
approved a domain or selected the explicit Ultra mode.
"""

from __future__ import annotations

import base64
import hashlib
import ipaddress
import json
import os
import select
import socket
import socketserver
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

HOST = os.getenv("NETWORK_GATE_HOST", "0.0.0.0")
PORT = int(os.getenv("NETWORK_GATE_PORT", "8888"))
POLICY_ROOT = Path(os.getenv("NETWORK_GATE_POLICY_ROOT", "/network-policies")).resolve()
INFRA_TOKEN = os.getenv("NETWORK_GATE_INFRA_TOKEN", "")
MODEL_DOMAINS = {
    value.strip().lower()
    for value in os.getenv(
        "NETWORK_GATE_MODEL_DOMAINS",
        "openrouter.ai,api.openai.com,api.anthropic.com,api.deepseek.com,generativelanguage.googleapis.com",
    ).split(",")
    if value.strip()
}
INFRA_DOMAINS = {
    value.strip().lower()
    for value in os.getenv(
        "NETWORK_GATE_INFRA_DOMAINS",
        "github.com,api.github.com,objects.githubusercontent.com,raw.githubusercontent.com,codeload.github.com",
    ).split(",")
    if value.strip()
}
MAX_HEADER_BYTES = 64 * 1024
CONNECT_TIMEOUT = 20
IDLE_TIMEOUT = 120


class ThreadingProxy(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


class ProxyHandler(socketserver.StreamRequestHandler):
    def handle(self) -> None:
        self.connection.settimeout(IDLE_TIMEOUT)
        try:
            request_line = self.rfile.readline(MAX_HEADER_BYTES).decode("iso-8859-1").strip()
            if not request_line:
                return
            parts = request_line.split(" ", 2)
            if len(parts) != 3:
                return self.error(400, "Malformed proxy request")
            method, target, version = parts
            headers = read_headers(self.rfile)
            identity, policy = authenticate(headers.get("proxy-authorization", ""))
            host, port, scheme, path = parse_target(method, target, headers)
            allowed, reason = domain_allowed(identity, policy, host)
            if not allowed:
                record_denial(identity, policy, host, reason)
                return self.error(403, f"Network access requires user approval for {host}")
            addresses = safe_addresses(host, port)
            if method.upper() == "CONNECT":
                return self.tunnel(addresses, host, port)
            return self.forward(method, version, scheme, path, host, port, headers, addresses)
        except (ConnectionError, OSError, ValueError, TimeoutError) as error:
            try:
                self.error(502, f"Proxy connection failed: {type(error).__name__}")
            except OSError:
                pass

    def tunnel(self, addresses: list[tuple[Any, ...]], host: str, port: int) -> None:
        upstream = connect_any(addresses, CONNECT_TIMEOUT)
        try:
            self.wfile.write(b"HTTP/1.1 200 Connection Established\r\nProxy-Agent: T1-Network-Gate\r\n\r\n")
            self.wfile.flush()
            relay(self.connection, upstream)
        finally:
            upstream.close()

    def forward(
        self,
        method: str,
        version: str,
        scheme: str,
        path: str,
        host: str,
        port: int,
        headers: dict[str, str],
        addresses: list[tuple[Any, ...]],
    ) -> None:
        upstream = connect_any(addresses, CONNECT_TIMEOUT)
        try:
            if scheme == "https":
                context = ssl.create_default_context()
                upstream = context.wrap_socket(upstream, server_hostname=host)
            outgoing = [f"{method} {path} {version}\r\n"]
            for name, value in headers.items():
                if name in {"proxy-authorization", "proxy-connection", "connection"}:
                    continue
                outgoing.append(f"{canonical_header(name)}: {value}\r\n")
            outgoing.append("Connection: close\r\n\r\n")
            upstream.sendall("".join(outgoing).encode("iso-8859-1"))
            content_length = int(headers.get("content-length", "0") or 0)
            remaining = content_length
            while remaining > 0:
                chunk = self.rfile.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                upstream.sendall(chunk)
                remaining -= len(chunk)
            while True:
                chunk = upstream.recv(64 * 1024)
                if not chunk:
                    break
                self.connection.sendall(chunk)
        finally:
            upstream.close()

    def error(self, status: int, message: str) -> None:
        body = json.dumps({"error": message}).encode("utf-8")
        response = (
            f"HTTP/1.1 {status} {status_text(status)}\r\n"
            "Content-Type: application/json\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Connection: close\r\n\r\n"
        ).encode("ascii") + body
        self.connection.sendall(response)


def read_headers(stream: Any) -> dict[str, str]:
    headers: dict[str, str] = {}
    total = 0
    while True:
        line = stream.readline(MAX_HEADER_BYTES)
        total += len(line)
        if total > MAX_HEADER_BYTES:
            raise ValueError("Headers too large")
        if line in {b"\r\n", b"\n", b""}:
            break
        text = line.decode("iso-8859-1").rstrip("\r\n")
        if ":" not in text:
            raise ValueError("Malformed header")
        name, value = text.split(":", 1)
        headers[name.strip().lower()] = value.strip()
    return headers


def authenticate(header: str) -> tuple[str, dict[str, Any]]:
    if not header.lower().startswith("basic "):
        raise ValueError("Proxy authentication required")
    try:
        decoded = base64.b64decode(header.split(" ", 1)[1]).decode("utf-8")
        identity, supplied = decoded.split(":", 1)
    except (ValueError, UnicodeDecodeError) as error:
        raise ValueError("Invalid proxy authentication") from error
    if identity == "infrastructure":
        if len(INFRA_TOKEN) < 24 or not secrets_equal(supplied, INFRA_TOKEN):
            raise ValueError("Invalid infrastructure proxy credential")
        return identity, {"mode": "infrastructure", "approvedDomains": sorted(INFRA_DOMAINS)}
    safe_identity = safe_id(identity)
    policy_path = POLICY_ROOT / f"{safe_identity}.json"
    try:
        policy = json.loads(policy_path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as error:
        raise ValueError("Unknown network policy") from error
    if not isinstance(policy, dict) or not secrets_equal(str(policy.get("nonce", "")), supplied):
        raise ValueError("Invalid run proxy credential")
    expires_at = float(policy.get("expiresAtEpoch", 0))
    if expires_at <= time.time():
        raise ValueError("Network policy expired")
    return safe_identity, policy


def parse_target(method: str, target: str, headers: dict[str, str]) -> tuple[str, int, str, str]:
    if method.upper() == "CONNECT":
        host, port = split_host_port(target, 443)
        return host, port, "https", "/"
    parsed = urllib.parse.urlsplit(target)
    if parsed.scheme not in {"http", "https"}:
        host_header = headers.get("host", "")
        host, port = split_host_port(host_header, 80)
        return host, port, "http", target or "/"
    if not parsed.hostname:
        raise ValueError("Proxy URL is missing a host")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = urllib.parse.urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
    return normalize_domain(parsed.hostname), port, parsed.scheme, path


def split_host_port(value: str, default_port: int) -> tuple[str, int]:
    if value.startswith("["):
        parsed = urllib.parse.urlsplit(f"scheme://{value}")
        if not parsed.hostname:
            raise ValueError("Invalid host")
        return normalize_domain(parsed.hostname), parsed.port or default_port
    host, separator, port_text = value.rpartition(":")
    if separator and port_text.isdigit():
        return normalize_domain(host), int(port_text)
    return normalize_domain(value), default_port


def domain_allowed(identity: str, policy: dict[str, Any], host: str) -> tuple[bool, str]:
    mode = str(policy.get("mode", "ask_first"))
    approved = {normalize_domain(str(value)) for value in policy.get("approvedDomains", []) if value}
    model = {normalize_domain(str(value)) for value in policy.get("modelProviderDomains", []) if value} | MODEL_DOMAINS
    if identity == "infrastructure":
        return matches_any(host, approved), "infrastructure allowlist"
    if matches_any(host, model):
        return True, "model transport"
    if mode == "ultra":
        return True, "user selected Ultra"
    if mode == "ask_first" and matches_any(host, approved):
        return True, "user approved domain"
    return False, "ask first approval required" if mode == "ask_first" else "offline mode"


def safe_addresses(host: str, port: int) -> list[tuple[Any, ...]]:
    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    safe: list[tuple[Any, ...]] = []
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            continue
        safe.append(address)
    if not safe:
        raise ValueError("Target resolved only to blocked private or special-use addresses")
    return safe


def connect_any(addresses: list[tuple[Any, ...]], timeout: int) -> socket.socket:
    last_error: OSError | None = None
    for family, socktype, proto, _, sockaddr in addresses:
        sock = socket.socket(family, socktype, proto)
        sock.settimeout(timeout)
        try:
            sock.connect(sockaddr)
            sock.settimeout(None)
            return sock
        except OSError as error:
            last_error = error
            sock.close()
    raise last_error or OSError("No usable target address")


def relay(client: socket.socket, upstream: socket.socket) -> None:
    sockets = [client, upstream]
    while True:
        readable, _, exceptional = select.select(sockets, [], sockets, IDLE_TIMEOUT)
        if exceptional or not readable:
            return
        for source in readable:
            data = source.recv(64 * 1024)
            if not data:
                return
            destination = upstream if source is client else client
            destination.sendall(data)


def record_denial(identity: str, policy: dict[str, Any], host: str, reason: str) -> None:
    pending = POLICY_ROOT / "pending"
    pending.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(f"{identity}:{host}".encode()).hexdigest()[:20]
    path = pending / f"{safe_id(identity)}-{digest}.json"
    payload = {
        "id": digest,
        "runId": identity,
        "domain": host,
        "reason": reason,
        "mode": policy.get("mode", "ask_first"),
        "requestedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def normalize_domain(value: str) -> str:
    domain = value.strip().lower().rstrip(".")
    if not domain or len(domain) > 253 or "/" in domain or "@" in domain:
        raise ValueError("Invalid domain")
    return domain.encode("idna").decode("ascii")


def matches_any(host: str, domains: set[str]) -> bool:
    return "*" in domains or any(host == domain or host.endswith(f".{domain}") for domain in domains)


def safe_id(value: str) -> str:
    safe = "".join(character if character.isalnum() or character in "._-" else "-" for character in value)[:180]
    if not safe or safe in {".", ".."}:
        raise ValueError("Invalid policy identity")
    return safe


def canonical_header(value: str) -> str:
    return "-".join(part.capitalize() for part in value.split("-"))


def secrets_equal(first: str, second: str) -> bool:
    import hmac

    return hmac.compare_digest(first.encode(), second.encode())


def status_text(status: int) -> str:
    return {
        400: "Bad Request",
        403: "Forbidden",
        407: "Proxy Authentication Required",
        502: "Bad Gateway",
    }.get(status, "Error")


def main() -> None:
    POLICY_ROOT.mkdir(parents=True, exist_ok=True)
    with ThreadingProxy((HOST, PORT), ProxyHandler) as server:
        print(json.dumps({"event": "network-gate.started", "host": HOST, "port": PORT}), flush=True)
        server.serve_forever(poll_interval=0.5)


if __name__ == "__main__":
    main()
