import { spawnSync } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const stateDir = path.join(root, '.runtime');
const stateFile = path.join(stateDir, 'deployment-state.json');

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

const platform = process.env.REPL_ID
  ? 'replit'
  : process.env.MANUS_PROJECT_ID || process.env.MANUS_ENV
    ? 'manus'
    : process.env.TERMUX_VERSION
      ? 'termux'
      : 'local';

console.log(`Deployment bootstrap detected: ${platform}`);
run('pnpm', ['setup']);

const googleDriveConnected = Boolean(
  process.env.GOOGLE_DRIVE_CONNECTION_ID ||
  process.env.GOOGLE_DRIVE_ACCESS_TOKEN ||
  process.env.GOOGLE_DRIVE_RAG_PATH,
);

await mkdir(stateDir, { recursive: true });
await writeFile(
  stateFile,
  `${JSON.stringify({
    platform,
    googleDriveConnected,
    checkedAt: new Date().toISOString(),
  }, null, 2)}\n`,
);

if (!googleDriveConnected) {
  console.log('\nGoogle Drive authorization is required before automatic RAG sync.');
  if (platform === 'replit') {
    console.log('Open Replit Connections, select Google Drive, approve access, then run: pnpm deployment:start');
  } else if (platform === 'manus') {
    console.log('Connect Google Drive in Manus, authorize access, then rerun this deployment command.');
  } else {
    console.log('Set GOOGLE_DRIVE_RAG_PATH to a local folder synchronized or downloaded from Google Drive.');
  }
  console.log('OAuth consent cannot be bypassed or stored in GitHub. The platform must retain the connection securely.');
  process.exit(2);
}

console.log('\nGoogle Drive connection detected. Synchronizing RAG files...');
run('pnpm', ['rag:sync']);

console.log('\nBuilding application...');
run('pnpm', ['build'], { ...process.env, BASE_PATH: process.env.BASE_PATH ?? '/' });

console.log('\nDeployment preparation complete. Starting application...');
run('pnpm', ['start'], { ...process.env, NODE_ENV: 'production' });
