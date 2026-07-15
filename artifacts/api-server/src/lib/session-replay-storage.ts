import { mkdir, readFile, readdir, stat, unlink, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

export interface ReplayBatch {
  provider: "rrweb";
  path: string;
  events: unknown[];
}

export interface ReplaySessionSummary {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  byteLength: number;
}

const MAX_EVENTS_PER_BATCH = 200;
const MAX_EVENT_JSON_BYTES = 1_000_000;
const DEFAULT_RETENTION_DAYS = 7;

export class SessionReplayStorage {
  constructor(private readonly root = process.env.SESSION_REPLAY_ROOT ?? path.resolve(process.cwd(), "data/session-replay")) {}

  async append(sessionId: string, batch: ReplayBatch): Promise<void> {
    await this.initialize();
    const safeId = safeSessionId(sessionId);
    const sanitized = sanitizeBatch(batch);
    const line = `${JSON.stringify({ receivedAt: new Date().toISOString(), ...sanitized })}\n`;
    if (Buffer.byteLength(line) > MAX_EVENT_JSON_BYTES) throw new Error("Replay batch exceeds the storage limit.");
    await appendFile(this.sessionPath(safeId), line, { encoding: "utf8" });
    await this.enforceRetention();
  }

  async list(): Promise<ReplaySessionSummary[]> {
    await this.initialize();
    await this.enforceRetention();
    const files = (await readdir(this.root)).filter(file => file.endsWith(".jsonl"));
    const results: ReplaySessionSummary[] = [];
    for (const file of files) {
      const info = await stat(path.join(this.root, file));
      results.push({
        sessionId: file.slice(0, -6),
        createdAt: info.birthtime.toISOString(),
        updatedAt: info.mtime.toISOString(),
        byteLength: info.size,
      });
    }
    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async read(sessionId: string, maximumBatches = 2_000): Promise<unknown[]> {
    await this.initialize();
    const content = await readFile(this.sessionPath(safeSessionId(sessionId)), "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .slice(-Math.max(1, Math.min(maximumBatches, 2_000)))
      .map(line => JSON.parse(line));
  }

  private async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  private async enforceRetention(): Promise<void> {
    const retentionDays = positiveNumber(process.env.SESSION_REPLAY_RETENTION_DAYS, DEFAULT_RETENTION_DAYS);
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1_000;
    const files = (await readdir(this.root)).filter(file => file.endsWith(".jsonl"));
    await Promise.all(files.map(async file => {
      const filePath = path.join(this.root, file);
      const info = await stat(filePath);
      if (info.mtimeMs < cutoff) await unlink(filePath);
    }));
  }

  private sessionPath(sessionId: string): string {
    return path.join(this.root, `${sessionId}.jsonl`);
  }
}

export const sessionReplayStorage = new SessionReplayStorage();

function sanitizeBatch(batch: ReplayBatch): ReplayBatch {
  if (batch.provider !== "rrweb") throw new Error("Unsupported replay provider.");
  if (!Array.isArray(batch.events) || batch.events.length === 0 || batch.events.length > MAX_EVENTS_PER_BATCH) {
    throw new Error(`Replay batches must contain 1-${MAX_EVENTS_PER_BATCH} events.`);
  }
  return {
    provider: "rrweb",
    path: sanitizePath(batch.path),
    events: batch.events.map(event => sanitizeReplayValue(event, 0)),
  };
}

function sanitizeReplayValue(value: unknown, depth: number): unknown {
  if (depth > 12) return "[TRUNCATED]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactString(value).slice(0, 20_000);
  if (Array.isArray(value)) return value.slice(0, 5_000).map(item => sanitizeReplayValue(item, depth + 1));
  if (typeof value !== "object") return String(value);

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeReplayValue(entry, depth + 1);
  }
  return output;
}

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|pk)[-_][A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]");
}

function isSensitiveKey(key: string): boolean {
  return /(password|secret|token|authorization|cookie|api[-_.]?key|\.env|private[-_.]?key)/i.test(key);
}

function sanitizePath(value: string): string {
  try {
    const url = new URL(value, "https://local.invalid");
    return url.pathname.slice(0, 500);
  } catch {
    return "/";
  }
}

function safeSessionId(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160);
  if (!safe || safe === "." || safe === "..") throw new Error("Invalid replay session ID.");
  return safe;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
