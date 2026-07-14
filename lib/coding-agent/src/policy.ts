import {
  AgentTaskSchema,
  RepositoryMapSchema,
  type AgentPatch,
  type AgentTask,
  type PolicyDecision,
  type RepositoryMap,
} from "./types";
import { evaluateAgentNetworkPolicy } from "./networkPolicy";

export const DEFAULT_PROTECTED_PATHS = [
  ".env",
  ".env.",
  "secrets/",
  "credentials/",
  "authentication/",
  "authorization/",
  "billing/",
  "payment/",
  "deployment/",
  "infrastructure/",
  ".github/workflows/",
  ".github/CODEOWNERS",
  "migrations/production/",
  "sandbox/security/",
  "agent-policies/",
  "audit/",
] as const;

export const SELF_MODIFICATION_PATHS = [
  "lib/coding-agent/",
  "src/coding-agent/",
  "services/coding-agent-worker/",
] as const;

export const POLICY_VALIDATOR_PATHS = [
  "lib/coding-agent/src/policy.ts",
  "lib/coding-agent/src/networkPolicy.ts",
  "lib/coding-agent/src/patchValidator.ts",
  "src/coding-agent/validation/PolicyValidator.ts",
] as const;

export function expectedAgentBranch(task: AgentTask): string {
  const parsed = AgentTaskSchema.parse(task);
  return `agent/${parsed.requestedAdapter}/${safeBranchSegment(parsed.id)}`;
}

export function evaluateTaskPolicy(taskInput: AgentTask, mapInput: RepositoryMap): PolicyDecision {
  const task = AgentTaskSchema.parse(taskInput);
  const map = RepositoryMapSchema.parse(mapInput);
  const codes: string[] = [];
  const reasons: string[] = [];
  let risk: PolicyDecision["risk"] = "low";

  if (["main", "master", "production", "prod"].includes(task.baseBranch.toLowerCase()) && task.labels.includes("direct-write")) {
    codes.push("branch.direct_write_forbidden");
    reasons.push("The agent may branch from a protected default branch but may not write directly to it.");
    risk = "critical";
  }

  const invalidAllowedPaths = task.allowedPaths.filter(path => isProtectedPath(path, map.protectedPaths));
  if (invalidAllowedPaths.length > 0) {
    codes.push("paths.protected_requested");
    reasons.push(`Task requested protected paths: ${invalidAllowedPaths.join(", ")}`);
    risk = "critical";
  }

  const selfModification = task.allowedPaths.some(path => SELF_MODIFICATION_PATHS.some(prefix => normalizeRepoPath(path).startsWith(prefix)));
  if (selfModification) {
    codes.push("self_modification.review_required");
    reasons.push("Coding-agent source modifications require an external reviewer and cannot auto-merge.");
    risk = maxRisk(risk, "high");
  }

  if (task.signal === "explicit_user_request") {
    codes.push("signal.explicit_user_request");
    reasons.push("The task has a valid concrete self-improvement signal from the user.");
  }

  const networkDecision = evaluateAgentNetworkPolicy(task);
  codes.push(...networkDecision.codes);
  reasons.push(...networkDecision.reasons);
  risk = maxRisk(risk, networkDecision.risk);

  const accepted = networkDecision.accepted && !codes.some(code => [
    "paths.protected_requested",
    "branch.direct_write_forbidden",
  ].includes(code));
  return {
    accepted,
    risk,
    codes: [...new Set(codes)],
    reasons: [...new Set(reasons)],
    requiresHumanReview: true,
    requiresExternalReviewer: selfModification || networkDecision.requiresExternalReviewer,
  };
}

export function evaluatePatchPaths(taskInput: AgentTask, mapInput: RepositoryMap, patch: AgentPatch): PolicyDecision {
  const task = AgentTaskSchema.parse(taskInput);
  const map = RepositoryMapSchema.parse(mapInput);
  const changedFiles = patch.changedFiles.map(normalizeRepoPath);
  const codes: string[] = [];
  const reasons: string[] = [];
  let risk: PolicyDecision["risk"] = "low";

  const outsideAllowlist = changedFiles.filter(path => !task.allowedPaths.some(allowed => pathMatchesAllowed(path, allowed)));
  if (outsideAllowlist.length > 0) {
    codes.push("patch.outside_allowlist");
    reasons.push(`Patch changes files outside the task allowlist: ${outsideAllowlist.join(", ")}`);
    risk = "critical";
  }

  const protectedFiles = changedFiles.filter(path => isProtectedPath(path, map.protectedPaths));
  if (protectedFiles.length > 0) {
    codes.push("patch.protected_path");
    reasons.push(`Patch changes protected files: ${protectedFiles.join(", ")}`);
    risk = "critical";
  }

  const selfModificationFiles = changedFiles.filter(path => SELF_MODIFICATION_PATHS.some(prefix => path.startsWith(prefix)));
  if (selfModificationFiles.length > 0) {
    codes.push("patch.self_modification");
    reasons.push("Agent source changes require the self-modification label, external review, full regression tests and no automatic merge.");
    risk = maxRisk(risk, "high");
    if (!task.labels.includes("self-modification")) {
      codes.push("patch.self_modification_label_missing");
      reasons.push("The task is missing the required self-modification label.");
      risk = "critical";
    }
  }

  const policyFiles = changedFiles.filter(path => POLICY_VALIDATOR_PATHS.includes(path as typeof POLICY_VALIDATOR_PATHS[number]));
  if (policyFiles.length > 0 && changedFiles.some(path => !POLICY_VALIDATOR_PATHS.includes(path as typeof POLICY_VALIDATOR_PATHS[number]))) {
    codes.push("patch.policy_mixed_change");
    reasons.push("Policy validators cannot be changed in the same patch as unrelated functional code.");
    risk = "critical";
  }

  if (changedFiles.some(path => path.endsWith("package.json") || path.endsWith("pyproject.toml") || path.endsWith("requirements.txt"))) {
    codes.push("patch.dependencies_changed");
    reasons.push("Dependency changes require license, maintenance, vulnerability and bundle-impact review.");
    risk = maxRisk(risk, "medium");
  }

  if (task.networkPolicy.mode === "ultra") {
    codes.push("patch.network_ultra_run");
    reasons.push("This patch was generated in an Ultra network run and requires explicit human review of fetched sources and dependencies.");
    risk = maxRisk(risk, "high");
  }

  return {
    accepted: !codes.some(code => [
      "patch.outside_allowlist",
      "patch.protected_path",
      "patch.self_modification_label_missing",
      "patch.policy_mixed_change",
    ].includes(code)),
    risk,
    codes,
    reasons,
    requiresHumanReview: true,
    requiresExternalReviewer: selfModificationFiles.length > 0 || task.networkPolicy.mode === "ultra",
  };
}

export function isProtectedPath(pathInput: string, additional: readonly string[] = []): boolean {
  const path = normalizeRepoPath(pathInput);
  return [...DEFAULT_PROTECTED_PATHS, ...additional.map(normalizeRepoPath)].some(pattern => {
    const normalizedPattern = normalizeRepoPath(pattern);
    if (normalizedPattern.endsWith("/")) return path.startsWith(normalizedPattern);
    if (normalizedPattern.endsWith(".")) return path.startsWith(normalizedPattern);
    return path === normalizedPattern || path.startsWith(`${normalizedPattern}/`);
  });
}

export function normalizeRepoPath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Invalid repository path: ${path}`);
  }
  return normalized;
}

function pathMatchesAllowed(path: string, allowedInput: string): boolean {
  const allowed = normalizeRepoPath(allowedInput);
  if (allowed.endsWith("/**")) return path.startsWith(allowed.slice(0, -3));
  if (allowed.endsWith("/")) return path.startsWith(allowed);
  return path === allowed || path.startsWith(`${allowed}/`);
}

function safeBranchSegment(value: string): string {
  const segment = value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  if (!segment) throw new Error("Task id cannot be converted to a safe branch segment.");
  return segment;
}

function maxRisk(a: PolicyDecision["risk"], b: PolicyDecision["risk"]): PolicyDecision["risk"] {
  const order: PolicyDecision["risk"][] = ["low", "medium", "high", "critical"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
