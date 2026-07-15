import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { listRagMemory, syncRagIntoPersistentMemory } from "../lib/rag-memory";
import {
  calculateRagRevision,
  importArtOfWar,
  importHuggingFaceTextFiles,
  isNetworkApprovalRequired,
  type NetworkSessionCredentials,
} from "../lib/rag-imports";

const router: IRouter = Router();
const notesDir = path.resolve(process.cwd(), "rag/notes");

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9æøå._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "note";
}

router.get("/rag/memory", async (_req, res): Promise<void> => {
  res.json({ items: await listRagMemory() });
});

router.post("/rag/sync", async (_req, res): Promise<void> => {
  const sync = await syncRagIntoPersistentMemory();
  res.json({ ...sync, ragRevision: await calculateRagRevision() });
});

router.post("/rag/update-world", async (_req, res): Promise<void> => {
  const sync = await syncRagIntoPersistentMemory({ rebuild: true });
  const items = await listRagMemory();
  res.json({
    ...sync,
    ragRevision: await calculateRagRevision(),
    itemCount: items.length,
    npcUpdateMode: "next_deterministic_tick",
    message: "Persistent RAG was fully rebuilt from the source files without modifying them. NPCs can now store the new revision and retrieve role-relevant context on their next deterministic update.",
  });
});

router.post("/rag/import/art-of-war", async (req, res): Promise<void> => {
  try {
    const body = z.object({ accountName: z.string().min(1).max(100) }).parse(req.body);
    res.status(201).json(await importArtOfWar({ accountName: body.accountName, network: networkCredentials(req) }));
  } catch (error) {
    sendImportError(res, error);
  }
});

router.post("/rag/import/huggingface", async (req, res): Promise<void> => {
  try {
    const body = z.object({
      accountName: z.string().min(1).max(100),
      repoId: z.string().min(3).max(240),
      revision: z.string().min(1).max(160).default("main"),
      files: z.array(z.string().min(1).max(500)).min(1).max(20),
    }).parse(req.body);
    res.status(201).json(await importHuggingFaceTextFiles({ ...body, network: networkCredentials(req) }));
  } catch (error) {
    sendImportError(res, error);
  }
});

router.post("/rag/notes", async (req, res): Promise<void> => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 200) : "";
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 100_000) : "";
  const imageDataUrl = typeof req.body?.imageDataUrl === "string" ? req.body.imageDataUrl : "";
  const imageName = typeof req.body?.imageName === "string" ? req.body.imageName : "image";
  if (!title || (!text && !imageDataUrl)) {
    res.status(422).json({ message: "title and text or imageDataUrl are required" });
    return;
  }

  await fs.mkdir(notesDir, { recursive: true });
  const id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const base = `${id}-${safeName(title)}`;
  const metadata = [`# ${title}`, "", `Created: ${new Date().toISOString()}`, "", text || "No text note supplied."];
  let imagePath: string | null = null;

  if (imageDataUrl) {
    const match = imageDataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
    if (!match) {
      res.status(422).json({ message: "Unsupported image data URL" });
      return;
    }
    const extension = match[1] === "jpeg" ? "jpg" : match[1]!.toLowerCase();
    const bytes = Buffer.from(match[2]!, "base64");
    if (bytes.length > 8_000_000) {
      res.status(413).json({ message: "Image exceeds 8 MB" });
      return;
    }
    imagePath = path.join(notesDir, `${base}.${extension}`);
    await fs.writeFile(imagePath, bytes);
    metadata.push("", `Image: ${path.basename(imagePath)}`, `Original name: ${imageName}`);
    await fs.writeFile(`${imagePath}.md`, metadata.join("\n"), "utf8");
  }

  const notePath = path.join(notesDir, `${base}.md`);
  await fs.writeFile(notePath, metadata.join("\n"), "utf8");
  const sync = await syncRagIntoPersistentMemory();
  res.status(201).json({ id, notePath: path.relative(process.cwd(), notePath), imagePath: imagePath ? path.relative(process.cwd(), imagePath) : null, sync, ragRevision: await calculateRagRevision() });
});

function networkCredentials(req: Request): NetworkSessionCredentials {
  const sessionHeader = req.headers["x-network-session-id"];
  const tokenHeader = req.headers["x-network-session-token"];
  const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (!sessionId || !token) throw new Error("X-Network-Session-Id and X-Network-Session-Token are required for internet imports.");
  return { sessionId, token };
}

function sendImportError(res: Response, error: unknown): void {
  if (isNetworkApprovalRequired(error)) {
    res.status(409).json({
      error: error.message,
      code: "network_approval_required",
      approval: error.approval,
    });
    return;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed.", issues: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
    return;
  }
  res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
}

export default router;
