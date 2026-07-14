import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { recordObservabilityEvent } from "./observability";

export type NetworkAccessMode = "ask_first" | "ultra";
export type NetworkCapability =
  | "web_search"
  | "web_fetch"
  | "huggingface_import"
  | "public_domain_import"
  | "agent_network";

export interface NetworkAccessSession {
  id: string;
  mode: NetworkAccessMode;
  createdAt: string;
  expiresAt: string;
}

export interface ResolvedPublicAddress {
  address: string;
  family: 4 | 6;
}

export interface NetworkApprovalRequest {
  id: string;
  sessionId: string;
  capability: NetworkCapability;
  targetOrigin: string;
  targetPath: string;
  reason: string;
  status: "pending" | "approved" | "denied" | "consumed";
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
}

interface InternalSession extends NetworkAccessSession {
  secret: string;
}

export class NetworkApprovalRequiredError extends Error {
  readonly approval: NetworkApprovalRequest;
  constructor(approval: NetworkApprovalRequest) {
    super("Explicit network approval is required before this request can leave the server.");
    this.name = "NetworkApprovalRequiredError";
    this.approval = approval;
  }
}

const sessions = new Map<string, InternalSession>();
const approvals = new Map<string, NetworkApprovalRequest>();
const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
const APPROVAL_TTL_MS = 15 * 60 * 1000;

export function createNetworkSession(input: {
  mode?: NetworkAccessMode;
  ttlMinutes?: number;
}): { session: NetworkAccessSession; token: string } {
  purgeExpired();
  const now = Date.now();
  const ttl = Math.min(SESSION_MAX_MS, Math.max(5 * 60 * 1000, Math.trunc((input.ttlMinutes ?? 120) * 60 * 1000)));
  const token = randomBytes(32).toString("base64url");
  const session: InternalSession = {
    id: `network-${randomUUID()}`,
    mode: input.mode ?? "ask_first",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    secret: token,
  };
  sessions.set(session.id, session);
  audit("network.session.created", session, { mode: session.mode });
  return { session: publicSession(session), token };
}

export function updateNetworkSession(input: {
  sessionId: string;
  token: string;
  mode: NetworkAccessMode;
}): NetworkAccessSession {
  const session = requireSession(input.sessionId, input.token);
  session.mode = input.mode;
  audit("network.session.mode_changed", session, { mode: input.mode });
  return publicSession(session);
}

export function getNetworkSession(sessionId: string, token: string): NetworkAccessSession {
  return publicSession(requireSession(sessionId, token));
}

export function listNetworkApprovals(sessionId: string, token: string): NetworkApprovalRequest[] {
  requireSession(sessionId, token);
  purgeExpired();
  return [...approvals.values()]
    .filter(approval => approval.sessionId === sessionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(approval => ({ ...approval }));
}

export function decideNetworkApproval(input: {
  sessionId: string;
  token: string;
  approvalId: string;
  decision: "approved" | "denied";
}): NetworkApprovalRequest {
  const session = requireSession(input.sessionId, input.token);
  const approval = approvals.get(input.approvalId);
  if (!approval || approval.sessionId !== session.id) throw new Error("Network approval request was not found.");
  if (approval.status !== "pending") throw new Error(`Network approval is already ${approval.status}.`);
  if (Date.parse(approval.expiresAt) <= Date.now()) throw new Error("Network approval request expired.");
  approval.status = input.decision;
  approval.decidedAt = new Date().toISOString();
  audit(`network.approval.${input.decision}`, session, {
    approvalId: approval.id,
    capability: approval.capability,
    targetOrigin: approval.targetOrigin,
  });
  return { ...approval };
}

export async function requireNetworkAccess(input: {
  sessionId: string;
  token: string;
  capability: NetworkCapability;
  targetUrl: string;
  reason: string;
}): Promise<{ session: NetworkAccessSession; url: URL; mode: NetworkAccessMode; resolvedAddresses: ResolvedPublicAddress[] }> {
  const session = requireSession(input.sessionId, input.token);
  const url = validatePublicHttpsUrl(input.targetUrl);
  const reason = input.reason.trim().slice(0, 500);
  if (!reason) throw new Error("A concrete reason is required for internet access.");

  if (session.mode === "ultra") {
    const resolvedAddresses = await resolvePublicAddresses(url.hostname);
    audit("network.request.auto_approved", session, {
      capability: input.capability,
      targetOrigin: url.origin,
      targetPath: truncatePath(url.pathname),
      mode: "ultra",
      resolvedAddressCount: resolvedAddresses.length,
    });
    return { session: publicSession(session), url, mode: session.mode, resolvedAddresses };
  }

  const approved = [...approvals.values()].find(approval =>
    approval.sessionId === session.id
    && approval.status === "approved"
    && approval.capability === input.capability
    && approval.targetOrigin === url.origin
    && approval.targetPath === truncatePath(url.pathname)
    && Date.parse(approval.expiresAt) > Date.now(),
  );
  if (approved) {
    const resolvedAddresses = await resolvePublicAddresses(url.hostname);
    approved.status = "consumed";
    approved.decidedAt = new Date().toISOString();
    audit("network.approval.consumed", session, {
      approvalId: approved.id,
      capability: input.capability,
      targetOrigin: url.origin,
      resolvedAddressCount: resolvedAddresses.length,
    });
    return { session: publicSession(session), url, mode: session.mode, resolvedAddresses };
  }

  const existing = [...approvals.values()].find(approval =>
    approval.sessionId === session.id
    && approval.status === "pending"
    && approval.capability === input.capability
    && approval.targetOrigin === url.origin
    && approval.targetPath === truncatePath(url.pathname)
    && Date.parse(approval.expiresAt) > Date.now(),
  );
  if (existing) throw new NetworkApprovalRequiredError({ ...existing });

  const now = Date.now();
  const approval: NetworkApprovalRequest = {
    id: `approval-${randomUUID()}`,
    sessionId: session.id,
    capability: input.capability,
    targetOrigin: url.origin,
    targetPath: truncatePath(url.pathname),
    reason,
    status: "pending",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + APPROVAL_TTL_MS).toISOString(),
  };
  approvals.set(approval.id, approval);
  audit("network.approval.requested", session, {
    approvalId: approval.id,
    capability: approval.capability,
    targetOrigin: approval.targetOrigin,
    targetPath: approval.targetPath,
  });
  throw new NetworkApprovalRequiredError({ ...approval });
}

export function validatePublicHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Internet access is restricted to HTTPS.");
  if (url.username || url.password) throw new Error("Credentials are not allowed in internet URLs.");
  if (url.port && url.port !== "443") throw new Error("Non-standard internet ports are not allowed.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local network targets are blocked.");
  }
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal" || hostname === "100.100.100.200") {
    throw new Error("Cloud metadata targets are blocked.");
  }
  if (isIP(hostname) && isPrivateIp(hostname)) throw new Error("Private and link-local IP targets are blocked.");
  url.hash = "";
  return url;
}

export async function resolvePublicAddresses(hostnameInput: string): Promise<ResolvedPublicAddress[]> {
  const hostname = hostnameInput.toLowerCase().replace(/\.$/, "");
  const directFamily = isIP(hostname);
  const resolved = directFamily
    ? [{ address: hostname, family: directFamily as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (resolved.length === 0) throw new Error("Internet hostname did not resolve to an address.");
  const unique = [...new Map(resolved.map(item => [item.address, { address: item.address, family: item.family as 4 | 6 }])).values()]
    .sort((a, b) => a.family - b.family || a.address.localeCompare(b.address));
  if (unique.some(item => isPrivateIp(item.address))) {
    throw new Error("Internet hostname resolves to a private, link-local, multicast or metadata address.");
  }
  return unique;
}

function requireSession(sessionId: string, token: string): InternalSession {
  purgeExpired();
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Network access session is missing or expired.");
  const expected = Buffer.from(session.secret);
  const supplied = Buffer.from(token);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error("Invalid network access session token.");
  }
  return session;
}

function purgeExpired(): void {
  const now = Date.now();
  for (const [id, session] of sessions) if (Date.parse(session.expiresAt) <= now) sessions.delete(id);
  for (const [id, approval] of approvals) if (Date.parse(approval.expiresAt) <= now) approvals.delete(id);
}

function publicSession(session: InternalSession): NetworkAccessSession {
  return { id: session.id, mode: session.mode, createdAt: session.createdAt, expiresAt: session.expiresAt };
}

function truncatePath(pathname: string): string {
  return pathname.slice(0, 500) || "/";
}

function isPrivateIp(hostname: string): boolean {
  if (hostname.includes(":")) {
    const normalized = hostname.toLowerCase();
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:")
      || normalized.startsWith("ff");
  }
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 10
    || a === 127
    || a === 0
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || a >= 224;
}

function audit(type: string, session: NetworkAccessSession, data: Record<string, unknown>): void {
  recordObservabilityEvent({
    source: "system",
    level: "info",
    type,
    message: `${type} for ${session.id}`,
    data: { sessionId: session.id, ...data },
  });
}
