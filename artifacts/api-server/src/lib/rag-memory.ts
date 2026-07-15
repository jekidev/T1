import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { recordObservabilityEvent } from "./observability";
import { extractDocumentText, wisdomDocumentExtensions } from "./document-text";
import { projectRoot } from "./project-root";

const root = projectRoot;
const ragRoot = path.resolve(root, "rag");
const runtimeDir = path.resolve(root, ".runtime");
const memoryFile = path.join(runtimeDir, "rag-persistent-memory.json");
const textExtensions = new Set([".md", ".txt", ".text", ".json", ".csv", ".ts", ".tsx", ".js", ".mjs", ".yaml", ".yml"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export interface RagMemoryItem {
  id: string;
  sourcePath: string;
  sha256: string;
  kind: "text" | "image" | "document";
  title: string;
  content: string;
  integratedAt: string;
  sizeBytes: number;
  extraction?: "direct" | "python" | "companion" | "unavailable";
  warning?: string;
}

async function walk(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const output: string[] = [];
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) output.push(...await walk(full));
      else output.push(full);
    }
    return output;
  } catch {
    return [];
  }
}

async function loadMemory(): Promise<RagMemoryItem[]> {
  try { return JSON.parse(await fs.readFile(memoryFile, "utf8")) as RagMemoryItem[]; }
  catch { return []; }
}

async function saveMemory(items: RagMemoryItem[]) {
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.writeFile(memoryFile, JSON.stringify(items, null, 2), "utf8");
}

function titleFromPath(file: string): string {
  return path.basename(file).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

function normalizedPrefix(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").toLowerCase();
}

export async function syncRagIntoPersistentMemory(): Promise<{ added: number; total: number; skipped: number }> {
  await fs.mkdir(ragRoot, { recursive: true });
  const existing = await loadMemory();
  const hashes = new Set(existing.map((item) => item.sha256));
  const files = await walk(ragRoot);
  let added = 0;
  let skipped = 0;

  for (const file of files) {
    const stat = await fs.stat(file);
    if (stat.size > 8_000_000) { skipped += 1; continue; }
    const bytes = await fs.readFile(file);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    if (hashes.has(sha256)) { skipped += 1; continue; }

    const extension = path.extname(file).toLowerCase();
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    let kind: RagMemoryItem["kind"] = "document";
    let content = `Document stored at ${relative}. Text extraction was not available.`;
    let extraction: RagMemoryItem["extraction"] = "unavailable";
    let warning: string | undefined;

    if (textExtensions.has(extension)) {
      kind = "text";
      content = bytes.toString("utf8").slice(0, 120_000);
      extraction = "direct";
    } else if (imageExtensions.has(extension)) {
      kind = "image";
      const companion = `${file}.md`;
      try { content = (await fs.readFile(companion, "utf8")).slice(0, 40_000); extraction = "companion"; }
      catch { content = `Image note stored at ${relative}. No text description has been added yet.`; }
    } else if (wisdomDocumentExtensions.has(extension)) {
      const extracted = await extractDocumentText(file, 120_000);
      content = extracted.content || content;
      extraction = extracted.extraction;
      warning = extracted.warning;
    }

    existing.push({
      id: crypto.randomUUID(),
      sourcePath: relative,
      sha256,
      kind,
      title: titleFromPath(file),
      content,
      integratedAt: new Date().toISOString(),
      sizeBytes: stat.size,
      extraction,
      warning,
    });
    hashes.add(sha256);
    added += 1;
  }

  await saveMemory(existing.slice(-5000));
  recordObservabilityEvent({ source: "system", level: "info", type: "rag.startup-sync", message: `RAG startup sync added ${added} items`, data: { added, skipped, total: existing.length } });
  return { added, skipped, total: existing.length };
}

export async function listRagMemory(): Promise<RagMemoryItem[]> {
  return loadMemory();
}

export async function listRagMemoryByPrefix(prefix: string): Promise<RagMemoryItem[]> {
  const expected = normalizedPrefix(prefix);
  const items = await loadMemory();
  return items.filter((item) => {
    const source = normalizedPrefix(item.sourcePath);
    return source === expected || source.startsWith(`${expected}/`) || source.startsWith(`rag/${expected}/`);
  });
}

export async function getPersistentRagContext(maxCharacters = 24_000, sourcePrefix?: string): Promise<string> {
  const items = sourcePrefix ? await listRagMemoryByPrefix(sourcePrefix) : await loadMemory();
  const selected: string[] = [];
  let length = 0;
  for (const item of [...items].reverse()) {
    const block = `[${item.kind}] ${item.title}\nSource: ${item.sourcePath}\n${item.content}\n`;
    if (length + block.length > maxCharacters) continue;
    selected.push(block);
    length += block.length;
  }
  return selected.join("\n---\n") || "No persistent RAG memory is currently available.";
}
