import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { recordObservabilityEvent } from "./observability";

const root = process.cwd();
const ragRoot = path.resolve(root, "rag");
const runtimeDir = path.resolve(root, ".runtime");
const memoryFile = path.join(runtimeDir, "rag-persistent-memory.json");
const textExtensions = new Set([".md", ".txt", ".json", ".jsonl", ".csv", ".ts", ".tsx", ".js", ".mjs", ".yaml", ".yml"]);
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
}

export interface RagSyncResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
  skipped: number;
  rebuilt: boolean;
}

async function walk(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const output: string[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) output.push(...await walk(full));
      else if (entry.isFile()) output.push(full);
    }
    return output;
  } catch {
    return [];
  }
}

async function loadMemory(): Promise<RagMemoryItem[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(memoryFile, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isMemoryItem) : [];
  } catch {
    return [];
  }
}

async function saveMemory(items: RagMemoryItem[]): Promise<void> {
  await fs.mkdir(runtimeDir, { recursive: true });
  const temporary = `${memoryFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(items, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, memoryFile);
}

function titleFromPath(file: string): string {
  return path.basename(file).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

export async function syncRagIntoPersistentMemory(options: { rebuild?: boolean } = {}): Promise<RagSyncResult> {
  await fs.mkdir(ragRoot, { recursive: true });
  const previous = await loadMemory();
  const previousByPath = new Map(previous.map(item => [item.sourcePath, item]));
  const files = await walk(ragRoot);
  const next: RagMemoryItem[] = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      skipped += 1;
      continue;
    }
    if (!stat.isFile() || stat.size > 8_000_000) {
      skipped += 1;
      continue;
    }

    const bytes = await fs.readFile(file);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const extension = path.extname(file).toLowerCase();
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    const previousItem = previousByPath.get(relative);

    if (!options.rebuild && previousItem?.sha256 === sha256) {
      next.push(previousItem);
      skipped += 1;
      continue;
    }

    let kind: RagMemoryItem["kind"] = "document";
    let content = `Document stored at ${relative}. Binary extraction is not available for this file type yet.`;
    if (textExtensions.has(extension)) {
      kind = "text";
      content = bytes.toString("utf8").slice(0, 120_000);
    } else if (imageExtensions.has(extension)) {
      kind = "image";
      const companion = `${file}.md`;
      try {
        content = (await fs.readFile(companion, "utf8")).slice(0, 40_000);
      } catch {
        content = `Image note stored at ${relative}. No text description has been added yet.`;
      }
    }

    next.push({
      id: previousItem?.id ?? crypto.randomUUID(),
      sourcePath: relative,
      sha256,
      kind,
      title: titleFromPath(file),
      content,
      integratedAt: new Date().toISOString(),
      sizeBytes: stat.size,
    });
    if (previousItem) updated += 1;
    else added += 1;
  }

  const activePaths = new Set(next.map(item => item.sourcePath));
  const removed = previous.filter(item => !activePaths.has(item.sourcePath)).length;
  next.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  await saveMemory(next.slice(-5000));

  const result: RagSyncResult = {
    added,
    updated,
    removed,
    total: next.length,
    skipped,
    rebuilt: Boolean(options.rebuild),
  };
  recordObservabilityEvent({
    source: "system",
    level: "info",
    type: options.rebuild ? "rag.world-rebuild" : "rag.startup-sync",
    message: `${options.rebuild ? "RAG world rebuild" : "RAG sync"} indexed ${next.length} source files`,
    data: result,
  });
  return result;
}

export async function listRagMemory(): Promise<RagMemoryItem[]> {
  return loadMemory();
}

export async function getPersistentRagContext(maxCharacters = 24_000): Promise<string> {
  const items = await loadMemory();
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

function isMemoryItem(value: unknown): value is RagMemoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RagMemoryItem>;
  return typeof item.id === "string"
    && typeof item.sourcePath === "string"
    && typeof item.sha256 === "string"
    && typeof item.title === "string"
    && typeof item.content === "string"
    && typeof item.integratedAt === "string"
    && typeof item.sizeBytes === "number"
    && (item.kind === "text" || item.kind === "image" || item.kind === "document");
}
