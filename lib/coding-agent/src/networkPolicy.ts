import {
  AgentNetworkAuditSchema,
  AgentNetworkAuthorizationSchema,
  AgentNetworkPolicySchema,
  type AgentNetworkAudit,
  type AgentNetworkAuthorization,
  type AgentNetworkCapability,
  type AgentNetworkPolicy,
  type AgentTask,
  type PolicyDecision,
} from "./types";

const ALL_CAPABILITIES: AgentNetworkCapability[] = [
  "web_search",
  "web_fetch",
  "package_registry",
  "source_docs",
  "issue_tracker",
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
  "100.100.100.200",
]);

export function resolveAgentNetworkPolicy(task: AgentTask): AgentNetworkPolicy {
  return AgentNetworkPolicySchema.parse(task.networkPolicy);
}

export function buildAgentNetworkAuthorization(task: AgentTask, now = new Date()): AgentNetworkAuthorization {
  const policy = resolveAgentNetworkPolicy(task);
  const expiresAt = new Date(now.getTime() + task.limits.maxRuntimeMinutes * 60_000).toISOString();
  const approvedHosts = normalizeApprovedHosts(policy.approvedHosts);
  const approvedCapabilities = [...new Set(policy.approvedCapabilities)].sort();

  if (policy.mode === "ask_first") {
    return AgentNetworkAuthorizationSchema.parse({
      mode: approvedHosts.length > 0 && approvedCapabilities.length > 0 ? "allowlisted" : "deny",
      allowedHosts: approvedHosts,
      allowedCapabilities: approvedCapabilities,
      requireHttps: true,
      blockPrivateNetworks: true,
      rejectRedirectsUntilRevalidated: true,
      auditRequired: true,
      expiresAt,
    });
  }

  if (!policy.approvedBy || !policy.approvedAt) {
    throw new Error("Ultra network mode requires explicit approvedBy and approvedAt fields.");
  }
  if (Date.parse(policy.approvedAt) > now.getTime() + 60_000) {
    throw new Error("Ultra network approval timestamp cannot be in the future.");
  }
  return AgentNetworkAuthorizationSchema.parse({
    mode: "ultra",
    allowedHosts: [],
    allowedCapabilities: ALL_CAPABILITIES,
    requireHttps: true,
    blockPrivateNetworks: true,
    rejectRedirectsUntilRevalidated: true,
    auditRequired: true,
    expiresAt,
  });
}

export function evaluateAgentNetworkPolicy(task: AgentTask): PolicyDecision {
  const policy = resolveAgentNetworkPolicy(task);
  const codes: string[] = [];
  const reasons: string[] = [];
  let risk: PolicyDecision["risk"] = "low";
  let accepted = true;

  let hosts: string[] = [];
  try {
    hosts = normalizeApprovedHosts(policy.approvedHosts);
  } catch (error) {
    accepted = false;
    risk = "critical";
    codes.push("network.invalid_host");
    reasons.push(error instanceof Error ? error.message : String(error));
  }

  if (policy.mode === "ask_first") {
    codes.push("network.ask_first");
    if (hosts.length === 0 || policy.approvedCapabilities.length === 0) {
      reasons.push("Agent internet access is disabled. Ask First requires explicit host and capability approval before the run is created.");
    } else {
      reasons.push(`Agent internet access is restricted to ${hosts.join(", ")} for: ${policy.approvedCapabilities.join(", ")}.`);
      risk = "medium";
    }
  } else {
    codes.push("network.ultra_confirmed");
    if (!policy.approvedBy || !policy.approvedAt) {
      accepted = false;
      risk = "critical";
      codes.push("network.ultra_approval_missing");
      reasons.push("Ultra requires an explicit user identity and approval timestamp.");
    } else {
      risk = "high";
      reasons.push("Ultra permits public HTTPS internet access for this isolated run, while private networks, metadata endpoints and unvalidated redirects remain blocked.");
    }
  }

  if (policy.approvedHosts.some(host => host.includes("*"))) {
    accepted = false;
    risk = "critical";
    codes.push("network.wildcard_forbidden");
    reasons.push("Wildcard hosts are forbidden. Ultra is the only mode that can authorize all public HTTPS origins.");
  }

  return {
    accepted,
    risk,
    codes,
    reasons,
    requiresHumanReview: true,
    requiresExternalReviewer: policy.mode === "ultra",
  };
}

export function validateAgentNetworkAudit(input: {
  authorization: AgentNetworkAuthorization;
  audit: AgentNetworkAudit;
}): PolicyDecision {
  const authorization = AgentNetworkAuthorizationSchema.parse(input.authorization);
  const audit = AgentNetworkAuditSchema.parse(input.audit);
  const codes: string[] = [];
  const reasons: string[] = [];
  let risk: PolicyDecision["risk"] = authorization.mode === "ultra" ? "high" : authorization.mode === "allowlisted" ? "medium" : "low";

  if (audit.mode !== authorization.mode) {
    codes.push("network.audit_mode_mismatch");
    reasons.push(`Sandbox reported ${audit.mode}, expected ${authorization.mode}.`);
    risk = "critical";
  }
  if (!audit.privateNetworkBlocked || !audit.metadataEndpointsBlocked || !audit.redirectsRevalidated) {
    codes.push("network.firewall_proof_missing");
    reasons.push("Sandbox did not prove private-network blocking, metadata blocking and redirect revalidation.");
    risk = "critical";
  }

  for (const request of audit.requests) {
    const url = new URL(request.origin);
    const host = normalizePublicHost(url.hostname);
    if (url.protocol !== "https:") {
      codes.push("network.non_https_request");
      reasons.push(`Non-HTTPS request recorded for ${request.origin}.`);
      risk = "critical";
    }
    if (!request.allowed) continue;
    if (authorization.mode === "deny") {
      codes.push("network.request_while_denied");
      reasons.push(`Sandbox allowed ${request.capability} to ${host} while network mode was deny.`);
      risk = "critical";
    }
    if (authorization.mode === "allowlisted") {
      if (!authorization.allowedCapabilities.includes(request.capability)) {
        codes.push("network.capability_not_approved");
        reasons.push(`Sandbox used unapproved capability ${request.capability}.`);
        risk = "critical";
      }
      if (!authorization.allowedHosts.some(allowed => hostMatches(host, allowed))) {
        codes.push("network.host_not_approved");
        reasons.push(`Sandbox accessed unapproved host ${host}.`);
        risk = "critical";
      }
    }
  }

  return {
    accepted: codes.length === 0,
    risk,
    codes,
    reasons: reasons.length > 0 ? [...new Set(reasons)] : ["Sandbox network audit matches the explicit run authorization."],
    requiresHumanReview: true,
    requiresExternalReviewer: authorization.mode === "ultra",
  };
}

export function normalizeApprovedHosts(hosts: readonly string[]): string[] {
  return [...new Set(hosts.map(normalizePublicHost))].sort();
}

export function normalizePublicHost(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw || raw.includes("*") || raw.includes("/") || raw.includes("@") || raw.includes(":")) {
    throw new Error(`Invalid approved network host: ${value}`);
  }
  const host = raw.replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw new Error(`Private, local or metadata host is forbidden: ${value}`);
  }
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    throw new Error(`Approved host must be a public DNS hostname: ${value}`);
  }
  return host;
}

function hostMatches(host: string, allowed: string): boolean {
  return host === allowed || host.endsWith(`.${allowed}`);
}

function isPrivateIpv4(value: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return false;
  const octets = value.split(".").map(Number);
  if (octets.some(octet => octet < 0 || octet > 255)) return true;
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateIpv6(value: string): boolean {
  const normalized = value.replace(/^\[|\]$/g, "");
  return normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe80:");
}
