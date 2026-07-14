import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourceDir = path.resolve(process.env.GOOGLE_DRIVE_RAG_PATH ?? path.join(projectRoot, 'rag/google-drive'));
const inboxDir = path.resolve(projectRoot, 'rag/inbox');
const manifestPath = path.join(inboxDir, 'manifest.json');
const supportedExtensions = new Set(['.pdf', '.txt', '.md', '.docx', '.json', '.csv']);

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
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
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

await mkdir(inboxDir, { recursive: true });
const manifest = [];
const seenHashes = new Set();

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

await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: sourceDir, files: manifest }, null, 2)}\n`);
console.log(`Google Drive RAG sync complete: ${manifest.length} unique files`);
