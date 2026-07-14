import { AgentPatchSchema, AgentTaskSchema, RepositoryMapSchema, type PatchReviewResult } from "./types";
import { evaluatePatchPaths, type PolicyDecision } from "./policy";

const SECRET_PATTERNS: Array<{ code: string; pattern: RegExp; reason: string }> = [
  { code: "secret.private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, reason: "Patch contains a private key." },
  { code: "secret.jwt", pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, reason: "Patch contains a JWT-like credential." },
  { code: "secret.github_token", pattern: /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/, reason: "Patch contains a GitHub token-like value." },
  { code: "secret.openai_key", pattern: /sk-[A-Za-z0-9_-]{20,}/, reason: "Patch contains an API key-like value." },
  { code: "secret.generic_assignment", pattern: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"'\n]{16,}["']/i, reason: "Patch contains a likely hard-coded credential." },
];

const UNSAFE_PATTERNS: Array<{ code: string; pattern: RegExp; reason: string; risk: PolicyDecision["risk"] }> = [
  { code: "code.dynamic_eval", pattern: /^\+.*\b(?:eval|new Function)\s*\(/m, reason: "Patch introduces dynamic code evaluation.", risk: "critical" },
  { code: "code.shell_true", pattern: /^\+.*\bshell\s*:\s*true/m, reason: "Patch enables shell command execution.", risk: "high" },
  { code: "code.remote_pipe_shell", pattern: /^\+.*(?:curl|wget).*(?:\||&&)\s*(?:sh|bash|python)/m, reason: "Patch introduces remote download-to-shell execution.", risk: "critical" },
  { code: "tests.disabled", pattern: /^\+.*(?:\.skip\(|describe\.skip|test\.skip|it\.skip|--no-verify|continue-on-error:\s*true)/m, reason: "Patch may disable tests or verification.", risk: "high" },
  { code: "security.disabled", pattern: /^\+.*(?:disableSecurity|skipAuth|bypassPermission|allowAll|verify\s*:\s*false)/mi, reason: "Patch may disable a security control.", risk: "critical" },
  { code: "audit.deleted", pattern: /^-.*(?:audit|telemetry|event log|logger)/mi, reason: "Patch removes audit or observability code and requires review.", risk: "high" },
];

export function validateAgentPatch(input: {
  task: unknown;
  repositoryMap: unknown;
  patch: unknown;
}): PatchReviewResult {
  const task = AgentTaskSchema.parse(input.task);
  const repositoryMap = RepositoryMapSchema.parse(input.repositoryMap);
  const patch = AgentPatchSchema.parse(input.patch);
  const pathDecision = evaluatePatchPaths(task, repositoryMap, patch);
  const codes = [...pathDecision.codes];
  const reasons = [...pathDecision.reasons];
  let risk = pathDecision.risk;
  let accepted = pathDecision.accepted;

  const changedLineCount = patch.additions + patch.deletions;
  if (patch.changedFiles.length > task.limits.maxFilesChanged) {
    codes.push("limits.files_changed");
    reasons.push(`Patch changes ${patch.changedFiles.length} files; limit is ${task.limits.maxFilesChanged}.`);
    risk = "critical";
    accepted = false;
  }
  if (changedLineCount > task.limits.maxPatchLines) {
    codes.push("limits.patch_lines");
    reasons.push(`Patch changes ${changedLineCount} lines; limit is ${task.limits.maxPatchLines}.`);
    risk = "critical";
    accepted = false;
  }
  if (/GIT binary patch|Binary files .* differ/.test(patch.diff)) {
    codes.push("patch.binary_file");
    reasons.push("Unknown binary files are not allowed in coding-agent patches.");
    risk = "critical";
    accepted = false;
  }

  for (const secret of SECRET_PATTERNS) {
    if (!secret.pattern.test(patch.diff)) continue;
    codes.push(secret.code);
    reasons.push(secret.reason);
    risk = "critical";
    accepted = false;
  }

  for (const unsafe of UNSAFE_PATTERNS) {
    if (!unsafe.pattern.test(patch.diff)) continue;
    codes.push(unsafe.code);
    reasons.push(unsafe.reason);
    risk = maxRisk(risk, unsafe.risk);
    if (unsafe.risk === "critical") accepted = false;
  }

  if (removesTestsWithoutReplacement(patch.diff)) {
    codes.push("tests.removed_without_replacement");
    reasons.push("Patch removes test cases without adding replacement tests.");
    risk = maxRisk(risk, "high");
    accepted = false;
  }

  if (patch.baseCommit !== repositoryMap.baseCommit) {
    codes.push("patch.base_commit_mismatch");
    reasons.push("Patch base commit differs from the repository map and must be rebased and revalidated.");
    risk = "critical";
    accepted = false;
  }

  const decision: PolicyDecision = {
    accepted,
    risk,
    codes: [...new Set(codes)],
    reasons: [...new Set(reasons)],
    requiresHumanReview: true,
    requiresExternalReviewer: pathDecision.requiresExternalReviewer,
  };
  return {
    decision,
    notes: buildReviewNotes(decision),
  };
}

function removesTestsWithoutReplacement(diff: string): boolean {
  const removedTests = diff.split("\n").filter(line => /^-.*\b(?:test|it|describe)\s*\(/.test(line)).length;
  const addedTests = diff.split("\n").filter(line => /^\+.*\b(?:test|it|describe)\s*\(/.test(line)).length;
  return removedTests > 0 && addedTests === 0;
}

function buildReviewNotes(decision: PolicyDecision): string[] {
  const notes = [
    decision.accepted ? "Patch passed deterministic policy validation." : "Patch was rejected by deterministic policy validation.",
    `Risk level: ${decision.risk}.`,
    "Human approval is required before merge.",
  ];
  if (decision.requiresExternalReviewer) notes.push("An external reviewer is required because the patch modifies coding-agent source or policy-adjacent code.");
  return notes;
}

function maxRisk(a: PolicyDecision["risk"], b: PolicyDecision["risk"]): PolicyDecision["risk"] {
  const order: PolicyDecision["risk"][] = ["low", "medium", "high", "critical"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
