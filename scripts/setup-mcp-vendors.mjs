import { mkdir, access } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const vendorDir = path.join(root, 'integrations', 'vendor');

const vendors = [
  {
    name: 'telegram-mcp',
    repository: 'https://github.com/chigwell/telegram-mcp.git',
    branch: 'main',
    required: true,
    uvSync: true,
  },
  {
    name: 'tg_auth_api',
    repository: 'https://github.com/megahomyak/tg_auth_api.git',
    branch: 'master',
    required: true,
  },
  {
    name: 'telegram-api',
    repository: 'https://github.com/Anon4You/Telegram-Api.git',
    branch: 'main',
    required: false,
    pipSync: true,
  },
];

function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function tryUvSync(target, required) {
  try {
    console.log(`Syncing ${path.relative(root, target)} with uv...`);
    await run('uv', ['sync'], target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to sync ${path.relative(root, target)}:`, message);
    if (required) process.exitCode = 1;
  }
}

function findPython() {
  for (const command of ['python3', 'python']) {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
    if (result.status === 0) return command;
  }
  return null;
}

async function tryPipSync(target, required) {
  const python = findPython();
  if (!python) {
    console.warn(`Python not found; skipping pip sync for ${path.relative(root, target)}.`);
    if (required) process.exitCode = 1;
    return;
  }
  try {
    console.log(`Installing Python dependencies for ${path.relative(root, target)}...`);
    await run(python, ['-m', 'pip', 'install', '-r', 'requirements.txt'], target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to install Python dependencies for ${path.relative(root, target)}:`, message);
    if (required) process.exitCode = 1;
  }
}

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

await mkdir(vendorDir, { recursive: true });

for (const vendor of vendors) {
  const target = path.join(vendorDir, vendor.name);
  try {
    if (await exists(path.join(target, '.git'))) {
      console.log(`Updating ${vendor.name}...`);
      await run('git', ['fetch', '--depth', '1', 'origin', vendor.branch], target);
      await run('git', ['reset', '--hard', `origin/${vendor.branch}`], target);
    } else {
      console.log(`Cloning ${vendor.name}...`);
      await run('git', ['clone', '--depth', '1', '--branch', vendor.branch, vendor.repository, target]);
    }
    if (vendor.uvSync) {
      await tryUvSync(target, vendor.required);
    }
    if (vendor.pipSync) {
      await tryPipSync(target, vendor.required);
    }
  } catch (error) {
    console.error(`Failed to install ${vendor.name}:`, error instanceof Error ? error.message : error);
    if (vendor.required) process.exitCode = 1;
  }
}

console.log('\nMCP vendor setup complete.');
console.log('Telegram credentials must be stored in platform secrets, never committed.');
console.log('Run Telegram MCP with TELEGRAM_EXPOSED_TOOLS=all only when modify tools are intended and approved.');
