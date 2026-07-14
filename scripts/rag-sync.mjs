import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const inboxDir = path.resolve(projectRoot, process.env.RAG_INBOX_DIR ?? 'rag/inbox');
const manifestPath = path.join(inboxDir, 'manifest.json');
const supportedExtensions = new Set(['.pdf', '.txt', '.md', '.docx', '.json', '.csv']);

function configuredSources() {
  const envSources = process.env.RAG_SOURCE_PATHS
    ?.split(path.delimiter)
    .map((value) => value.trim())
    .filter(Boolean);

  if (envSources?.length) return envSources;

  return [
    path.resolve(projectRoot, 'rag/HackerAI_documents'),
    path.resolve(projectRoot, 'rag/external/google-drive'),
    path.resolve(projectRoot, 'rag/external/proton-drive'),
  ];
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const files = [];
  if (!(await exists(directory))) return files;

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else if (entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }

  return files;
}

async function sha256(filePath) {
  const data = await readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

await mkdir(inboxDir, { recursive: true });
const manifest = [];
const seenHashes = new Set();

for (const sourceDir of configuredSources()) {
  for (const sourceFile of await walk(sourceDir)) {
    const hash = await sha256(sourceFile);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    const extension = path.extname(sourceFile).toLowerCase();
    const baseName = path.basename(sourceFile, extension).replace(/[^a-zA-Z0-9._-]+/g, '_');
    const targetName = `${baseName}-${hash.slice(0, 12)}${extension}`;
    const targetPath = path.join(inboxDir, targetName);

    if (!(await exists(targetPath))) await copyFile(sourceFile, targetPath);
    const fileStat = await stat(sourceFile);

    manifest.push({
      source: sourceFile,
      storedAs: path.relative(projectRoot, targetPath),
      sha256: hash,
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
    });
  }
}

await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2)}\n`);
console.log(`RAG sync complete: ${manifest.length} unique files in ${path.relative(projectRoot, inboxDir)}`);
