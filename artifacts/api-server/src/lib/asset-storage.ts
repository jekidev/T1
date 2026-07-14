import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
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
    await this.initialize();
    const id = `source-${randomUUID()}`;
    const extension = extensionForMime(mimeType);
    const filePath = path.join(this.sourcesDir(), `${id}${extension}`);
    await writeFile(filePath, input, { flag: "wx" });
    const stored = binaryRecord(id, filePath, mimeType, input, originalName);
    await writeFile(`${filePath}.json`, JSON.stringify(stored, null, 2));
    return stored;
  }

  async readSource(id: string): Promise<{ metadata: StoredBinary; content: Buffer }> {
    await this.initialize();
    const metadataPath = await this.findMetadataFile(this.sourcesDir(), id);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as StoredBinary;
    return { metadata, content: await readFile(metadata.path) };
  }

  async saveArtifact(jobId: string, kind: AssetArtifact["kind"], content: Buffer, mimeType: string): Promise<AssetArtifact> {
    await this.initialize();
    const safeJobId = safeSegment(jobId);
    const jobDir = path.join(this.artifactsDir(), safeJobId);
    await mkdir(jobDir, { recursive: true });
    const extension = extensionForMime(mimeType);
    const filePath = path.join(jobDir, `${safeSegment(kind)}-${randomUUID()}${extension}`);
    await writeFile(filePath, content, { flag: "wx" });
    return {
      kind,
      path: filePath,
      mimeType,
      byteLength: content.byteLength,
      sha256: sha256(content),
    };
  }

  async readArtifact(jobId: string, sha: string): Promise<{ artifact: AssetArtifact; content: Buffer }> {
    const job = await this.readJob(jobId);
    const artifact = job.artifacts.find(item => item.sha256 === sha);
    if (!artifact) throw new Error("Artifact not found.");
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
        // A corrupt record is skipped and surfaced by server logs instead of crashing the listing endpoint.
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

function binaryRecord(id: string, filePath: string, mimeType: string, content: Buffer, originalName?: string): StoredBinary {
  return {
    id,
    path: filePath,
    mimeType,
    byteLength: content.byteLength,
    sha256: sha256(content),
    ...(originalName ? { originalName: originalName.slice(0, 255) } : {}),
  };
}

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
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
