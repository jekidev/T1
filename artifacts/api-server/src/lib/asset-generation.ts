import { randomUUID } from "node:crypto";
import {
  AssetJobRequestSchema,
  AssetJobSchema,
  GeneratedAssetMetadataSchema,
  canPublishAsset,
  createAssetJob,
  failAssetJob,
  getAssetProvider,
  selectAvailableGenerator,
  transitionAssetJob,
  validateGeneratedAssetMetadata,
  type AssetArtifact,
  type AssetGenerator,
  type AssetJob,
  type AssetJobRequest,
  type AssetValidationReport,
  type GameAssetManifestEntry,
  type GeneratedAssetMetadata,
} from "@workspace/asset-pipeline";
import { z } from "zod";
import { AssetStorage } from "./asset-storage";
import { logger } from "./logger";
import { withSpan } from "./telemetry";

const WorkerResultSchema = z.object({
  generatorVersion: z.string().min(1).max(80),
  metadata: GeneratedAssetMetadataSchema.partial().optional(),
  notes: z.array(z.string().max(1000)).max(50).optional(),
});

type WorkerRole = AssetGenerator | "blender";

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/webm",
  "model/gltf-binary",
  "model/gltf+json",
  "application/json",
  "application/octet-stream",
]);

export class AssetGenerationManager {
  readonly storage: AssetStorage;
  private readonly queue: string[] = [];
  private processing = false;

  constructor(storage = new AssetStorage()) {
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    const queued = (await this.storage.listJobs(500))
      .filter(job => job.status === "queued")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const job of queued) this.enqueue(job.id);
  }

  async createJob(input: unknown): Promise<AssetJob> {
    const request = AssetJobRequestSchema.parse(input);
    const existing = request.idempotencyKey
      ? (await this.storage.listJobs(500)).find(job => job.request.idempotencyKey === request.idempotencyKey)
      : undefined;
    if (existing) return existing;

    const job = createAssetJob({
      id: `asset-job-${randomUUID()}`,
      request,
    });
    await this.storage.writeJob(job);
    this.enqueue(job.id);
    return job;
  }

  async getJob(id: string): Promise<AssetJob> {
    return this.storage.readJob(id);
  }

  async listJobs(limit = 100): Promise<AssetJob[]> {
    return this.storage.listJobs(limit);
  }

  async addArtifact(jobId: string, kind: AssetArtifact["kind"], content: Buffer, mimeType: string): Promise<AssetJob> {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) throw new Error(`Unsupported artifact MIME type: ${mimeType}`);
    const job = await this.storage.readJob(jobId);
    if (["published", "cancelled"].includes(job.status)) throw new Error(`Cannot add artifacts to ${job.status} job.`);
    const artifact = await this.storage.saveArtifact(jobId, kind, content, mimeType);
    const next: AssetJob = {
      ...job,
      updatedAt: new Date().toISOString(),
      artifacts: [...job.artifacts.filter(item => item.sha256 !== artifact.sha256), artifact],
    };
    await this.storage.writeJob(next);
    return next;
  }

  async cancelJob(id: string): Promise<AssetJob> {
    const job = await this.storage.readJob(id);
    if (["published", "cancelled"].includes(job.status)) return job;
    const cancelled = transitionAssetJob(job, "cancelled");
    await this.storage.writeJob(cancelled);
    return cancelled;
  }

  async retryJob(id: string): Promise<AssetJob> {
    const job = await this.storage.readJob(id);
    if (job.status !== "failed" && job.status !== "cancelled") throw new Error("Only failed or cancelled jobs can be retried.");
    const queued = transitionAssetJob(job, "queued");
    await this.storage.writeJob(queued);
    this.enqueue(id);
    return queued;
  }

  async publishJob(id: string): Promise<AssetJob> {
    const job = await this.storage.readJob(id);
    if (job.status !== "awaiting_review" && job.status !== "validating_output") {
      throw new Error("Job is not ready for publication review.");
    }
    if (!job.metadata || !job.validation) throw new Error("Job has no validated metadata.");
    const gate = canPublishAsset(job.metadata, job.validation);
    if (!gate.allowed) throw new Error(`Publication blocked: ${gate.reasons.join(" ")}`);

    const glb = job.artifacts.find(artifact => artifact.kind === "glb");
    const animation = job.artifacts.find(artifact => artifact.kind === "animation");
    const primary = job.metadata.assetType === "animation" ? animation : glb;
    if (!primary) throw new Error("Validated primary artifact is missing.");
    const preview = job.artifacts.find(artifact => artifact.kind === "preview");

    const published = transitionAssetJob(job, "published");
    const entry: GameAssetManifestEntry = {
      id: job.metadata.id,
      type: job.metadata.assetType,
      path: primary.path,
      ...(preview ? { previewPath: preview.path } : {}),
      preload: false,
      optional: true,
      metadata: job.metadata,
      validation: job.validation,
      ...(published.completedAt ? { publishedAt: published.completedAt } : {}),
    };
    await this.storage.publish(entry);
    await this.storage.writeJob(published);
    return published;
  }

  private enqueue(id: string): void {
    if (!this.queue.includes(id)) this.queue.push(id);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const id = this.queue.shift()!;
        try {
          await this.processJob(id);
        } catch (error) {
          logger.error({ error, assetJobId: id }, "Asset generation job crashed");
          try {
            const current = await this.storage.readJob(id);
            if (current.status === "cancelled" || current.status === "published") continue;
            const failed = failAssetJob(current, {
              code: "pipeline.unhandled",
              message: error instanceof Error ? error.message : String(error),
              retryable: true,
            });
            await this.storage.writeJob(failed);
          } catch (persistError) {
            logger.error({ persistError, assetJobId: id }, "Failed to persist crashed asset job");
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async processJob(id: string): Promise<void> {
    await withSpan("asset.generate", { "asset.job.id": id }, async span => {
      let job = await this.storage.readJob(id);
      if (job.status !== "queued") return;

      job = await this.advance(job, "validating_input");
      await this.validateInput(job);

      job = await this.advance(job, "preprocessing");
      const generator = this.selectGenerator(job.request);
      span.setAttribute("asset.generator", generator);
      job = { ...job, selectedGenerator: generator, updatedAt: new Date().toISOString() };
      await this.storage.writeJob(job);

      job = await this.advance(job, "generating");
      const generationResult = await this.invokeWorker(generator, job, "generate");
      job = await this.storage.readJob(id);
      if (job.status === "cancelled") return;

      job = await this.advance(job, "blender_processing");
      const blenderResult = await this.invokeBlender(job);
      job = await this.storage.readJob(id);
      if (job.status === "cancelled") return;

      job = await this.advance(job, "validating_output");
      const metadata = this.buildMetadata(job, generator, generationResult, blenderResult);
      const validation = this.validateOutput(job, metadata);
      job = { ...job, metadata, validation, updatedAt: new Date().toISOString() };
      await this.storage.writeJob(job);

      const autoPublish = job.request.publishAfterValidation
        && canPublishAsset(metadata, validation).allowed;
      if (autoPublish) {
        await this.publishJob(id);
      } else {
        await this.storage.writeJob(transitionAssetJob(job, "awaiting_review"));
      }
    });
  }

  private async validateInput(job: AssetJob): Promise<void> {
    if (job.request.kind === "human_character" && !job.request.faceSourceAssetId) return;
    const sourceId = sourceIdForRequest(job.request);
    if (!sourceId) throw new Error("Source asset is required.");
    const source = await this.storage.readSource(sourceId);
    const isImage = source.metadata.mimeType.startsWith("image/");
    const isVideo = source.metadata.mimeType.startsWith("video/");
    if (job.request.kind === "image_to_3d" && !isImage) throw new Error("Image-to-3D jobs require an image source.");
    if (job.request.kind === "human_character" && !isImage) throw new Error("Face-assisted human jobs require an image source.");
    if (job.request.kind === "video_to_animation" && !isVideo) throw new Error("Video-to-animation jobs require a video source.");
    if (source.metadata.byteLength > maximumSourceBytes(job.request.kind)) throw new Error("Source asset exceeds the configured size limit.");
  }

  private selectGenerator(request: AssetJobRequest): AssetGenerator {
    const available = new Set<AssetGenerator>();
    for (const generator of request.generatorPreference) {
      const typed = generator as AssetGenerator;
      if (workerEndpoint(typed)) available.add(typed);
    }
    const selected = selectAvailableGenerator(request.generatorPreference as AssetGenerator[], available);
    if (!selected) {
      throw new Error(`No configured worker is available for: ${request.generatorPreference.join(", ")}`);
    }
    getAssetProvider(selected);
    return selected;
  }

  private async invokeWorker(generator: AssetGenerator, job: AssetJob, operation: string): Promise<z.infer<typeof WorkerResultSchema>> {
    const endpoint = workerEndpoint(generator);
    if (!endpoint) throw new Error(`Worker endpoint is not configured for ${generator}.`);
    return this.postWorker(endpoint, operation, job, generator);
  }

  private async invokeBlender(job: AssetJob): Promise<z.infer<typeof WorkerResultSchema>> {
    const endpoint = process.env.ASSET_BLENDER_WORKER_URL;
    if (!endpoint) throw new Error("ASSET_BLENDER_WORKER_URL is required for optimization, LOD, retargeting and GLB validation.");
    return this.postWorker(endpoint, "process", job, "blender");
  }

  private async postWorker(
    endpoint: string,
    operation: string,
    job: AssetJob,
    role: WorkerRole,
  ): Promise<z.infer<typeof WorkerResultSchema>> {
    const baseUrl = requirePublicBaseUrl();
    const sourceId = sourceIdForRequest(job.request);
    const token = requireWorkerToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), workerTimeoutMs());
    try {
      const response = await fetch(new URL(`/v1/${operation}`, endpoint), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schemaVersion: 1,
          job,
          role,
          generator: job.selectedGenerator,
          source: sourceId ? {
            id: sourceId,
            downloadUrl: `${baseUrl}/api/asset-generation/worker/sources/${encodeURIComponent(sourceId)}`,
          } : undefined,
          artifactUploadBaseUrl: `${baseUrl}/api/asset-generation/worker/jobs/${encodeURIComponent(job.id)}/artifacts`,
          artifactUploadHeader: "x-asset-worker-token",
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Worker ${role} returned HTTP ${response.status}.`);
      return WorkerResultSchema.parse(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildMetadata(
    job: AssetJob,
    generator: AssetGenerator,
    generation: z.infer<typeof WorkerResultSchema>,
    blender: z.infer<typeof WorkerResultSchema>,
  ): GeneratedAssetMetadata {
    const merged = { ...generation.metadata, ...blender.metadata };
    const assetType = job.request.kind === "human_character"
      ? "character"
      : job.request.kind === "video_to_animation"
        ? "animation"
        : job.request.assetType;
    const skeletonId = job.request.kind === "human_character" || job.request.kind === "video_to_animation"
      ? merged.skeletonId ?? job.request.skeletonId
      : undefined;

    return GeneratedAssetMetadataSchema.parse({
      id: merged.id ?? `generated-${job.id}`,
      sourceType: job.request.kind === "video_to_animation" ? "video" : job.request.kind === "human_character" ? "procedural" : "image",
      sourceProvider: job.request.sourceProvider,
      generator,
      generatorVersion: blender.generatorVersion || generation.generatorVersion,
      seed: job.request.seed,
      licenseStatus: job.request.licenseStatus,
      assetType,
      polygonCount: merged.polygonCount ?? 0,
      textureMemoryBytes: merged.textureMemoryBytes ?? 0,
      lodCount: merged.lodCount ?? 1,
      ...(skeletonId ? { skeletonId } : {}),
      createdAt: new Date().toISOString(),
    });
  }

  private validateOutput(job: AssetJob, metadata: GeneratedAssetMetadata): AssetValidationReport {
    const metadataReport = validateGeneratedAssetMetadata(metadata);
    const hasPreview = job.artifacts.some(artifact => artifact.kind === "preview");
    const hasPrimary = metadata.assetType === "animation"
      ? job.artifacts.some(artifact => artifact.kind === "animation")
      : job.artifacts.some(artifact => artifact.kind === "glb");
    const issues = [...metadataReport.issues];
    if (!hasPreview) issues.push({ code: "artifact.preview_missing", severity: "error", message: "Preview artifact is required." });
    if (!hasPrimary) issues.push({ code: "artifact.primary_missing", severity: "error", message: "Primary GLB or animation artifact is required." });
    return {
      ...metadataReport,
      valid: metadataReport.valid && hasPreview && hasPrimary,
      issues,
      checks: {
        ...metadataReport.checks,
        gltf: hasPrimary,
        ...(metadata.assetType === "animation" ? { animation: hasPrimary } : {}),
      },
    };
  }

  private async advance(job: AssetJob, status: AssetJob["status"]): Promise<AssetJob> {
    const next = transitionAssetJob(job, status);
    await this.storage.writeJob(next);
    return next;
  }
}

export const assetGenerationManager = new AssetGenerationManager();

function sourceIdForRequest(request: AssetJobRequest): string | undefined {
  if (request.kind === "human_character") return request.faceSourceAssetId;
  return request.sourceAssetId;
}

function workerEndpoint(generator: AssetGenerator): string | undefined {
  const envKey = `ASSET_WORKER_${generator.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`;
  return process.env[envKey];
}

function requireWorkerToken(): string {
  const token = process.env.ASSET_WORKER_TOKEN;
  if (!token || token.length < 24) throw new Error("ASSET_WORKER_TOKEN must contain at least 24 characters.");
  return token;
}

function requirePublicBaseUrl(): string {
  const value = process.env.PUBLIC_BASE_URL;
  if (!value) throw new Error("PUBLIC_BASE_URL is required for remote asset workers.");
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("PUBLIC_BASE_URL must use HTTP or HTTPS.");
  return url.toString().replace(/\/$/, "");
}

function workerTimeoutMs(): number {
  const value = Number(process.env.ASSET_WORKER_TIMEOUT_MS ?? 30 * 60 * 1000);
  return Number.isFinite(value) && value >= 10_000 ? value : 30 * 60 * 1000;
}

function maximumSourceBytes(kind: AssetJobRequest["kind"]): number {
  if (kind === "video_to_animation") return 500 * 1024 * 1024;
  return 25 * 1024 * 1024;
}

export function isValidWorkerToken(value: string | undefined): boolean {
  const expected = process.env.ASSET_WORKER_TOKEN;
  if (!expected || !value || expected.length !== value.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ value.charCodeAt(index);
  }
  return mismatch === 0;
}

export function parseAssetJob(input: unknown): AssetJob {
  return AssetJobSchema.parse(input);
}
