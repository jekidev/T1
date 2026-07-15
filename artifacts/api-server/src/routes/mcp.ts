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

function getConfigStatus(server: McpServerRecord): { configured: boolean; missingEnvironment: string[] } {
  if (server.kind === "internal" || server.env.length === 0) {
    return { configured: true, missingEnvironment: [] };
  }
  const missingEnvironment = server.env.filter((name) => !process.env[name]?.trim());
  return { configured: missingEnvironment.length === 0, missingEnvironment };
}

function configured(server: McpServerRecord): boolean {
  return getConfigStatus(server).configured;
}

async function checkCommandExists(server: McpServerRecord): Promise<boolean | null> {
  if (!server.command || !server.args) return null;

  if (server.command === "node" && server.args.length > 0) {
    const script = server.args[0];
    if (!script.startsWith("-")) {
      try {
        await fs.stat(path.resolve(process.cwd(), script));
        return true;
      } catch {
        return false;
      }
    }
  }

  if (server.command === "uv" && server.args.includes("--directory") && server.args.includes("run")) {
    const dirIndex = server.args.indexOf("--directory") + 1;
    const runIndex = server.args.indexOf("run") + 1;
    if (dirIndex > 0 && runIndex > 0 && dirIndex < server.args.length && runIndex < server.args.length) {
      const scriptPath = path.join(server.args[dirIndex], server.args[runIndex]);
      try {
        await fs.stat(path.resolve(process.cwd(), scriptPath));
        return true;
      } catch {
        return false;
      }
    }
  }

  return null;
}

async function redactEnvValues(text: string): Promise<string> {
  try {
    const servers = await readRegistry();
    const secretNames = new Set<string>();
    for (const server of servers) {
      for (const name of server.env) secretNames.add(name);
    }

    const secrets: string[] = [];
    for (const name of secretNames) {
      const value = process.env[name]?.trim();
      if (value && value.length >= 4) secrets.push(value);
    }

    secrets.sort((a, b) => b.length - a.length);
    let redacted = text;
    for (const secret of secrets) {
      redacted = redacted.replaceAll(secret, "[REDACTED]");
    }
    return redacted;
  } catch {
    return text;
  }
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
    servers: servers.map((server) => {
      const { configured, missingEnvironment } = getConfigStatus(server);
      return { ...server, configured, missingEnvironment };
    }),
  });
});

router.get("/mcp/servers/:id/health", async (req, res): Promise<void> => {
  const servers = await readRegistry();
  const server = servers.find((s) => s.id === req.params.id);
  if (!server) {
    res.status(404).json({ message: "MCP server not found" });
    return;
  }

  const { configured, missingEnvironment } = getConfigStatus(server);
  const commandExists = await checkCommandExists(server);

  res.json({
    id: server.id,
    name: server.name,
    kind: server.kind,
    transport: server.transport,
    configured,
    missingEnvironment,
    commandExists,
    healthy: configured && commandExists !== false,
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
    const rawMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ message: await redactEnvValues(rawMessage) });
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
    const rawMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ message: await redactEnvValues(rawMessage) });
  }
});

export default router;
