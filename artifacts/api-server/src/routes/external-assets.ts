import { createReadStream } from "node:fs";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  externalAssetLibrary,
  isNetworkApprovalRequired,
  type ExternalAssetLicense,
} from "../lib/external-asset-library";
import { getWorkspaceSession, type WorkspaceSession } from "../lib/workspace-session";

const router: IRouter = Router();
const LicenseSchema = z.enum(["unverified", "restricted"]);
const NetworkHeadersSchema = z.object({
  sessionId: z.string().min(1),
  token: z.string().min(1),
});

router.get("/external-assets/capabilities", (req, res): void => {
  const session = getWorkspaceSession(req, res);
  res.json({
    ownerId: ownerId(session),
    figma: { configured: Boolean(process.env.FIGMA_ACCESS_TOKEN?.trim()), auth: "server-secret" },
    huggingFace: { configured: Boolean(process.env.HUGGINGFACE_TOKEN?.trim() || process.env.HF_TOKEN?.trim()), auth: "server-secret-or-public" },
    vercel: {
      detected: Boolean(process.env.VERCEL),
      configured: Boolean(process.env.VERCEL_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim()),
      persistenceMode: process.env.VERCEL ? "ephemeral-until-external-storage-is-configured" : "local-filesystem",
    },
  });
});

router.get("/external-assets", async (req, res): Promise<void> => {
  try {
    const session = getWorkspaceSession(req, res);
    res.json({ assets: await externalAssetLibrary.list(ownerId(session)) });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/external-assets/figma", async (req, res): Promise<void> => {
  try {
    const session = getWorkspaceSession(req, res);
    const body = z.object({
      fileKey: z.string().min(1).max(160),
      nodeId: z.string().min(1).max(160),
      format: z.enum(["png", "jpg", "svg"]).default("png"),
      scale: z.coerce.number().min(0.5).max(4).default(2),
      licenseStatus: LicenseSchema.default("unverified"),
    }).parse(req.body);
    const asset = await externalAssetLibrary.importFigma({
      ownerId: ownerId(session),
      ...body,
      licenseStatus: body.licenseStatus as ExternalAssetLicense,
      network: networkCredentials(req),
    });
    res.status(201).json({ asset });
  } catch (error) {
    respondError(res, error);
  }
});

router.post("/external-assets/huggingface", async (req, res): Promise<void> => {
  try {
    const session = getWorkspaceSession(req, res);
    const body = z.object({
      repoId: z.string().min(3).max(240),
      repoType: z.enum(["model", "dataset", "space"]).default("model"),
      revision: z.string().min(1).max(160).default("main"),
      file: z.string().min(1).max(500),
      licenseStatus: LicenseSchema.default("unverified"),
    }).parse(req.body);
    const asset = await externalAssetLibrary.importHuggingFace({
      ownerId: ownerId(session),
      ...body,
      licenseStatus: body.licenseStatus as ExternalAssetLicense,
      network: networkCredentials(req),
    });
    res.status(201).json({ asset });
  } catch (error) {
    respondError(res, error);
  }
});

router.get("/external-assets/:id/content", async (req, res): Promise<void> => {
  try {
    const session = getWorkspaceSession(req, res);
    const record = await externalAssetLibrary.get(ownerId(session), req.params.id);
    const source = await externalAssetLibrary.storage.getSource(record.sourceAssetId);
    res.setHeader("Content-Type", source.mimeType);
    res.setHeader("Content-Length", String(source.byteLength));
    res.setHeader("X-Content-SHA256", source.sha256);
    res.setHeader("Cache-Control", "private, max-age=300");
    const stream = createReadStream(source.path);
    stream.on("error", error => {
      if (!res.headersSent) res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    respondError(res, error, 404);
  }
});

function ownerId(session: WorkspaceSession): string {
  return session.githubUser?.login || session.googleUser?.email || session.id;
}

function networkCredentials(req: Request): { sessionId: string; token: string } {
  return NetworkHeadersSchema.parse({
    sessionId: headerValue(req, "x-network-session-id"),
    token: headerValue(req, "x-network-session-token"),
  });
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function respondError(res: Response, error: unknown, fallbackStatus = 400): void {
  if (isNetworkApprovalRequired(error)) {
    res.status(409).json({
      error: error.message,
      code: "network_approval_required",
      approval: error.approval,
    });
    return;
  }
  res.status(fallbackStatus).json({ error: error instanceof Error ? error.message : String(error) });
}

export default router;
