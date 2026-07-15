import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { assetGenerationManager } from "../lib/asset-generation";
import { findWorkspaceSession, type WorkspaceSession } from "../lib/workspace-session";

const router: IRouter = Router();
const INDEX_PATH = path.resolve(process.env.WORKSPACE_ASSET_INDEX_PATH ?? "data/workspace-assets/index.json");
let writeChain = Promise.resolve();

interface WorkspaceAssetRecord {
  id: string;
  owner: string;
  name: string;
  mimeType: string;
  sourceId: string;
  sourceUrl: string;
  origin: "upload" | "chatgpt" | "grok" | "other";
  createdAt: string;
  updatedAt: string;
}

const AssetInputSchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(300),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]),
  sourceId: z.string().trim().min(1).max(240),
  origin: z.enum(["upload", "chatgpt", "grok", "other"]),
  createdAt: z.string().datetime().optional(),
});

router.get("/workspace/assets", async (req, res): Promise<void> => {
  try {
    const owner = requireAssetOwner(req);
    const records = await readIndex();
    res.json({
      assets: records
        .filter(record => record.owner === owner)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(publicAsset),
    });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/workspace/assets", async (req, res): Promise<void> => {
  try {
    const owner = requireAssetOwner(req);
    const input = AssetInputSchema.parse(req.body ?? {});
    const source = await assetGenerationManager.storage.getSource(input.sourceId);
    if (source.mimeType !== input.mimeType) throw new Error("Asset MIME type does not match the stored source.");
    const now = new Date().toISOString();
    const record: WorkspaceAssetRecord = {
      ...input,
      owner,
      sourceUrl: `/api/asset-generation/sources/${encodeURIComponent(input.sourceId)}`,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    };
    await mutateIndex(records => [
      record,
      ...records.filter(existing => !(existing.owner === owner && existing.id === record.id)),
    ]);
    res.status(201).json({ asset: publicAsset(record) });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.delete("/workspace/assets/:id", async (req, res): Promise<void> => {
  try {
    const owner = requireAssetOwner(req);
    const id = z.string().trim().min(1).max(160).parse(req.params.id);
    let removed = false;
    await mutateIndex(records => records.filter(record => {
      const match = record.owner === owner && record.id === id;
      if (match) removed = true;
      return !match;
    }));
    res.status(removed ? 200 : 404).json({ removed });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/asset-generation/sources/:id", async (req, res): Promise<void> => {
  try {
    const source = await assetGenerationManager.storage.getSource(req.params.id);
    res.setHeader("Content-Type", source.mimeType);
    res.setHeader("Content-Length", String(source.byteLength));
    res.setHeader("X-Content-SHA256", source.sha256);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const stream = createReadStream(source.path);
    stream.on("error", error => {
      if (!res.headersSent) res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

function requireAssetOwner(req: Request): string {
  const session = findWorkspaceSession(req);
  if (!session) throw new Error("Workspace session is missing or expired.");
  if (!isPreflightReady(session)) throw new Error("Complete and test the mandatory workspace preflight before using the shared asset library.");
  const login = session.githubUser?.login?.trim().toLowerCase();
  if (!login) throw new Error("GitHub authentication is required for the shared asset library.");
  return `github:${login}`;
}

function isPreflightReady(session: WorkspaceSession): boolean {
  const tests = session.tests;
  return tests.github && tests.gmail && tests.drive && tests.googleMaps && tests.openRouter && tests.proxy;
}

function publicAsset(record: WorkspaceAssetRecord) {
  const { owner: _owner, updatedAt, ...asset } = record;
  return { ...asset, updatedAt };
}

async function readIndex(): Promise<WorkspaceAssetRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(INDEX_PATH, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWorkspaceAssetRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function mutateIndex(update: (records: WorkspaceAssetRecord[]) => WorkspaceAssetRecord[]): Promise<void> {
  const previous = writeChain;
  let release: (() => void) | undefined;
  writeChain = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const next = update(await readIndex()).slice(0, 50_000);
    await mkdir(path.dirname(INDEX_PATH), { recursive: true });
    const temporary = `${INDEX_PATH}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
      await rename(temporary, INDEX_PATH);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  } finally {
    release?.();
  }
}

function isWorkspaceAssetRecord(value: unknown): value is WorkspaceAssetRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.owner === "string"
    && typeof record.name === "string"
    && typeof record.mimeType === "string"
    && typeof record.sourceId === "string"
    && typeof record.sourceUrl === "string"
    && ["upload", "chatgpt", "grok", "other"].includes(String(record.origin))
    && typeof record.createdAt === "string"
    && typeof record.updatedAt === "string";
}

export default router;
