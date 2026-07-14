import {
  AgentRunSchema,
  AgentTaskSchema,
  RepositoryMapSchema,
  type AgentRun,
  type AgentTask,
  type CodingAgentAdapter,
  type CodingAgentId,
  type RepositoryMap,
} from "./types";
import { evaluateTaskPolicy, expectedAgentBranch } from "./policy";
import { validateAgentPatch } from "./patchValidator";

export type AgentRunEventType =
  | "agent.task.created"
  | "agent.repository.analyzed"
  | "agent.plan.created"
  | "agent.command.started"
  | "agent.command.completed"
  | "agent.patch.created"
  | "agent.patch.rejected"
  | "agent.test.started"
  | "agent.test.completed"
  | "agent.evaluation.completed"
  | "agent.pull_request.created"
  | "agent.run.failed"
  | "agent.run.completed"
  | "agent.run.cancelled";

export interface AgentRunObserver {
  emit(type: AgentRunEventType, run: AgentRun, detail?: Record<string, unknown>): void | Promise<void>;
}

export class CodingAgentRunManager {
  private readonly adapters = new Map<CodingAgentId, CodingAgentAdapter>();
  private readonly runs = new Map<string, AgentRun>();

  constructor(adapters: readonly CodingAgentAdapter[], private readonly observer?: AgentRunObserver) {
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.id)) throw new Error(`Duplicate coding-agent adapter: ${adapter.id}`);
      this.adapters.set(adapter.id, adapter);
    }
  }

  createRun(taskInput: AgentTask, repositoryMapInput: RepositoryMap): AgentRun {
    const task = AgentTaskSchema.parse(taskInput);
    const repositoryMap = RepositoryMapSchema.parse(repositoryMapInput);
    const runId = `agent-run-${task.id}`;
    if (this.runs.has(runId)) throw new Error(`Coding-agent run already exists: ${runId}`);
    const policyDecision = evaluateTaskPolicy(task, repositoryMap);
    const now = new Date().toISOString();
    const run: AgentRun = AgentRunSchema.parse({
      id: runId,
      task,
      adapterId: task.requestedAdapter,
      status: policyDecision.accepted ? "created" : "rejected",
      baseCommit: repositoryMap.baseCommit,
      branchName: expectedAgentBranch(task),
      createdAt: now,
      updatedAt: now,
      policyDecision,
      commands: [],
      tests: [],
      auditEvents: [],
      ...(!policyDecision.accepted ? { error: { code: "policy.task_rejected", message: policyDecision.reasons.join(" ") } } : {}),
    });
    this.runs.set(run.id, appendAudit(run, "agent.task.created", {
      adapter: run.adapterId,
      branch: run.branchName,
      signal: run.task.signal,
      accepted: policyDecision.accepted,
    }));
    void this.notify("agent.task.created", this.getRun(run.id));
    return this.getRun(run.id);
  }

  async executeRun(runId: string, repositoryMapInput: RepositoryMap): Promise<AgentRun> {
    let run = this.getMutableRun(runId);
    if (["cancelled", "completed", "rejected", "awaiting_review"].includes(run.status)) throw new Error(`Run cannot execute from status ${run.status}.`);
    const repositoryMap = RepositoryMapSchema.parse(repositoryMapInput);
    if (run.baseCommit !== repositoryMap.baseCommit) throw new Error("Repository map base commit changed; create a new run or rebase before execution.");
    const adapter = this.adapters.get(run.adapterId);
    if (!adapter) throw new Error(`Coding-agent adapter ${run.adapterId} is not configured.`);

    try {
      run = this.updateRun(run.id, { status: "analyzing" });
      await this.notify("agent.repository.analyzed", run, { fileCount: repositoryMap.files.length, moduleCount: repositoryMap.modules.length });

      const plan = await adapter.planTask({ task: run.task, repositoryMap });
      run = this.updateRun(run.id, { status: "planned", plan });
      await this.notify("agent.plan.created", run, { expectedFiles: plan.expectedFiles.length, validationSteps: plan.validationSteps.length });

      run = this.updateRun(run.id, { status: "executing" });
      await this.notify("agent.command.started", run, { phase: "adapter.execute" });
      const result = await adapter.executeTask({ run, repositoryMap, plan });
      await this.notify("agent.command.completed", run, { commandCount: result.commands.length });

      run = this.updateRun(run.id, {
        status: "validating",
        patch: result.patch,
        commands: result.commands,
        tests: result.tests,
        ...(result.evaluation ? { evaluation: result.evaluation } : {}),
      });
      await this.notify("agent.patch.created", run, { filesChanged: result.patch.changedFiles.length, additions: result.patch.additions, deletions: result.patch.deletions });
      await this.notify("agent.test.started", run, { expectedTests: result.tests.length });

      const deterministic = validateAgentPatch({ task: run.task, repositoryMap, patch: result.patch });
      const adapterReview = deterministic.decision.accepted
        ? await adapter.reviewPatch({ task: run.task, repositoryMap, plan, patch: result.patch })
        : deterministic;
      const testsPassed = result.tests.length > 0 && result.tests.every(test => test.passed && test.exitCode === 0);
      const evaluationRejected = result.evaluation?.verdict === "reject";
      const policyDecision = mergeDecisions(deterministic.decision, adapterReview.decision);

      if (!policyDecision.accepted || !testsPassed || evaluationRejected) {
        const reasons = [
          ...policyDecision.reasons,
          ...(!testsPassed ? ["Required validation tests did not all pass or no test results were provided."] : []),
          ...(evaluationRejected ? ["Before/after evaluation rejected the candidate patch."] : []),
        ];
        run = this.updateRun(run.id, {
          status: "rejected",
          policyDecision: { ...policyDecision, accepted: false, reasons },
          error: { code: "patch.validation_rejected", message: reasons.join(" ") },
        });
        await this.notify("agent.patch.rejected", run, { codes: run.policyDecision?.codes ?? [], testsPassed });
        return structuredClone(run);
      }

      run = this.updateRun(run.id, { policyDecision });
      await this.notify("agent.test.completed", run, { tests: result.tests.map(test => ({ name: test.name, passed: test.passed })) });
      if (result.evaluation) await this.notify("agent.evaluation.completed", run, { verdict: result.evaluation.verdict });

      if (run.task.createPullRequest) {
        run = this.updateRun(run.id, { status: "publishing" });
        const published = await adapter.publishPullRequest({ run, repositoryMap, plan, patch: result.patch });
        run = this.updateRun(run.id, { status: "awaiting_review", pullRequestUrl: published.pullRequestUrl });
        await this.notify("agent.pull_request.created", run, { pullRequestUrl: published.pullRequestUrl, branchName: published.branchName });
      } else {
        run = this.updateRun(run.id, { status: "awaiting_review" });
      }

      await this.notify("agent.run.completed", run, { awaitingHumanReview: true, pullRequestCreated: Boolean(run.pullRequestUrl) });
      return structuredClone(run);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      run = this.updateRun(run.id, { status: "failed", error: { code: "agent.execution_failed", message } });
      await this.notify("agent.run.failed", run, { code: run.error?.code });
      return structuredClone(run);
    }
  }

  async stopRun(runId: string): Promise<AgentRun> {
    const run = this.getMutableRun(runId);
    if (["completed", "rejected", "failed", "cancelled", "awaiting_review"].includes(run.status)) return structuredClone(run);
    const adapter = this.adapters.get(run.adapterId);
    if (adapter) await adapter.stop(run.id);
    const cancelled = this.updateRun(run.id, { status: "cancelled" });
    await this.notify("agent.run.cancelled", cancelled);
    return structuredClone(cancelled);
  }

  getRun(runId: string): AgentRun {
    return structuredClone(this.getMutableRun(runId));
  }

  listRuns(): AgentRun[] {
    return [...this.runs.values()]
      .map(run => structuredClone(run))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  importRun(runInput: AgentRun): AgentRun {
    const run = AgentRunSchema.parse(runInput);
    this.runs.set(run.id, structuredClone(run));
    return structuredClone(run);
  }

  private updateRun(runId: string, patch: Partial<AgentRun>): AgentRun {
    const current = this.getMutableRun(runId);
    const next = AgentRunSchema.parse({
      ...current,
      ...patch,
      id: current.id,
      task: current.task,
      baseCommit: current.baseCommit,
      branchName: current.branchName,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      auditEvents: current.auditEvents,
    });
    this.runs.set(runId, next);
    return next;
  }

  private getMutableRun(runId: string): AgentRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown coding-agent run: ${runId}`);
    return run;
  }

  private async notify(type: AgentRunEventType, runInput: AgentRun, detail: Record<string, unknown> = {}): Promise<void> {
    const run = appendAudit(runInput, type, sanitizeDetail(detail));
    this.runs.set(run.id, run);
    await this.observer?.emit(type, structuredClone(run), sanitizeDetail(detail));
  }
}

function appendAudit(run: AgentRun, type: AgentRunEventType, detail: Record<string, unknown>): AgentRun {
  return AgentRunSchema.parse({
    ...run,
    updatedAt: new Date().toISOString(),
    auditEvents: [...run.auditEvents, { at: new Date().toISOString(), type, detail }].slice(-50_000),
  });
}

function mergeDecisions(a: AgentRun["policyDecision"], b: AgentRun["policyDecision"]): NonNullable<AgentRun["policyDecision"]> {
  if (!a && !b) throw new Error("At least one policy decision is required.");
  if (!a) return b!;
  if (!b) return a;
  const order: NonNullable<AgentRun["policyDecision"]>["risk"][] = ["low", "medium", "high", "critical"];
  return {
    accepted: a.accepted && b.accepted,
    risk: order.indexOf(a.risk) >= order.indexOf(b.risk) ? a.risk : b.risk,
    codes: [...new Set([...a.codes, ...b.codes])],
    reasons: [...new Set([...a.reasons, ...b.reasons])],
    requiresHumanReview: true,
    requiresExternalReviewer: a.requiresExternalReviewer || b.requiresExternalReviewer,
  };
}

function sanitizeDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (/token|secret|password|authorization|cookie|credential/i.test(key)) continue;
    if (typeof value === "string") output[key] = value.slice(0, 2_000);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) output[key] = value;
    else if (Array.isArray(value)) output[key] = value.slice(0, 200).map(item => typeof item === "string" ? item.slice(0, 500) : item);
    else if (value && typeof value === "object") output[key] = "[structured-detail]";
  }
  return output;
}
