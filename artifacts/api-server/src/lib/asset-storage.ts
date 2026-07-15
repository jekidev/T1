import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AssetJobSchema,
  GameAssetManifestEntrySchema,
  type AssetArtifact,
  type AssetJob,
  type GameAssetManifestEntry,
} from "@workspace/asset-pipeline";

export interface StoredBinary {
  id: string;
  path: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  originalName?: string;
}

interface StreamWriteResult {
  byteLength: number;
  sha256: string;
}

export class AssetStorage {
  readonly root: string;

  constructor(root = process.env.ASSET_PIPELINE_ROOT ?? path.resolve(process.cwd(), "data/asset-pipeline")) {
    this.root = root;
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.sourcesDir(), { recursive: true }),
      mkdir(this.jobsDir(), { recursive: true }),
      mkdir(this.artifactsDir(), { recursive: true }),
      mkdir(this.publishedDir(), { recursive: true }),
    ]);
  }

  async saveSource(input: Buffer, mimeType: string, originalName?: string): Promise<StoredBinary> {
    return this.saveSourceStream(singleChunk(input), mimeType, originalName, input.byteLength);
  }

  async saveSourceStream(
    input: AsyncIterable<Uint8Array>,
    mimeType: string,
    originalName: string | undefined,
    maximumBytes: number,
  ): Promise<StoredBinary> {
    await this.initialize();
    const id = `source-${randomUUID()}`;
    const extension = extensionForMime(mimeType);
    const filePath = path.join(this.sourcesDir(), `${id}${extension}`);
    const written = await writeStream(filePath, input, maximumBytes);
    const stored = binaryRecord(id, filePath, mimeType, written, originalName);
    await writeFile(`${filePath}.json`, JSON.stringify(stored, null, 2));
    return stored;
  }

  async getSource(id: string): Promise<StoredBinary> {
    await this.initialize();
    const metadataPath = await this.findMetadataFile(this.sourcesDir(), id);
    return JSON.parse(await readFile(metadataPath, "utf8")) as StoredBinary;
  }

  async readSource(id: string): Promise<{ metadata: StoredBinary; content: Buffer }> {
    const metadata = await this.getSource(id);
    return { metadata, content: await readFile(metadata.path) };
  }

  async saveArtifact(jobId: string, kind: AssetArtifact["kind"], content: Buffer, mimeType: string): Promise<AssetArtifact> {
    return this.saveArtifactStream(jobId, kind, singleChunk(content), mimeType, content.byteLength);
  }

  async saveArtifactStream(
    jobId: string,
    kind: AssetArtifact["kind"],
    input: AsyncIterable<Uint8Array>,
    mimeType: string,
    maximumBytes: number,
  ): Promise<AssetArtifact> {
    await this.initialize();
    const safeJobId = safeSegment(jobId);
    const jobDir = path.join(this.artifactsDir(), safeJobId);
    await mkdir(jobDir, { recursive: true });
    const extension = extensionForMime(mimeType);
    const filePath = path.join(jobDir, `${safeSegment(kind)}-${randomUUID()}${extension}`);
    const written = await writeStream(filePath, input, maximumBytes);
    return {
      kind,
      path: filePath,
      mimeType,
      byteLength: written.byteLength,
      sha256: written.sha256,
    };
  }

  async getArtifact(jobId: string, sha: string): Promise<AssetArtifact> {
    const job = await this.readJob(jobId);
    const artifact = job.artifacts.find(item => item.sha256 === sha);
    if (!artifact) throw new Error("Artifact not found.");
    return artifact;
  }

  async readArtifact(jobId: string, sha: string): Promise<{ artifact: AssetArtifact; content: Buffer }> {
    const artifact = await this.getArtifact(jobId, sha);
    return { artifact, content: await readFile(artifact.path) };
  }

  async writeJob(job: AssetJob): Promise<void> {
    await this.initialize();
    const validated = AssetJobSchema.parse(job);
    await writeFile(this.jobPath(job.id), JSON.stringify(validated, null, 2));
  }

  async readJob(id: string): Promise<AssetJob> {
    const content = await readFile(this.jobPath(id), "utf8");
    return AssetJobSchema.parse(JSON.parse(content));
  }

  async listJobs(limit = 100): Promise<AssetJob[]> {
    await this.initialize();
    const files = (await readdir(this.jobsDir())).filter(file => file.endsWith(".json")).sort().reverse();
    const jobs: AssetJob[] = [];
    for (const file of files.slice(0, Math.max(1, Math.min(limit, 500)))) {
      try {
        jobs.push(AssetJobSchema.parse(JSON.parse(await readFile(path.join(this.jobsDir(), file), "utf8"))));
      } catch {
        // A corrupt record is skipped instead of crashing the job-list endpoint.
      }
    }
    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async publish(entry: GameAssetManifestEntry): Promise<void> {
    await this.initialize();
    const validated = GameAssetManifestEntrySchema.parse(entry);
    const manifest = await this.readManifest();
    const next = manifest.filter(item => item.id !== entry.id);
    next.push(validated);
    next.sort((a, b) => a.id.localeCompare(b.id));
    await writeFile(this.manifestPath(), JSON.stringify(next, null, 2));
  }

  async readManifest(): Promise<GameAssetManifestEntry[]> {
    await this.initialize();
    try {
      const parsed = JSON.parse(await readFile(this.manifestPath(), "utf8"));
      return Array.isArray(parsed) ? parsed.map(value => GameAssetManifestEntrySchema.parse(value)) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async findMetadataFile(directory: string, id: string): Promise<string> {
    const prefix = `${safeSegment(id)}`;
    const files = await readdir(directory);
    const metadataFile = files.find(file => file.startsWith(prefix) && file.endsWith(".json"));
    if (!metadataFile) throw new Error("Stored source not found.");
    return path.join(directory, metadataFile);
  }

  private sourcesDir(): string { return path.join(this.root, "sources"); }
  private jobsDir(): string { return path.join(this.root, "jobs"); }
  private artifactsDir(): string { return path.join(this.root, "artifacts"); }
  private publishedDir(): string { return path.join(this.root, "published"); }
  private jobPath(id: string): string { return path.join(this.jobsDir(), `${safeSegment(id)}.json`); }
  private manifestPath(): string { return path.join(this.publishedDir(), "manifest.json"); }
}

async function writeStream(
  filePath: string,
  input: AsyncIterable<Uint8Array>,
  maximumBytes: number,
): Promise<StreamWriteResult> {
  if (!Number.isFinite(maximumBytes) || maximumBytes < 1) throw new Error("A positive stream byte limit is required.");
  const handle = await open(filePath, "wx");
  const hash = createHash("sha256");
  let byteLength = 0;
  try {
    for await (const chunk of input) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += buffer.byteLength;
      if (byteLength > maximumBytes) throw new Error(`Upload exceeds the ${maximumBytes}-byte limit.`);
      hash.update(buffer);
      await handle.write(buffer);
    }
    if (byteLength === 0) throw new Error("Uploaded content is empty.");
    return { byteLength, sha256: hash.digest("hex") };
  } catch (error) {
    await handle.close();
    await rm(filePath, { force: true });
    throw error;
  } finally {
    try { await handle.close(); } catch { /* already closed after failure */ }
  }
}

async function* singleChunk(content: Buffer): AsyncIterable<Uint8Array> {
  yield content;
}

function binaryRecord(
  id: string,
  filePath: string,
  mimeType: string,
  written: StreamWriteResult,
  originalName?: string,
): StoredBinary {
  return {
    id,
    path: filePath,
    mimeType,
    byteLength: written.byteLength,
    sha256: written.sha256,
    ...(originalName ? { originalName: originalName.slice(0, 255) } : {}),
  };
}

function safeSegment(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180);
  if (!safe || safe === "." || safe === "..") throw new Error("Invalid storage identifier.");
  return safe;
}

function extensionForMime(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "model/gltf-binary": ".glb",
    "model/gltf+json": ".gltf",
    "application/json": ".json",
    "application/octet-stream": ".bin",
  };
  return extensions[mimeType] ?? ".bin";
}
