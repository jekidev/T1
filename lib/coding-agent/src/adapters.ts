import {
  AgentPatchSchema,
  ChangeEvaluationSchema,
  CodingTaskPlanSchema,
  CommandResultSchema,
  PolicyDecisionSchema,
  RepositoryMapSchema,
  TestResultSchema,
  type CodingAgentAdapter,
  type CodingAgentId,
  type CodingTaskExecutionInput,
  type CodingTaskInput,
  type CodingTaskResult,
  type PatchReviewInput,
  type PatchReviewResult,
  type PolicyDecision,
  type PublishPullRequestInput,
  type PublishPullRequestResult,
  type RepositoryAnalysisInput,
  type RepositoryMap,
} from "./types";
import { validateAgentPatch } from "./patchValidator";

export interface RemoteCodingAgentAdapterOptions {
  id: CodingAgentId;
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

export class RemoteCodingAgentAdapter implements CodingAgentAdapter {
  readonly id: CodingAgentId;
  private readonly baseUrl: URL;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(options: RemoteCodingAgentAdapterOptions) {
    this.id = options.id;
    this.baseUrl = validateBaseUrl(options.baseUrl);
    if (options.token.length < 24) throw new Error("Coding-agent adapter token must contain at least 24 characters.");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 45 * 60 * 1_000;
  }

  async analyzeRepository(input: RepositoryAnalysisInput): Promise<RepositoryMap> {
    const response = await this.request("analyze", input);
    return RepositoryMapSchema.parse(response.repositoryMap);
  }

  async planTask(input: CodingTaskInput) {
    const response = await this.request("plan", input);
    return CodingTaskPlanSchema.parse(response.plan);
  }

  async executeTask(input: CodingTaskExecutionInput): Promise<CodingTaskResult> {
    const response = await this.request("execute", input);
    if (response.pullRequestUrl || response.branchPublished === true) {
      throw new Error("Sandbox violated the protocol by publishing before deterministic patch validation.");
    }
    return {
      patch: AgentPatchSchema.parse(response.patch),
      commands: Array.isArray(response.commands) ? response.commands.map(value => CommandResultSchema.parse(value)) : [],
      tests: Array.isArray(response.tests) ? response.tests.map(value => TestResultSchema.parse(value)) : [],
      ...(response.evaluation ? { evaluation: ChangeEvaluationSchema.parse(response.evaluation) } : {}),
    };
  }

  async reviewPatch(input: PatchReviewInput): Promise<PatchReviewResult> {
    const deterministic = validateAgentPatch({ task: input.task, repositoryMap: input.repositoryMap, patch: input.patch });
    if (!deterministic.decision.accepted) return deterministic;

    const response = await this.request("review", input);
    const remoteDecision = PolicyDecisionSchema.parse(response.decision);
    const notes = Array.isArray(response.notes)
      ? response.notes.filter((value): value is string => typeof value === "string").slice(0, 500)
      : [];
    return {
      decision: mergeReviewDecisions(deterministic.decision, remoteDecision),
      notes: [...deterministic.notes, ...notes].slice(0, 500),
    };
  }

  async publishPullRequest(input: PublishPullRequestInput): Promise<PublishPullRequestResult> {
    if (!input.run.policyDecision?.accepted || !input.run.patch || !input.run.plan) {
      throw new Error("A validated plan, patch and accepted policy decision are required before publication.");
    }
    const response = await this.request("publish", input);
    if (typeof response.pullRequestUrl !== "string" || typeof response.branchName !== "string") {
      throw new Error("Sandbox publish response is missing branchName or pullRequestUrl.");
    }
    if (response.branchName !== input.run.branchName) {
      throw new Error("Sandbox published an unexpected branch name.");
    }
    return { branchName: response.branchName, pullRequestUrl: new URL(response.pullRequestUrl).toString() };
  }

  async stop(runId: string): Promise<void> {
    await this.request("stop", { runId });
  }

  private async request(action: "analyze" | "plan" | "execute" | "review" | "publish" | "stop", payload: unknown): Promise<Record<string, unknown>> {
    const url = new URL(`v1/adapters/${this.id}/${action}`, this.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "error",
      });
      const text = await response.text();
      const body = text ? safeJson(text) : {};
      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : `Coding-agent sandbox returned HTTP ${response.status}.`;
        throw new Error(message);
      }
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class OpenHandsAdapter extends RemoteCodingAgentAdapter {
  constructor(options: Omit<RemoteCodingAgentAdapterOptions, "id">) {
    super({ ...options, id: "openhands" });
  }
}

export class AiderAdapter extends RemoteCodingAgentAdapter {
  constructor(options: Omit<RemoteCodingAgentAdapterOptions, "id">) {
    super({ ...options, id: "aider" });
  }
}

function mergeReviewDecisions(deterministic: PolicyDecision, remote: PolicyDecision): PolicyDecision {
  const order: PolicyDecision["risk"][] = ["low", "medium", "high", "critical"];
  return {
    accepted: deterministic.accepted && remote.accepted,
    risk: order.indexOf(deterministic.risk) >= order.indexOf(remote.risk) ? deterministic.risk : remote.risk,
    codes: [...new Set([...deterministic.codes, ...remote.codes])],
    reasons: [...new Set([...deterministic.reasons, ...remote.reasons])],
    requiresHumanReview: true,
    requiresExternalReviewer: deterministic.requiresExternalReviewer || remote.requiresExternalReviewer,
  };
}

function validateBaseUrl(value: string): URL {
  const url = new URL(value);
  const localhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
    throw new Error("Coding-agent sandbox URL must use HTTPS, except localhost development.");
  }
  if (url.username || url.password) throw new Error("Coding-agent sandbox URL cannot include credentials.");
  url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  url.search = "";
  url.hash = "";
  return url;
}

function safeJson(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
