import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { request as httpsRequest, type IncomingHttpHeaders } from "node:https";
import type { LookupFunction } from "node:net";
import path from "node:path";
import { AssetStorage, type StoredBinary } from "./asset-storage";
import {
  NetworkApprovalRequiredError,
  requireNetworkAccess,
  type NetworkCapability,
  type ResolvedPublicAddress,
} from "./network-access";

export type ExternalAssetProvider = "figma" | "huggingface";
export type ExternalAssetLicense = "unverified" | "restricted";

export interface ExternalAssetRecord {
  id: string;
  ownerId: string;
  provider: ExternalAssetProvider;
  sourceAssetId: string;
  name: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  sourceReference: string;
  licenseStatus: ExternalAssetLicense;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface NetworkSessionCredentials {
  sessionId: string;
  token: string;
}

const MAX_REDIRECTS = 4;
const FIGMA_MAX_BYTES = 20_000_000;
const HF_MAX_BYTES = 50_000_000;
const HF_ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".svg",
  ".glb", ".gltf", ".hdr", ".exr",
  ".mp3", ".wav", ".ogg", ".mp4", ".webm",
  ".json",
]);
const HF_BLOCKED_EXTENSIONS = new Set([
  ".bin", ".pt", ".pth", ".pkl", ".pickle", ".safetensors", ".onnx",
  ".exe", ".dll", ".so", ".dylib", ".sh", ".bat", ".cmd", ".ps1",
]);

export class ExternalAssetLibrary {
  readonly storage: AssetStorage;
  private readonly root: string;

  constructor(storage = new AssetStorage()) {
    this.storage = storage;
    this.root = path.join(storage.root, "external-assets");
  }

  async list(ownerId: string): Promise<ExternalAssetRecord[]> {
    await mkdir(this.root, { recursive: true });
    const records: ExternalAssetRecord[] = [];
    for (const file of (await readdir(this.root)).filter(item => item.endsWith(".json"))) {
      try {
        const record = JSON.parse(await readFile(path.join(this.root, file), "utf8")) as ExternalAssetRecord;
        if (record.ownerId === ownerId) records.push(record);
      } catch {
        // Corrupt metadata is ignored rather than exposing another user's records.
      }
    }
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(ownerId: string, id: string): Promise<ExternalAssetRecord> {
    const safeId = safeSegment(id);
    const record = JSON.parse(await readFile(path.join(this.root, `${safeId}.json`), "utf8")) as ExternalAssetRecord;
    if (record.ownerId !== ownerId) throw new Error("External asset was not found.");
    return record;
  }

  async importFigma(input: {
    ownerId: string;
    fileKey: string;
    nodeId: string;
    format: "png" | "jpg" | "svg";
    scale?: number;
    licenseStatus: ExternalAssetLicense;
    network: NetworkSessionCredentials;
  }): Promise<ExternalAssetRecord> {
    const token = process.env.FIGMA_ACCESS_TOKEN?.trim();
    if (!token) throw new Error("FIGMA_ACCESS_TOKEN is not configured in server secrets.");
    const fileKey = safeFigmaKey(input.fileKey);
    const nodeId = safeFigmaNode(input.nodeId);
    const scale = Math.max(0.5, Math.min(4, Number(input.scale ?? 2)));
    const query = new URLSearchParams({ ids: nodeId, format: input.format, scale: String(scale) });
    const endpoint = `https://api.figma.com/v1/images/${fileKey}?${query.toString()}`;
    const response = await fetchApproved({
      url: endpoint,
      capability: "web_fetch",
      reason: `Export Figma node ${nodeId} from file ${fileKey} as a GUI asset.`,
      network: input.network,
      maxBytes: 2_000_000,
      headers: { "x-figma-token": token, accept: "application/json" },
    });
    if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`Figma export request failed with HTTP ${response.statusCode}.`);
    const payload = JSON.parse(new TextDecoder().decode(response.body)) as { err?: string | null; images?: Record<string, string | null> };
    const imageUrl = payload.images?.[nodeId];
    if (!imageUrl) throw new Error(payload.err || "Figma did not return an export URL for the selected node.");

    const exported = await fetchApproved({
      url: imageUrl,
      capability: "web_fetch",
      reason: `Download the approved Figma export for node ${nodeId}.`,
      network: input.network,
      maxBytes: FIGMA_MAX_BYTES,
      headers: { accept: acceptedFigmaMime(input.format) },
    });
    if (exported.statusCode < 200 || exported.statusCode >= 300) throw new Error(`Figma asset download failed with HTTP ${exported.statusCode}.`);
    const mimeType = normalizedMime(exported.headers["content-type"]) || mimeForFigmaFormat(input.format);
    if (!allowedFigmaMime(mimeType, input.format)) throw new Error(`Figma returned unsupported content type ${mimeType}.`);
    const stored = await this.storage.saveSource(exported.body, mimeType, `figma-${nodeId.replaceAll(":", "-")}.${input.format}`);
    return this.save({
      ownerId: input.ownerId,
      provider: "figma",
      stored,
      name: `Figma ${nodeId}`,
      sourceReference: `figma://${fileKey}/${nodeId}`,
      licenseStatus: input.licenseStatus,
      metadata: { fileKey, nodeId, format: input.format, scale },
    });
  }

  async importHuggingFace(input: {
    ownerId: string;
    repoId: string;
    repoType: "model" | "dataset" | "space";
    revision?: string;
    file: string;
    licenseStatus: ExternalAssetLicense;
    network: NetworkSessionCredentials;
  }): Promise<ExternalAssetRecord> {
    const repoId = safeRepoId(input.repoId);
    const revision = safeRevision(input.revision ?? "main");
    const file = safeRepositoryFile(input.file);
    const extension = path.extname(file).toLowerCase();
    if (HF_BLOCKED_EXTENSIONS.has(extension) || !HF_ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error(`Hugging Face file type ${extension || "none"} is not allowed in the user asset library.`);
    }
    const prefix = input.repoType === "dataset" ? "datasets/" : input.repoType === "space" ? "spaces/" : "";
    const encodedFile = file.split("/").map(encodeURIComponent).join("/");
    const url = `https://huggingface.co/${prefix}${repoId}/resolve/${encodeURIComponent(revision)}/${encodedFile}`;
    const token = process.env.HUGGINGFACE_TOKEN?.trim() || process.env.HF_TOKEN?.trim();
    const downloaded = await fetchApproved({
      url,
      capability: "huggingface_import",
      reason: `Import selected asset ${file} from Hugging Face ${input.repoType} repository ${repoId}@${revision}.`,
      network: input.network,
      maxBytes: HF_MAX_BYTES,
      headers: {
        accept: "image/*,model/gltf-binary,model/gltf+json,audio/*,video/*,application/json,application/octet-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (downloaded.statusCode < 200 || downloaded.statusCode >= 300) throw new Error(`Hugging Face asset download failed with HTTP ${downloaded.statusCode}.`);
    const mimeType = normalizedMime(downloaded.headers["content-type"]) || mimeForExtension(extension);
    const stored = await this.storage.saveSource(downloaded.body, mimeType, path.basename(file));
    return this.save({
      ownerId: input.ownerId,
      provider: "huggingface",
      stored,
      name: path.basename(file),
      sourceReference: `hf://${input.repoType}/${repoId}@${revision}/${file}`,
      licenseStatus: input.licenseStatus,
      metadata: { repoId, repoType: input.repoType, revision, file },
    });
  }

  private async save(input: {
    ownerId: string;
    provider: ExternalAssetProvider;
    stored: StoredBinary;
    name: string;
    sourceReference: string;
    licenseStatus: ExternalAssetLicense;
    metadata: ExternalAssetRecord["metadata"];
  }): Promise<ExternalAssetRecord> {
    await mkdir(this.root, { recursive: true });
    const record: ExternalAssetRecord = {
      id: `external-${randomUUID()}`,
      ownerId: input.ownerId,
      provider: input.provider,
      sourceAssetId: input.stored.id,
      name: input.name.slice(0, 240),
      mimeType: input.stored.mimeType,
      byteLength: input.stored.byteLength,
      sha256: input.stored.sha256,
      sourceReference: input.sourceReference,
      licenseStatus: input.licenseStatus,
      createdAt: new Date().toISOString(),
      metadata: input.metadata,
    };
    await writeFile(path.join(this.root, `${safeSegment(record.id)}.json`), JSON.stringify(record, null, 2), { encoding: "utf8", mode: 0o600 });
    return record;
  }
}

export const externalAssetLibrary = new ExternalAssetLibrary();

export function isNetworkApprovalRequired(error: unknown): error is NetworkApprovalRequiredError {
  return error instanceof NetworkApprovalRequiredError;
}

async function fetchApproved(input: {
  url: string;
  capability: NetworkCapability;
  reason: string;
  network: NetworkSessionCredentials;
  maxBytes: number;
  headers?: Record<string, string>;
}): Promise<{ statusCode: number; headers: IncomingHttpHeaders; body: Buffer }> {
  let currentUrl = input.url;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const approval = await requireNetworkAccess({
      sessionId: input.network.sessionId,
      token: input.network.token,
      capability: input.capability,
      targetUrl: currentUrl,
      reason: redirect === 0 ? input.reason : `${input.reason} Follow validated redirect ${redirect}.`,
    });
    const response = await pinnedHttpsGet({
      url: approval.url,
      address: approval.resolvedAddresses[redirect % approval.resolvedAddresses.length]!,
      maxBytes: input.maxBytes,
      headers: input.headers,
    });
    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = firstHeader(response.headers.location);
      if (!location) throw new Error("Remote asset returned a redirect without a Location header.");
      currentUrl = new URL(location, approval.url).toString();
      continue;
    }
    return response;
  }
  throw new Error("Remote asset exceeded the maximum redirect count.");
}

function pinnedHttpsGet(input: {
  url: URL;
  address: ResolvedPublicAddress;
  maxBytes: number;
  headers?: Record<string, string>;
}): Promise<{ statusCode: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const pinnedLookup: LookupFunction = (_hostname, _options, callback) => callback(null, input.address.address, input.address.family);
    const request = httpsRequest(input.url, {
      method: "GET",
      lookup: pinnedLookup,
      servername: input.url.hostname,
      headers: { "user-agent": "T1-External-Asset-Importer/1.0", ...input.headers },
    }, response => {
      const contentLength = Number(firstHeader(response.headers["content-length"]) ?? 0);
      if (contentLength > input.maxBytes) {
        response.destroy(new Error(`Remote asset exceeds ${input.maxBytes} bytes.`));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer | Uint8Array | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += bytes.byteLength;
        if (total > input.maxBytes) {
          response.destroy(new Error(`Remote asset exceeds ${input.maxBytes} bytes.`));
          return;
        }
        chunks.push(bytes);
      });
      response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on("error", reject);
    });
    request.setTimeout(45_000, () => request.destroy(new Error("Remote asset download timed out.")));
    request.on("error", reject);
    request.end();
  });
}

function safeFigmaKey(value: string): string {
  const safe = value.trim();
  if (!/^[A-Za-z0-9_-]{6,160}$/.test(safe)) throw new Error("Invalid Figma file key.");
  return safe;
}

function safeFigmaNode(value: string): string {
  const safe = value.trim();
  if (!/^[A-Za-z0-9:_-]{1,160}$/.test(safe)) throw new Error("Invalid Figma node ID.");
  return safe;
}

function safeRepoId(value: string): string {
  const safe = value.trim();
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(safe)) throw new Error("Hugging Face repository ID must be owner/name.");
  return safe;
}

function safeRevision(value: string): string {
  const safe = value.trim();
  if (!safe || safe.length > 160 || safe.includes("..") || /[\\\x00-\x1f]/.test(safe)) throw new Error("Invalid Hugging Face revision.");
  return safe;
}

function safeRepositoryFile(value: string): string {
  const safe = value.trim().replaceAll("\\", "/");
  if (!safe || safe.startsWith("/") || safe.includes("..") || safe.length > 500 || /[\x00-\x1f]/.test(safe)) throw new Error("Invalid Hugging Face file path.");
  return safe;
}

function safeSegment(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 180);
  if (!safe || safe === "." || safe === "..") throw new Error("Invalid asset identifier.");
  return safe;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizedMime(value: string | string[] | undefined): string {
  return (firstHeader(value) ?? "").split(";", 1)[0]!.trim().toLowerCase();
}

function acceptedFigmaMime(format: "png" | "jpg" | "svg"): string {
  return format === "png" ? "image/png" : format === "jpg" ? "image/jpeg" : "image/svg+xml";
}

function mimeForFigmaFormat(format: "png" | "jpg" | "svg"): string {
  return acceptedFigmaMime(format);
}

function allowedFigmaMime(mime: string, format: "png" | "jpg" | "svg"): boolean {
  return mime === mimeForFigmaFormat(format) || (format === "jpg" && mime === "image/jpg");
}

function mimeForExtension(extension: string): string {
  const values: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".hdr": "image/vnd.radiance", ".exr": "image/x-exr",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp4": "video/mp4", ".webm": "video/webm",
    ".json": "application/json",
  };
  return values[extension] ?? "application/octet-stream";
}

export function contentDigest(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
