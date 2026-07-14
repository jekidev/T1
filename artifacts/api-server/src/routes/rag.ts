import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter } from "express";
import { listRagMemory, syncRagIntoPersistentMemory } from "../lib/rag-memory";

const router: IRouter = Router();
const notesDir = path.resolve(process.cwd(), "rag/notes");

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9æøå._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "note";
}

router.get("/rag/memory", async (_req, res): Promise<void> => {
  res.json({ items: await listRagMemory() });
});

router.post("/rag/sync", async (_req, res): Promise<void> => {
  res.json(await syncRagIntoPersistentMemory());
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
  res.status(201).json({ id, notePath: path.relative(process.cwd(), notePath), imagePath: imagePath ? path.relative(process.cwd(), imagePath) : null, sync });
});

export default router;
