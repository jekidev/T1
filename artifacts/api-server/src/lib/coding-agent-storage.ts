import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AgentRunSchema,
  RepositoryMapSchema,
  type AgentRun,
  type RepositoryMap,
} from "@workspace/coding-agent";

export class CodingAgentStorage {
  readonly root: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(root = process.env.CODING_AGENT_STORAGE_ROOT ?? path.resolve(process.cwd(), "data/coding-agent")) {
    this.root = root;
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.runsDirectory(), { recursive: true }),
      mkdir(this.mapsDirectory(), { recursive: true }),
    ]);
  }

  async saveRun(runInput: AgentRun): Promise<AgentRun> {
    const run = AgentRunSchema.parse(runInput);
    await this.serializeWrite(() => atomicWriteJson(this.runPath(run.id), run));
    return structuredClone(run);
  }

  async readRun(id: string): Promise<AgentRun> {
    await this.initialize();
    const content = await readFile(this.runPath(id), "utf8");
    return AgentRunSchema.parse(JSON.parse(content));
  }

  async listRuns(limit = 100): Promise<AgentRun[]> {
    await this.initialize();
    const files = (await readdir(this.runsDirectory()))
      .filter(file => file.endsWith(".json"))
      .sort()
      .reverse();
    const runs: AgentRun[] = [];
    for (const file of files.slice(0, clampInteger(limit, 1, 500))) {
      try {
        runs.push(AgentRunSchema.parse(JSON.parse(await readFile(path.join(this.runsDirectory(), file), "utf8"))));
      } catch {
        // Invalid records remain on disk for manual forensic review and are not exposed as valid runs.
      }
    }
    return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveRepositoryMap(mapInput: RepositoryMap): Promise<RepositoryMap> {
    const map = RepositoryMapSchema.parse(mapInput);
    await this.serializeWrite(() => atomicWriteJson(this.mapPath(map.baseCommit), map));
    return structuredClone(map);
  }

  async readRepositoryMap(baseCommit: string): Promise<RepositoryMap> {
    await this.initialize();
    return RepositoryMapSchema.parse(JSON.parse(await readFile(this.mapPath(baseCommit), "utf8")));
  }

  private async serializeWrite(operation: () => Promise<void>): Promise<void> {
    const previous = this.writeChain;
    let release: (() => void) | undefined;
    this.writeChain = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      await operation();
    } finally {
      release?.();
    }
  }

  private runsDirectory(): string { return path.join(this.root, "runs"); }
  private mapsDirectory(): string { return path.join(this.root, "repository-maps"); }
  private runPath(id: string): string { return path.join(this.runsDirectory(), `${safeSegment(id)}.json`); }
  private mapPath(commit: string): string { return path.join(this.mapsDirectory(), `${safeSegment(commit)}.json`); }
}

export const codingAgentStorage = new CodingAgentStorage();

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function safeSegment(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180);
  if (!safe || safe === "." || safe === "..") throw new Error("Invalid coding-agent storage identifier.");
  return safe;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}
