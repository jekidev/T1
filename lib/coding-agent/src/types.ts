import { z } from "zod";

export const CodingAgentIdSchema = z.enum(["openhands", "aider"]);
export const AgentRunStatusSchema = z.enum([
  "created",
  "analyzing",
  "planned",
  "executing",
  "validating",
  "rejected",
  "awaiting_review",
  "completed",
  "failed",
  "cancelled",
]);

export const AgentLimitsSchema = z.object({
  maxIterations: z.number().int().min(1).max(100).default(12),
  maxCommands: z.number().int().min(1).max(1_000).default(80),
  maxFilesChanged: z.number().int().min(1).max(500).default(40),
  maxPatchLines: z.number().int().min(1).max(100_000).default(8_000),
  maxRuntimeMinutes: z.number().int().min(1).max(1_440).default(45),
  maxModelTokens: z.number().int().min(1_000).max(10_000_000).default(250_000),
  maxCost: z.number().finite().min(0).max(100_000).default(25),
});

export const RepositoryFileSummarySchema = z.object({
  path: z.string().min(1).max(1_000),
  language: z.string().min(1).max(80).optional(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  summary: z.string().max(2_000).optional(),
  protected: z.boolean(),
  generated: z.boolean().default(false),
  test: z.boolean().default(false),
});

export const RepositoryModuleSchema = z.object({
  id: z.string().min(1).max(160),
  root: z.string().min(1).max(1_000),
  kind: z.enum(["application", "library", "service", "script", "documentation", "configuration", "unknown"]),
  files: z.array(z.string().min(1).max(1_000)).max(50_000),
  dependencies: z.array(z.string().min(1).max(240)).max(10_000),
});

export const DependencyRecordSchema = z.object({
  name: z.string().min(1).max(240),
  version: z.string().min(1).max(120),
  scope: z.enum(["runtime", "development", "optional", "peer"]),
  manifestPath: z.string().min(1).max(1_000),
  license: z.string().max(160).optional(),
});

export const OwnershipRuleSchema = z.object({
  pattern: z.string().min(1).max(1_000),
  owners: z.array(z.string().min(1).max(240)).max(100),
  requiresExternalReview: z.boolean().default(false),
});

export const RepositoryMapSchema = z.object({
  baseCommit: z.string().min(7).max(80),
  files: z.array(RepositoryFileSummarySchema).max(100_000),
  modules: z.array(RepositoryModuleSchema).max(10_000),
  dependencies: z.array(DependencyRecordSchema).max(50_000),
  entryPoints: z.array(z.string().min(1).max(1_000)).max(10_000),
  protectedPaths: z.array(z.string().min(1).max(1_000)).max(10_000),
  testCommands: z.array(z.string().min(1).max(1_000)).max(1_000),
  buildCommands: z.array(z.string().min(1).max(1_000)).max(1_000),
  ownershipRules: z.array(OwnershipRuleSchema).max(10_000),
  generatedAt: z.string().datetime(),
});

export const CodingTaskPlanSchema = z.object({
  objective: z.string().min(1).max(4_000),
  reason: z.string().min(1).max(4_000),
  affectedModules: z.array(z.string().min(1).max(240)).max(200),
  expectedFiles: z.array(z.string().min(1).max(1_000)).max(500),
  risks: z.array(z.string().min(1).max(2_000)).max(200),
  validationSteps: z.array(z.string().min(1).max(1_000)).min(1).max(200),
  rollbackPlan: z.string().min(1).max(4_000),
});

export const AgentPatchSchema = z.object({
  id: z.string().min(1).max(160),
  runId: z.string().min(1).max(160),
  baseCommit: z.string().min(7).max(80),
  changedFiles: z.array(z.string().min(1).max(1_000)).min(1).max(2_000),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  diff: z.string().min(1).max(10_000_000),
  explanation: z.string().min(1).max(10_000),
});

export const CommandResultSchema = z.object({
  command: z.string().min(1).max(2_000),
  exitCode: z.number().int(),
  stdout: z.string().max(1_000_000),
  stderr: z.string().max(1_000_000),
  durationMs: z.number().int().nonnegative(),
  timedOut: z.boolean().default(false),
});

export const TestResultSchema = z.object({
  name: z.string().min(1).max(240),
  command: z.string().min(1).max(2_000),
  passed: z.boolean(),
  exitCode: z.number().int(),
  durationMs: z.number().int().nonnegative(),
  summary: z.string().max(10_000),
});

export const EvaluationMetricsSchema = z.object({
  testPassRate: z.number().finite().min(0).max(1).optional(),
  bundleSizeBytes: z.number().int().nonnegative().optional(),
  startupTimeMs: z.number().finite().nonnegative().optional(),
  framesPerSecond: z.number().finite().nonnegative().optional(),
  simulationTickMs: z.number().finite().nonnegative().optional(),
  memoryBytes: z.number().int().nonnegative().optional(),
  apiLatencyMs: z.number().finite().nonnegative().optional(),
  tokenConsumption: z.number().int().nonnegative().optional(),
  retrievalPrecision: z.number().finite().min(0).max(1).optional(),
  buildTimeMs: z.number().finite().nonnegative().optional(),
});

export const ChangeEvaluationSchema = z.object({
  baseline: EvaluationMetricsSchema,
  candidate: EvaluationMetricsSchema,
  regressions: z.array(z.string().min(1).max(2_000)).max(200),
  improvements: z.array(z.string().min(1).max(2_000)).max(200),
  verdict: z.enum(["accept", "reject", "needs_review"]),
});

export const PolicyDecisionSchema = z.object({
  accepted: z.boolean(),
  risk: z.enum(["low", "medium", "high", "critical"]),
  codes: z.array(z.string().min(1).max(160)).max(500),
  reasons: z.array(z.string().min(1).max(2_000)).max(500),
  requiresHumanReview: z.boolean(),
  requiresExternalReviewer: z.boolean(),
});

export const AgentTaskSchema = z.object({
  id: z.string().min(1).max(160),
  objective: z.string().min(1).max(20_000),
  signal: z.enum([
    "failing_test",
    "runtime_error",
    "performance_regression",
    "security_finding",
    "explicit_user_request",
    "accepted_issue",
    "technical_debt",
    "failed_agent_task",
    "code_quality_metric",
  ]),
  requestedAdapter: CodingAgentIdSchema.default("openhands"),
  baseBranch: z.string().min(1).max(240).default("main"),
  requestedBy: z.string().min(1).max(240),
  allowedPaths: z.array(z.string().min(1).max(1_000)).min(1).max(1_000),
  labels: z.array(z.string().min(1).max(160)).max(100).default([]),
  limits: AgentLimitsSchema.default({}),
});

export const AgentRunSchema = z.object({
  id: z.string().min(1).max(160),
  task: AgentTaskSchema,
  adapterId: CodingAgentIdSchema,
  status: AgentRunStatusSchema,
  baseCommit: z.string().min(7).max(80),
  branchName: z.string().min(1).max(240),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  plan: CodingTaskPlanSchema.optional(),
  patch: AgentPatchSchema.optional(),
  policyDecision: PolicyDecisionSchema.optional(),
  commands: z.array(CommandResultSchema).max(10_000).default([]),
  tests: z.array(TestResultSchema).max(10_000).default([]),
  evaluation: ChangeEvaluationSchema.optional(),
  pullRequestUrl: z.string().url().optional(),
  error: z.object({ code: z.string().min(1).max(160), message: z.string().min(1).max(10_000) }).optional(),
  auditEvents: z.array(z.object({
    at: z.string().datetime(),
    type: z.string().min(1).max(240),
    detail: z.record(z.string(), z.unknown()).default({}),
  })).max(50_000).default([]),
});

export type CodingAgentId = z.infer<typeof CodingAgentIdSchema>;
export type AgentLimits = z.infer<typeof AgentLimitsSchema>;
export type RepositoryFileSummary = z.infer<typeof RepositoryFileSummarySchema>;
export type RepositoryModule = z.infer<typeof RepositoryModuleSchema>;
export type DependencyRecord = z.infer<typeof DependencyRecordSchema>;
export type OwnershipRule = z.infer<typeof OwnershipRuleSchema>;
export type RepositoryMap = z.infer<typeof RepositoryMapSchema>;
export type CodingTaskPlan = z.infer<typeof CodingTaskPlanSchema>;
export type AgentPatch = z.infer<typeof AgentPatchSchema>;
export type CommandResult = z.infer<typeof CommandResultSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export type EvaluationMetrics = z.infer<typeof EvaluationMetricsSchema>;
export type ChangeEvaluation = z.infer<typeof ChangeEvaluationSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type AgentTask = z.infer<typeof AgentTaskSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;

export interface RepositoryAnalysisInput {
  baseCommit: string;
  files: RepositoryFileSummary[];
  manifests?: Array<{ path: string; content: string }>;
  codeowners?: string;
}

export interface CodingTaskInput {
  task: AgentTask;
  repositoryMap: RepositoryMap;
}

export interface CodingTaskExecutionInput {
  run: AgentRun;
  repositoryMap: RepositoryMap;
  plan: CodingTaskPlan;
}

export interface CodingTaskResult {
  patch: AgentPatch;
  commands: CommandResult[];
  tests: TestResult[];
  evaluation?: ChangeEvaluation;
  pullRequestUrl?: string;
}

export interface PatchReviewInput {
  task: AgentTask;
  repositoryMap: RepositoryMap;
  plan: CodingTaskPlan;
  patch: AgentPatch;
}

export interface PatchReviewResult {
  decision: PolicyDecision;
  notes: string[];
}

export interface CodingAgentAdapter {
  readonly id: CodingAgentId;
  analyzeRepository(input: RepositoryAnalysisInput): Promise<RepositoryMap>;
  planTask(input: CodingTaskInput): Promise<CodingTaskPlan>;
  executeTask(input: CodingTaskExecutionInput): Promise<CodingTaskResult>;
  reviewPatch(input: PatchReviewInput): Promise<PatchReviewResult>;
  stop(runId: string): Promise<void>;
}
