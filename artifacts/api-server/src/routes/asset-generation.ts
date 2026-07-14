import { createReadStream } from "node:fs";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  ASSET_PROVIDER_CATALOG,
  AssetArtifactSchema,
  AssetJobRequestSchema,
  type AssetJob,
} from "@workspace/asset-pipeline";
import {
  assetGenerationManager,
  isValidWorkerToken,
} from "../lib/asset-generation";
import { logger } from "../lib/logger";
import { withSpan } from "../lib/telemetry";

const router: IRouter = Router();
const ArtifactKindSchema = AssetArtifactSchema.shape.kind;
const ALLOWED_ARTIFACT_MIME_TYPES = new Set([
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

void assetGenerationManager.initialize().catch(error => {
  logger.error({ error }, "Asset generation manager initialization failed");
});

router.get("/asset-generation/capabilities", (_req, res): void => {
  const providers = ASSET_PROVIDER_CATALOG.map(provider => ({
    ...provider,
    configured: provider.runtime === "blender-worker"
      ? Boolean(process.env.ASSET_BLENDER_WORKER_URL)
      : Boolean(process.env[workerEnvironmentKey(provider.id)]),
  }));
  res.json({
    providers,
    blenderConfigured: Boolean(process.env.ASSET_BLENDER_WORKER_URL),
    publicBaseUrlConfigured: Boolean(process.env.PUBLIC_BASE_URL),
    workerAuthenticationConfigured: Boolean(process.env.ASSET_WORKER_TOKEN),
  });
});

router.post("/asset-generation/sources", async (req, res): Promise<void> => {
  try {
    const mimeType = normalizeMimeType(req.headers["content-type"]);
    if (!mimeType || !isSupportedSourceMimeType(mimeType)) {
      res.status(415).json({ error: "Supported source types are PNG, JPEG, WebP, MP4 and WebM." });
      return;
    }
    const originalName = firstHeader(req, "x-file-name");
    const maximumBytes = mimeType.startsWith("video/") ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
    const source = await withSpan("asset.source.upload", {
      "asset.source.mime_type": mimeType,
      "asset.source.maximum_bytes": maximumBytes,
    }, () => assetGenerationManager.storage.saveSourceStream(
      req as AsyncIterable<Uint8Array>,
      mimeType,
      originalName,
      maximumBytes,
    ));
    res.status(201).json({ source });
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.post("/asset-generation/jobs", async (req, res): Promise<void> => {
  try {
    const request = AssetJobRequestSchema.parse(req.body);
    const job = await withSpan("asset.job.create", {
      "asset.job.kind": request.kind,
      "asset.license.status": request.licenseStatus,
    }, () => assetGenerationManager.createJob(request));
    res.status(202).json({ job });
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.get("/asset-generation/jobs", async (req, res): Promise<void> => {
  try {
    const limit = Number(req.query.limit ?? 100);
    res.json({ jobs: await assetGenerationManager.listJobs(limit) });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/asset-generation/jobs/:id", async (req, res): Promise<void> => {
  try {
    res.json({ job: await assetGenerationManager.getJob(req.params.id) });
  } catch (error) {
    sendError(res, error, 404);
  }
});

router.post("/asset-generation/jobs/:id/cancel", async (req, res): Promise<void> => {
  try {
    res.json({ job: await assetGenerationManager.cancelJob(req.params.id) });
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.post("/asset-generation/jobs/:id/retry", async (req, res): Promise<void> => {
  try {
    res.status(202).json({ job: await assetGenerationManager.retryJob(req.params.id) });
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.post("/asset-generation/jobs/:id/publish", async (req, res): Promise<void> => {
  try {
    const job = await withSpan("asset.publish", { "asset.job.id": req.params.id }, () =>
      assetGenerationManager.publishJob(req.params.id));
    res.json({ job });
  } catch (error) {
    sendError(res, error, 409);
  }
});

router.get("/asset-generation/jobs/:id/artifacts/:sha", async (req, res): Promise<void> => {
  try {
    const artifact = await assetGenerationManager.storage.getArtifact(req.params.id, req.params.sha);
    streamStoredFile(res, artifact.path, artifact.mimeType, artifact.byteLength, artifact.sha256, "private, max-age=300");
  } catch (error) {
    sendError(res, error, 404);
  }
});

router.get("/asset-generation/manifest", async (_req, res): Promise<void> => {
  try {
    res.json({ assets: await assetGenerationManager.storage.readManifest() });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/asset-generation/worker/sources/:id", requireWorker, async (req, res): Promise<void> => {
  try {
    const metadata = await assetGenerationManager.storage.getSource(req.params.id);
    streamStoredFile(res, metadata.path, metadata.mimeType, metadata.byteLength, metadata.sha256, "private, no-store");
  } catch (error) {
    sendError(res, error, 404);
  }
});

router.get(
  "/asset-generation/worker/jobs/:id/artifacts/:sha",
  requireWorker,
  async (req, res): Promise<void> => {
    try {
      const artifact = await assetGenerationManager.storage.getArtifact(req.params.id, req.params.sha);
      streamStoredFile(res, artifact.path, artifact.mimeType, artifact.byteLength, artifact.sha256, "private, no-store");
    } catch (error) {
      sendError(res, error, 404);
    }
  },
);

router.put(
  "/asset-generation/worker/jobs/:id/artifacts/:kind",
  requireWorker,
  async (req, res): Promise<void> => {
    try {
      const kind = ArtifactKindSchema.parse(req.params.kind);
      const declaredMimeType = firstHeader(req, "x-artifact-mime-type");
      const mimeType = normalizeMimeType(declaredMimeType ?? req.headers["content-type"]) ?? "application/octet-stream";
      if (!ALLOWED_ARTIFACT_MIME_TYPES.has(mimeType)) {
        res.status(415).json({ error: `Unsupported artifact MIME type: ${mimeType}` });
        return;
      }
      const maximumBytes = 750 * 1024 * 1024;
      const job = await assetGenerationManager.getJob(req.params.id);
      if (["published", "cancelled"].includes(job.status)) {
        res.status(409).json({ error: `Cannot add artifacts to ${job.status} job.` });
        return;
      }
      const artifact = await withSpan("asset.artifact.upload", {
        "asset.job.id": req.params.id,
        "asset.artifact.kind": kind,
        "asset.artifact.mime_type": mimeType,
        "asset.artifact.maximum_bytes": maximumBytes,
      }, () => assetGenerationManager.storage.saveArtifactStream(
        req.params.id,
        kind,
        req as AsyncIterable<Uint8Array>,
        mimeType,
        maximumBytes,
      ));
      const next: AssetJob = {
        ...job,
        updatedAt: new Date().toISOString(),
        artifacts: [...job.artifacts.filter(item => item.sha256 !== artifact.sha256), artifact],
      };
      await assetGenerationManager.storage.writeJob(next);
      res.status(201).json({ artifact });
    } catch (error) {
      sendError(res, error, 400);
    }
  },
);

function streamStoredFile(
  res: Response,
  filePath: string,
  mimeType: string,
  byteLength: number,
  sha256: string,
  cacheControl: string,
): void {
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", String(byteLength));
  res.setHeader("X-Content-SHA256", sha256);
  res.setHeader("Cache-Control", cacheControl);
  const stream = createReadStream(filePath);
  stream.on("error", error => {
    logger.error({ error, filePath }, "Stored asset stream failed");
    if (!res.headersSent) res.status(500).json({ error: "Stored asset stream failed." });
    else res.destroy(error);
  });
  stream.pipe(res);
}

function requireWorker(req: Request, res: Response, next: () => void): void {
  const headerToken = firstHeader(req, "x-asset-worker-token");
  const authorization = firstHeader(req, "authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!isValidWorkerToken(headerToken ?? bearer)) {
    res.status(401).json({ error: "Invalid asset worker credential." });
    return;
  }
  next();
}

function normalizeMimeType(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(";", 1)[0]?.trim().toLowerCase();
}

function firstHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function isSupportedSourceMimeType(value: string): boolean {
  return ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"].includes(value);
}

function workerEnvironmentKey(providerId: string): string {
  return `ASSET_WORKER_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`;
}

function sendError(res: Response, error: unknown, status = 500): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation failed.",
      issues: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  logger.warn({ status, message }, "Asset generation request failed");
  if (!res.headersSent) res.status(status).json({ error: message });
}

export default router;
