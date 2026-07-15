import type { AssetJob, AssetJobStatus } from "./types";

const ALLOWED_TRANSITIONS: Record<AssetJobStatus, readonly AssetJobStatus[]> = {
  queued: ["validating_input", "cancelled", "failed"],
  validating_input: ["preprocessing", "failed", "cancelled"],
  preprocessing: ["generating", "failed", "cancelled"],
  generating: ["blender_processing", "failed", "cancelled"],
  blender_processing: ["validating_output", "failed", "cancelled"],
  validating_output: ["awaiting_review", "published", "failed", "cancelled"],
  awaiting_review: ["published", "cancelled", "failed"],
  published: [],
  failed: ["queued", "cancelled"],
  cancelled: ["queued"],
};

const STATUS_PROGRESS: Record<AssetJobStatus, number> = {
  queued: 0,
  validating_input: 0.05,
  preprocessing: 0.15,
  generating: 0.35,
  blender_processing: 0.7,
  validating_output: 0.88,
  awaiting_review: 0.96,
  published: 1,
  failed: 1,
  cancelled: 1,
};

export function canTransitionAssetJob(from: AssetJobStatus, to: AssetJobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionAssetJob(job: AssetJob, nextStatus: AssetJobStatus, now = new Date()): AssetJob {
  if (!canTransitionAssetJob(job.status, nextStatus)) {
    throw new Error(`Invalid asset job transition: ${job.status} -> ${nextStatus}`);
  }

  const timestamp = now.toISOString();
  const startedAt = job.startedAt ?? (nextStatus === "validating_input" ? timestamp : undefined);
  const completed = nextStatus === "published" || nextStatus === "failed" || nextStatus === "cancelled";

  return {
    ...job,
    status: nextStatus,
    progress: STATUS_PROGRESS[nextStatus],
    updatedAt: timestamp,
    ...(startedAt ? { startedAt } : {}),
    ...(completed ? { completedAt: timestamp } : {}),
    ...(nextStatus === "queued" ? { error: undefined, completedAt: undefined, startedAt: undefined } : {}),
  };
}

export function createAssetJob(input: Pick<AssetJob, "id" | "request">, now = new Date()): AssetJob {
  const timestamp = now.toISOString();
  return {
    id: input.id,
    request: structuredClone(input.request),
    status: "queued",
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    artifacts: [],
  };
}

export function failAssetJob(
  job: AssetJob,
  error: { code: string; message: string; retryable: boolean },
  now = new Date(),
): AssetJob {
  const failed = job.status === "failed" ? job : transitionAssetJob(job, "failed", now);
  return {
    ...failed,
    error: {
      ...error,
      stage: job.status,
    },
  };
}
