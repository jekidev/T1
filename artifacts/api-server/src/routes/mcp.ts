import fs from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
const runtimeDir = path.resolve(process.cwd(), ".runtime");
const memoryFile = path.join(runtimeDir, "ai-memories.json");

interface MemoryRecord {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface McpServerRecord {
  id: string;
  name: string;
  kind: string;
  transport: string;
  url?: string;
  command?: string;
  args?: string[];
  enabledByDefault: boolean;
  readOnly: boolean;
  capabilities: string[];
  env: string[];
}

async function readMemories(): Promise<MemoryRecord[]> {
  try {
    return JSON.parse(await fs.readFile(memoryFile, "utf8")) as MemoryRecord[];
  } catch {
    return [];
  }
}

async function writeMemories(memories: MemoryRecord[]) {
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.writeFile(memoryFile, JSON.stringify(memories, null, 2), "utf8");
}

async function readRegistry(): Promise<McpServerRecord[]> {
  const file = path.resolve(process.cwd(), "integrations/mcp/servers.json");
  const parsed = JSON.parse(await fs.readFile(file, "utf8")) as { servers: McpServerRecord[] };
  return parsed.servers;
}

function configured(server: McpServerRecord): boolean {
  if (server.kind === "internal") return true;
  if (server.env.length === 0) return true;
  return server.env.every((name) => Boolean(process.env[name]?.trim()));
}

function allowedRoots(): string[] {
  const configuredRoots = (process.env.MCP_FILESYSTEM_ROOTS ?? "features,integrations,plugins,ai-workspace,rag")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configuredRoots.map((root) => path.resolve(process.cwd(), root));
}

function resolveAllowedPath(input: string): string {
  const candidate = path.resolve(process.cwd(), input || ".");
  const roots = allowedRoots();
  if (!roots.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`))) {
    throw new Error("Path is outside the MCP filesystem allowlist");
  }
  return candidate;
}

router.get("/mcp/servers", async (_req, res): Promise<void> => {
  const servers = await readRegistry();
  res.json({
    servers: servers.map((server) => ({
      ...server,
      configured: configured(server),
      missingEnvironment: server.env.filter((name) => !process.env[name]?.trim()),
    })),
  });
});

router.get("/mcp/memory", async (_req, res): Promise<void> => {
  res.json({ memories: await readMemories() });
});

router.post("/mcp/memory", async (req, res): Promise<void> => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 200) : "";
  const content = typeof req.body?.content === "string" ? req.body.content.trim().slice(0, 20_000) : "";
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.filter((tag: unknown) => typeof tag === "string").slice(0, 20) : [];
  if (!title || !content) {
    res.status(422).json({ message: "title and content are required" });
    return;
  }
  const now = new Date().toISOString();
  const record: MemoryRecord = { id: crypto.randomUUID(), title, content, tags, createdAt: now, updatedAt: now };
  const memories = await readMemories();
  memories.push(record);
  await writeMemories(memories.slice(-1000));
  res.status(201).json(record);
});

router.delete("/mcp/memory/:id", async (req, res): Promise<void> => {
  const memories = await readMemories();
  const next = memories.filter((memory) => memory.id !== req.params.id);
  await writeMemories(next);
  res.json({ deleted: memories.length - next.length });
});

router.get("/mcp/filesystem/list", async (req, res): Promise<void> => {
  try {
    const target = resolveAllowedPath(String(req.query.path ?? "features"));
    const entries = await fs.readdir(target, { withFileTypes: true });
    res.json({
      root: path.relative(process.cwd(), target),
      entries: entries.slice(0, 500).map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "directory" : "file" })),
    });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/mcp/filesystem/read", async (req, res): Promise<void> => {
  try {
    const target = resolveAllowedPath(String(req.query.path ?? ""));
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > 1_000_000) throw new Error("Only text files up to 1 MB can be read");
    const content = await fs.readFile(target, "utf8");
    res.json({ path: path.relative(process.cwd(), target), content });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
