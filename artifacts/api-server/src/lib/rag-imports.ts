import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  NetworkApprovalRequiredError,
  requireNetworkAccess,
  type NetworkCapability,
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
  const bytes = await fetchApprovedText({
    url: ART_OF_WAR_URL,
    capability: "public_domain_import",
    reason: "Import the public-domain Project Gutenberg edition of The Art of War into the selected account RAG library.",
    network: input.network,
    maxBytes: 2_500_000,
  });
  const directory = path.resolve(process.cwd(), "rag", "accounts", account, "alt-wisdom", "books");
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, "the-art-of-war-lionel-giles-project-gutenberg.txt");
  const source = path.join(directory, "the-art-of-war-lionel-giles-project-gutenberg.source.json");
  await fs.writeFile(file, bytes, { encoding: "utf8", mode: 0o600 });
  await fs.writeFile(source, JSON.stringify({
    title: "The Art of War",
    author: "Sunzi",
    translator: "Lionel Giles",
    originalPublication: 1910,
    projectGutenbergEbook: 132,
    sourceUrl: ART_OF_WAR_URL,
    importedAt: new Date().toISOString(),
    sha256: sha256(bytes),
    licenseNote: "Project Gutenberg distribution terms are included in the downloaded text. Verify local public-domain rules before redistribution.",
  }, null, 2), { encoding: "utf8", mode: 0o600 });
  const sync = await syncRagIntoPersistentMemory();
  return {
    filePath: relative(file),
    sourcePath: relative(source),
    ragRevision: await calculateRagRevision(),
    sync,
  };
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
    const bytes = await fetchApprovedText({
      url,
      capability: "huggingface_import",
      reason: `Import explicitly selected text file ${file} from Hugging Face repository ${repoId}@${revision} into RAG.`,
      network: input.network,
      maxBytes: MAX_FILE_BYTES,
      authorization: process.env.HUGGINGFACE_TOKEN ? `Bearer ${process.env.HUGGINGFACE_TOKEN}` : undefined,
    });
    const destination = path.resolve(baseDirectory, file);
    if (!destination.startsWith(`${baseDirectory}${path.sep}`)) throw new Error("Hugging Face destination escaped the account RAG directory.");
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes, { encoding: "utf8", mode: 0o600 });
    imported.push({ source: `${repoId}@${revision}/${file}`, destination: relative(destination), sha256: sha256(bytes), sizeBytes: Buffer.byteLength(bytes) });
  }

  const manifest = path.join(baseDirectory, "IMPORT_MANIFEST.json");
  await fs.writeFile(manifest, JSON.stringify({
    repoId,
    revision,
    importedAt: new Date().toISOString(),
    files: imported,
    restrictions: [
      "Text files only",
      "No model weights, pickle files, binaries or executable artifacts",
      "Imported content is data for retrieval and is never executed",
    ],
  }, null, 2), { encoding: "utf8", mode: 0o600 });

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
    const authorization = await requireNetworkAccess({
      sessionId: input.network.sessionId,
      token: input.network.token,
      capability: input.capability,
      targetUrl: currentUrl,
      reason: redirect === 0 ? input.reason : `${input.reason} Follow validated redirect ${redirect}.`,
    });
    const response = await fetch(authorization.url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "accept": "text/plain, text/markdown, application/json, text/csv, application/yaml, text/yaml;q=0.9",
        "user-agent": "T1-RAG-Importer/1.0",
        ...(input.authorization ? { authorization: input.authorization } : {}),
      },
      signal: AbortSignal.timeout(45_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Remote source returned a redirect without a Location header.");
      currentUrl = new URL(location, authorization.url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`Remote text import failed with HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > input.maxBytes) throw new Error(`Remote text file exceeds ${input.maxBytes} bytes.`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Remote text response had no readable body.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > input.maxBytes) {
        await reader.cancel();
        throw new Error(`Remote text file exceeds ${input.maxBytes} bytes.`);
      }
      chunks.push(result.value);
    }
    const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    if (buffer.includes(0)) throw new Error("Binary content is not allowed in RAG text imports.");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  }
  throw new Error("Remote source exceeded the maximum redirect count.");
}

export function isNetworkApprovalRequired(error: unknown): error is NetworkApprovalRequiredError {
  return error instanceof NetworkApprovalRequiredError;
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

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function relative(value: string): string {
  return path.relative(process.cwd(), value).replaceAll(path.sep, "/");
}
