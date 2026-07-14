import express, { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  ASSET_PROVIDER_CATALOG,
  AssetArtifactSchema,
  AssetJobRequestSchema,
} from "@workspace/asset-pipeline";
import {
  assetGenerationManager,
  isValidWorkerToken,
} from "../lib/asset-generation";
import { logger } from "../lib/logger";
import { withSpan } from "../lib/telemetry";

const router: IRouter = Router();
const sourceUpload = express.raw({
  type: ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"],
  limit: "500mb",
});
const artifactUpload = express.raw({ type: () => true, limit: "750mb" });
const ArtifactKindSchema = AssetArtifactSchema.shape.kind;

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

router.post("/asset-generation/sources", sourceUpload, async (req, res): Promise<void> => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.byteLength === 0) {
      res.status(400).json({ error: "A supported image or video body is required." });
      return;
    }
    const mimeType = normalizeMimeType(req.headers["content-type"]);
    if (!mimeType || !isSupportedSourceMimeType(mimeType)) {
      res.status(415).json({ error: "Supported source types are PNG, JPEG, WebP, MP4 and WebM." });
      return;
    }
    const originalName = firstHeader(req, "x-file-name");
    const source = await withSpan("asset.source.upload", {
      "asset.source.mime_type": mimeType,
      "asset.source.bytes": req.body.byteLength,
    }, () => assetGenerationManager.storage.saveSource(req.body, mimeType, originalName));
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
    await sendArtifact(req.params.id, req.params.sha, res, "private, max-age=300");
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
    const { metadata, content } = await assetGenerationManager.storage.readSource(req.params.id);
    res.setHeader("Content-Type", metadata.mimeType);
    res.setHeader("Content-Length", String(content.byteLength));
    res.setHeader("X-Content-SHA256", metadata.sha256);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(content);
  } catch (error) {
    sendError(res, error, 404);
  }
});

router.get(
  "/asset-generation/worker/jobs/:id/artifacts/:sha",
  requireWorker,
  async (req, res): Promise<void> => {
    try {
      await sendArtifact(req.params.id, req.params.sha, res, "private, no-store");
    } catch (error) {
      sendError(res, error, 404);
    }
  },
);

router.put(
  "/asset-generation/worker/jobs/:id/artifacts/:kind",
  requireWorker,
  artifactUpload,
  async (req, res): Promise<void> => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.byteLength === 0) {
        res.status(400).json({ error: "Artifact body is required." });
        return;
      }
      const kind = ArtifactKindSchema.parse(req.params.kind);
      const declaredMimeType = firstHeader(req, "x-artifact-mime-type");
      const mimeType = normalizeMimeType(declaredMimeType ?? req.headers["content-type"]) ?? "application/octet-stream";
      const job = await withSpan("asset.artifact.upload", {
        "asset.job.id": req.params.id,
        "asset.artifact.kind": kind,
        "asset.artifact.mime_type": mimeType,
        "asset.artifact.bytes": req.body.byteLength,
      }, () => assetGenerationManager.addArtifact(req.params.id, kind, req.body, mimeType));
      const artifact = job.artifacts.at(-1);
      res.status(201).json({ artifact });
    } catch (error) {
      sendError(res, error, 400);
    }
  },
);

async function sendArtifact(jobId: string, sha: string, res: Response, cacheControl: string): Promise<void> {
  const { artifact, content } = await assetGenerationManager.storage.readArtifact(jobId, sha);
  res.setHeader("Content-Type", artifact.mimeType);
  res.setHeader("Content-Length", String(content.byteLength));
  res.setHeader("X-Content-SHA256", artifact.sha256);
  res.setHeader("Cache-Control", cacheControl);
  res.send(content);
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
  res.status(status).json({ error: message });
}

export default router;
