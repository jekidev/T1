import { access, copyFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env');
const envExample = path.join(root, '.env.example');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

const major = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(major) || major < 22) {
  console.error('\nNode.js 22 or newer is required.');
  console.error('Termux: pkg install nodejs');
  console.error('Replit: import the repository and keep the configured Node module.');
  process.exit(1);
}

console.log(`Node ${process.version} detected.`);

let pnpmAvailable = spawnSync('pnpm', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0;
if (!pnpmAvailable) {
  console.log('Enabling pnpm through Corepack...');
  run('corepack', ['enable']);
  run('corepack', ['prepare', 'pnpm@10.13.1', '--activate']);
  pnpmAvailable = true;
}

if (!(await exists(envFile))) {
  await copyFile(envExample, envFile);
  console.log('Created .env from .env.example.');
}

await mkdir(path.join(root, 'rag/inbox'), { recursive: true });
await mkdir(path.join(root, 'rag/google-drive'), { recursive: true });
await mkdir(path.join(root, 'rag/wisdom/common/everyday tips'), { recursive: true });
await mkdir(path.join(root, 'rag/Code/LLM_scripts'), { recursive: true });

console.log('Installing dependencies...');
run('pnpm', ['install', '--frozen-lockfile']);

const python = ['python3', 'python'].find(command => spawnSync(command, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0);
if (python) {
  console.log(`Installing knowledge extraction support with ${python}...`);
  const result = spawnSync(python, ['-m', 'pip', 'install', '-r', 'requirements-knowledge.txt'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) console.warn('Python knowledge dependencies were not installed. TXT/MD/DOCX still work; run pip install -r requirements-knowledge.txt for PDF extraction.');
} else {
  console.warn('Python was not found. Install Python and run pip install -r requirements-knowledge.txt for PDF extraction.');
}

console.log('\nBase installation completed.');
console.log('\nGoogle Drive connection:');
console.log('- Replit: open Tools/Connections, connect Google Drive, and let Replit Agent wire the connection into this project.');
console.log('- Manus: connect Google Drive in Manus, then instruct it to use that connection as the only RAG source.');
console.log('- Local/Termux: download or sync Drive files into rag/google-drive, then run pnpm rag:sync.');
console.log('\nHourly wisdom: add PDF, DOCX, DOC, TXT, TEXT or MD files to rag/wisdom/common/everyday tips.');
console.log('Uber mode proposals are written to rag/Code/LLM_scripts/<model>/ as review-only Markdown.');
console.log('\nCredentials and OAuth tokens must remain in the platform connection/secret store and must never be committed to GitHub.');
console.log('\nNext commands:');
console.log('  pnpm rag:sync');
console.log('  pnpm dev');
