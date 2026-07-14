import {
  AgentRunSchema,
  AgentTaskSchema,
  AiderAdapter,
  CodingAgentRunManager,
  OpenHandsAdapter,
  type AgentRun,
  type AgentRunEventType,
  type AgentTask,
  type CodingAgentAdapter,
  type CodingAgentId,
  type RepositoryMap,
} from "@workspace/coding-agent";
import { codingAgentStorage } from "./coding-agent-storage";
import { buildCurrentRepositoryMap, configuredBaseCommit } from "./coding-agent-repository";
import { logger } from "./logger";
import { withSpan } from "./telemetry";

const TERMINAL_STATUSES = new Set<AgentRun["status"]>(["completed", "failed", "rejected", "cancelled", "awaiting_review"]);

export class CodingAgentService {
  private readonly adapters: CodingAgentAdapter[];
  private readonly manager: CodingAgentRunManager;
  private readonly inFlight = new Map<string, Promise<AgentRun>>();
  private initialized = false;

  constructor() {
    this.adapters = configuredAdapters();
    this.manager = new CodingAgentRunManager(this.adapters, {
      emit: (type, run, detail) => this.observeRun(type, run, detail),
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await codingAgentStorage.initialize();
    const runs = await codingAgentStorage.listRuns(500);
    for (const run of runs) {
      const recovered = TERMINAL_STATUSES.has(run.status) ? run : interruptedRun(run);
      this.manager.importRun(recovered);
      if (recovered !== run) await codingAgentStorage.saveRun(recovered);
    }
  }

  capabilities(): {
    enabled: boolean;
    adapters: Array<{ id: CodingAgentId; configured: boolean; executionBoundary: string }>;
    baseCommitConfigured: boolean;
    directDefaultBranchWrite: false;
    localShellExecution: false;
    humanReviewRequired: true;
  } {
    const configured = new Set(this.adapters.map(adapter => adapter.id));
    return {
      enabled: configured.size > 0,
      adapters: (["openhands", "aider"] as const).map(id => ({
        id,
        configured: configured.has(id),
        executionBoundary: id === "openhands"
          ? "External OpenHands Agent Server / ACP sandbox bridge"
          : "External Aider CLI sandbox bridge",
      })),
      baseCommitConfigured: hasConfiguredBaseCommit(),
      directDefaultBranchWrite: false,
      localShellExecution: false,
      humanReviewRequired: true,
    };
  }

  async repositoryMap(force = false): Promise<RepositoryMap> {
    await this.initialize();
    const baseCommit = configuredBaseCommit();
    if (!force) {
      try {
        return await codingAgentStorage.readRepositoryMap(baseCommit);
      } catch {
        // Missing or invalid cache is rebuilt from metadata in the current checkout.
      }
    }
    return withSpan("agent.repository.analyzed", {
      "agent.base_commit": baseCommit,
      "agent.repository.force_refresh": force,
    }, async span => {
      const map = await buildCurrentRepositoryMap();
      span.setAttribute("agent.repository.file_count", map.files.length);
      span.setAttribute("agent.repository.module_count", map.modules.length);
      return codingAgentStorage.saveRepositoryMap(map);
    });
  }

  async createRun(taskInput: AgentTask): Promise<AgentRun> {
    await this.initialize();
    const task = AgentTaskSchema.parse(taskInput);
    if (!this.adapters.some(adapter => adapter.id === task.requestedAdapter)) {
      throw new Error(`Coding-agent adapter ${task.requestedAdapter} is not configured.`);
    }
    const map = await this.repositoryMap(false);
    const run = this.manager.createRun(task, map);
    await codingAgentStorage.saveRun(run);
    return run;
  }

  async startRun(runId: string): Promise<AgentRun> {
    await this.initialize();
    if (this.inFlight.has(runId)) return this.getRun(runId);
    const run = await this.ensureImported(runId);
    if (TERMINAL_STATUSES.has(run.status)) throw new Error(`Run cannot start from status ${run.status}.`);
    const map = await this.repositoryMap(false);
    if (map.baseCommit !== run.baseCommit) {
      throw new Error("Repository base commit changed; create a new run from the current commit.");
    }

    const promise = this.manager.executeRun(runId, map)
      .then(result => codingAgentStorage.saveRun(result))
      .catch(async error => {
        logger.error({ runId, error }, "Coding-agent background run failed");
        return this.getRun(runId);
      })
      .finally(() => {
        this.inFlight.delete(runId);
      });
    this.inFlight.set(runId, promise);
    return this.getRun(runId);
  }

  async stopRun(runId: string): Promise<AgentRun> {
    await this.initialize();
    await this.ensureImported(runId);
    const run = await this.manager.stopRun(runId);
    await codingAgentStorage.saveRun(run);
    return run;
  }

  async getRun(runId: string): Promise<AgentRun> {
    await this.initialize();
    try {
      return this.manager.getRun(runId);
    } catch {
      const run = await codingAgentStorage.readRun(runId);
      this.manager.importRun(run);
      return run;
    }
  }

  async listRuns(limit = 100): Promise<AgentRun[]> {
    await this.initialize();
    return codingAgentStorage.listRuns(limit);
  }

  private async ensureImported(runId: string): Promise<AgentRun> {
    try {
      return this.manager.getRun(runId);
    } catch {
      const run = await codingAgentStorage.readRun(runId);
      return this.manager.importRun(run);
    }
  }

  private async observeRun(
    type: AgentRunEventType,
    run: AgentRun,
    detail: Record<string, unknown> = {},
  ): Promise<void> {
    await codingAgentStorage.saveRun(run);
    await withSpan(type, {
      "agent.run.id": run.id,
      "agent.adapter": run.adapterId,
      "agent.status": run.status,
      "agent.branch": run.branchName,
      "agent.signal": run.task.signal,
      "agent.files_changed": run.patch?.changedFiles.length ?? 0,
      "agent.test_count": run.tests.length,
      "agent.policy_risk": run.policyDecision?.risk ?? "unknown",
      "agent.event.detail_keys": Object.keys(detail).filter(key => !isSensitiveKey(key)).slice(0, 50).join(","),
    }, () => undefined);
  }
}

export const codingAgentService = new CodingAgentService();

function configuredAdapters(): CodingAgentAdapter[] {
  const sharedUrl = process.env.CODING_AGENT_WORKER_URL?.trim();
  const sharedToken = process.env.CODING_AGENT_WORKER_TOKEN?.trim();
  const timeoutMs = positiveInteger(process.env.CODING_AGENT_WORKER_TIMEOUT_MS, 45 * 60 * 1_000);
  const definitions: Array<{
    id: CodingAgentId;
    url?: string;
    token?: string;
  }> = [
    {
      id: "openhands",
      url: process.env.CODING_AGENT_OPENHANDS_URL?.trim() || sharedUrl,
      token: process.env.CODING_AGENT_OPENHANDS_TOKEN?.trim() || sharedToken,
    },
    {
      id: "aider",
      url: process.env.CODING_AGENT_AIDER_URL?.trim() || sharedUrl,
      token: process.env.CODING_AGENT_AIDER_TOKEN?.trim() || sharedToken,
    },
  ];

  const adapters: CodingAgentAdapter[] = [];
  for (const definition of definitions) {
    if (!definition.url || !definition.token) continue;
    const options = { baseUrl: definition.url, token: definition.token, timeoutMs };
    adapters.push(definition.id === "openhands" ? new OpenHandsAdapter(options) : new AiderAdapter(options));
  }
  return adapters;
}

function interruptedRun(run: AgentRun): AgentRun {
  const now = new Date().toISOString();
  return AgentRunSchema.parse({
    ...run,
    status: "failed",
    updatedAt: now,
    error: {
      code: "agent.server_restarted",
      message: "The API process restarted while the external coding-agent run was active. Inspect the sandbox worker and create a new run or explicitly retry from a fresh base commit.",
    },
    auditEvents: [
      ...run.auditEvents,
      {
        at: now,
        type: "agent.run.failed",
        detail: { code: "agent.server_restarted" },
      },
    ].slice(-50_000),
  });
}

function hasConfiguredBaseCommit(): boolean {
  try {
    configuredBaseCommit();
    return true;
  } catch {
    return false;
  }
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function isSensitiveKey(key: string): boolean {
  return /token|secret|password|authorization|cookie|credential|api[-_.]?key/i.test(key);
}
