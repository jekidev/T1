export type AgentNetworkMode = "offline" | "ask_first" | "ultra";

export interface AgentNetworkPolicy {
  mode: AgentNetworkMode;
  approvedDomains: string[];
  modelProviderDomains: string[];
  requiresPerDomainApproval: boolean;
}

const MODE_LABELS: Record<AgentNetworkMode, string> = {
  offline: "network-offline",
  ask_first: "network-ask-first",
  ultra: "network-ultra-confirmed",
};

const DEFAULT_MODEL_PROVIDER_DOMAINS = [
  "openrouter.ai",
  "api.openai.com",
  "api.anthropic.com",
  "api.deepseek.com",
  "generativelanguage.googleapis.com",
] as const;

export function networkModeFromLabels(labels: readonly string[]): AgentNetworkMode {
  if (labels.includes(MODE_LABELS.ultra)) return "ultra";
  if (labels.includes(MODE_LABELS.offline)) return "offline";
  return "ask_first";
}

export function approvedNetworkDomainsFromLabels(labels: readonly string[]): string[] {
  const domains = labels
    .filter(label => label.startsWith("network-domain:"))
    .map(label => normalizeDomain(label.slice("network-domain:".length)))
    .filter((value): value is string => Boolean(value));
  return [...new Set(domains)].sort();
}

export function resolveAgentNetworkPolicy(labels: readonly string[]): AgentNetworkPolicy {
  const mode = networkModeFromLabels(labels);
  return {
    mode,
    approvedDomains: mode === "ultra" ? ["*"] : approvedNetworkDomainsFromLabels(labels),
    modelProviderDomains: [...DEFAULT_MODEL_PROVIDER_DOMAINS],
    requiresPerDomainApproval: mode === "ask_first",
  };
}

export function networkPolicyLabels(input: {
  mode: AgentNetworkMode;
  approvedDomains?: readonly string[];
}): string[] {
  const labels = [MODE_LABELS[input.mode]];
  if (input.mode === "ask_first") {
    for (const domain of input.approvedDomains ?? []) {
      const normalized = normalizeDomain(domain);
      if (normalized) labels.push(`network-domain:${normalized}`);
    }
  }
  return [...new Set(labels)];
}

export function isNetworkDomainAllowed(policy: AgentNetworkPolicy, domainInput: string, purpose: "model" | "agent"): boolean {
  const domain = normalizeDomain(domainInput);
  if (!domain) return false;
  if (purpose === "model" && policy.modelProviderDomains.some(allowed => domainMatches(domain, allowed))) return true;
  if (policy.mode === "ultra") return true;
  if (policy.mode === "offline") return false;
  return policy.approvedDomains.some(allowed => domainMatches(domain, allowed));
}

export function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0] ?? "";
  if (!trimmed || trimmed.length > 253) return null;
  if (trimmed === "localhost" || trimmed === "127.0.0.1" || trimmed === "::1") return trimmed;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(trimmed)) return null;
  return trimmed;
}

function domainMatches(domain: string, allowed: string): boolean {
  if (allowed === "*") return true;
  return domain === allowed || domain.endsWith(`.${allowed}`);
}
