import crypto from "node:crypto";
import fs from "node:fs/promises";
import { request as httpsRequest, type IncomingHttpHeaders } from "node:https";
import type { LookupFunction } from "node:net";
import path from "node:path";
import {
  NetworkApprovalRequiredError,
  requireNetworkAccess,
  type NetworkCapability,
  type ResolvedPublicAddress,
} from "./network-access";
import { listRagMemory, syncRagIntoPersistentMemory } from "./rag-memory";

const ART_OF_WAR_URL = "https://www.gutenberg.org/cache/epub/132/pg132.txt";
const SAFE_TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".jsonl", ".csv", ".yaml", ".yml"]);
const MAX_FILE_BYTES = 4_000_000;
const MAX_REDIRECTS = 4;

export interface NetworkSessionCredentials {
  sessionId: string;
  token: string;
}

export async function importArtOfWar(input: {
  accountName: string;
  network: NetworkSessionCredentials;
}): Promise<{ filePath: string; sourcePath: string; ragRevision: string; sync: Awaited<ReturnType<typeof syncRagIntoPersistentMemory>> }> {
  const account = safeAccountName(input.accountName);
  const text = await fetchApprovedText({
    url: ART_OF_WAR_URL,
    capability: "public_domain_import",
    reason: "Import the public-domain Project Gutenberg edition of The Art of War into the selected account RAG library.",
    network: input.network,
    maxBytes: 2_500_000,
  });
  const directory = path.resolve(process.cwd(), "rag", "accounts", account, "alt-wisdom", "books");
  await fs.mkdir(directory, { recursive: true });
  const file = await writeImmutableText(directory, "the-art-of-war-lionel-giles-project-gutenberg", ".txt", text);
  const source = file.replace(/\.txt$/, ".source.json");
  await writeIfAbsent(source, JSON.stringify({
    title: "The Art of War",
    author: "Sunzi",
    translator: "Lionel Giles",
    originalPublication: 1910,
    projectGutenbergEbook: 132,
    sourceUrl: ART_OF_WAR_URL,
    importedAt: new Date().toISOString(),
    sha256: sha256(text),
    licenseNote: "Project Gutenberg distribution terms are included in the downloaded text. Verify local public-domain rules before redistribution.",
    immutability: "The source text is append-only. A changed upstream file is stored under a new content-addressed filename.",
    networkVerification: "The approved hostname was resolved to public addresses and the HTTPS connection was pinned to one validated address.",
  }, null, 2));
  const sync = await syncRagIntoPersistentMemory();
  return { filePath: relative(file), sourcePath: relative(source), ragRevision: await calculateRagRevision(), sync };
}

export async function importHuggingFaceTextFiles(input: {
  accountName: string;
  repoId: string;
  revision?: string;
  files: string[];
  network: NetworkSessionCredentials;
}): Promise<{ imported: Array<{ source: string; destination: string; sha256: string; sizeBytes: number }>; ragRevision: string; sync: Awaited<ReturnType<typeof syncRagIntoPersistentMemory>> }> {
  const account = safeAccountName(input.accountName);
  const repoId = safeRepoId(input.repoId);
  const revision = safeRevision(input.revision ?? "main");
  const requestedFiles = [...new Set(input.files.map(safeRepositoryFile))];
  if (requestedFiles.length === 0 || requestedFiles.length > 20) throw new Error("Choose between 1 and 20 Hugging Face text files.");

  const baseDirectory = path.resolve(process.cwd(), "rag", "accounts", account, "huggingface", repoId.replace("/", "--"), revision);
  await fs.mkdir(baseDirectory, { recursive: true });
  const imported: Array<{ source: string; destination: string; sha256: string; sizeBytes: number }> = [];

  for (const file of requestedFiles) {
    const encodedPath = file.split("/").map(encodeURIComponent).join("/");
    const url = `https://huggingface.co/${repoId}/resolve/${encodeURIComponent(revision)}/${encodedPath}`;
    const text = await fetchApprovedText({
      url,
      capability: "huggingface_import",
      reason: `Import explicitly selected text file ${file} from Hugging Face repository ${repoId}@${revision} into RAG.`,
      network: input.network,
      maxBytes: MAX_FILE_BYTES,
      authorization: process.env.HUGGINGFACE_TOKEN ? `Bearer ${process.env.HUGGINGFACE_TOKEN}` : undefined,
    });
    const destination = await writeImmutableRepositoryFile(baseDirectory, file, text);
    imported.push({ source: `${repoId}@${revision}/${file}`, destination: relative(destination), sha256: sha256(text), sizeBytes: Buffer.byteLength(text) });
  }

  const manifestBody = JSON.stringify({
    repoId,
    revision,
    importedAt: new Date().toISOString(),
    files: imported,
    restrictions: [
      "Text files only",
      "No model weights, pickle files, binaries or executable artifacts",
      "Imported content is data for retrieval and is never executed",
      "Existing RAG source files are never overwritten, deleted, moved or renamed",
      "Each origin and redirect is separately authorized and DNS-pinned to a validated public address",
    ],
  }, null, 2);
  const manifestHash = sha256(manifestBody).slice(0, 12);
  await writeIfAbsent(path.join(baseDirectory, `IMPORT_MANIFEST-${manifestHash}.json`), manifestBody);

  const sync = await syncRagIntoPersistentMemory();
  return { imported, ragRevision: await calculateRagRevision(), sync };
}

export async function calculateRagRevision(): Promise<string> {
  const items = await listRagMemory();
  const digest = crypto.createHash("sha256");
  for (const item of [...items].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))) {
    digest.update(item.sourcePath);
    digest.update("\0");
    digest.update(item.sha256);
    digest.update("\0");
  }
  return digest.digest("hex");
}

async function fetchApprovedText(input: {
  url: string;
  capability: NetworkCapability;
  reason: string;
  network: NetworkSessionCredentials;
  maxBytes: number;
  authorization?: string;
}): Promise<string> {
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
      authorization: input.authorization,
    });
    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = firstHeader(response.headers.location);
      if (!location) throw new Error("Remote source returned a redirect without a Location header.");
      currentUrl = new URL(location, approval.url).toString();
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`Remote text import failed with HTTP ${response.statusCode}.`);
    if (response.body.includes(0)) throw new Error("Binary content is not allowed in RAG text imports.");
    return new TextDecoder("utf-8", { fatal: true }).decode(response.body);
  }
  throw new Error("Remote source exceeded the maximum redirect count.");
}

function pinnedHttpsGet(input: {
  url: URL;
  address: ResolvedPublicAddress;
  maxBytes: number;
  authorization?: string;
}): Promise<{ statusCode: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const pinnedLookup: LookupFunction = (_hostname, _options, callback) => callback(null, input.address.address, input.address.family);
    const request = httpsRequest(input.url, {
      method: "GET",
      lookup: pinnedLookup,
      servername: input.url.hostname,
      headers: {
        accept: "text/plain, text/markdown, application/json, text/csv, application/yaml, text/yaml;q=0.9",
        "user-agent": "T1-RAG-Importer/1.2",
        ...(input.authorization ? { authorization: input.authorization } : {}),
      },
    }, response => {
      const contentLength = Number(firstHeader(response.headers["content-length"]) ?? 0);
      if (contentLength > input.maxBytes) {
        response.destroy(new Error(`Remote text file exceeds ${input.maxBytes} bytes.`));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer | Uint8Array | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += bytes.length;
        if (total > input.maxBytes) {
          response.destroy(new Error(`Remote text file exceeds ${input.maxBytes} bytes.`));
          return;
        }
        chunks.push(bytes);
      });
      response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on("error", reject);
    });
    request.setTimeout(45_000, () => request.destroy(new Error("Remote text import timed out.")));
    request.on("error", reject);
    request.end();
  });
}

export function isNetworkApprovalRequired(error: unknown): error is NetworkApprovalRequiredError {
  return error instanceof NetworkApprovalRequiredError;
}

async function writeImmutableText(directory: string, baseName: string, extension: string, content: string): Promise<string> {
  const preferred = path.join(directory, `${baseName}${extension}`);
  try {
    const existing = await fs.readFile(preferred, "utf8");
    if (sha256(existing) === sha256(content)) return preferred;
    const versioned = path.join(directory, `${baseName}-${sha256(content).slice(0, 12)}${extension}`);
    await writeIfAbsent(versioned, content);
    return versioned;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeIfAbsent(preferred, content);
    return preferred;
  }
}

async function writeImmutableRepositoryFile(baseDirectory: string, repositoryPath: string, content: string): Promise<string> {
  const requested = path.resolve(baseDirectory, repositoryPath);
  if (!requested.startsWith(`${baseDirectory}${path.sep}`)) throw new Error("Hugging Face destination escaped the account RAG directory.");
  await fs.mkdir(path.dirname(requested), { recursive: true });
  try {
    const existing = await fs.readFile(requested, "utf8");
    if (sha256(existing) === sha256(content)) return requested;
    const extension = path.extname(requested);
    const stem = requested.slice(0, extension ? -extension.length : undefined);
    const versioned = `${stem}-${sha256(content).slice(0, 12)}${extension}`;
    await writeIfAbsent(versioned, content);
    return versioned;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeIfAbsent(requested, content);
    return requested;
  }
}

async function writeIfAbsent(destination: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    const handle = await fs.open(destination, "wx", 0o600);
    try {
      await handle.writeFile(content, "utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

function safeAccountName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (!normalized) throw new Error("A valid account name is required.");
  return normalized;
}

function safeRepoId(value: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(normalized)) throw new Error("Hugging Face repoId must use owner/name format.");
  return normalized;
}

function safeRevision(value: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9._/-]{1,160}$/.test(normalized) || normalized.includes("..")) throw new Error("Invalid Hugging Face revision.");
  return normalized;
}

function safeRepositoryFile(value: string): string {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\0")) throw new Error("Invalid Hugging Face file path.");
  const extension = path.extname(normalized).toLowerCase();
  if (!SAFE_TEXT_EXTENSIONS.has(extension)) throw new Error(`Unsupported RAG import extension: ${extension || "none"}.`);
  return normalized.slice(0, 500);
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function relative(value: string): string {
  return path.relative(process.cwd(), value).replaceAll(path.sep, "/");
}
