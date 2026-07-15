import { mkdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const vendorDir = path.join(root, 'integrations', 'vendor');

const vendors = [
  {
    name: 'telegram-mcp',
    repository: 'https://github.com/chigwell/telegram-mcp.git',
    branch: 'main',
    required: true,
  },
  {
    name: 'telegram-mcp-1',
    repository: 'https://github.com/jekidev/telegram-mcp-1.git',
    branch: 'main',
    required: true,
  },
  {
    name: 'tg_auth_api',
    repository: 'https://github.com/megahomyak/tg_auth_api.git',
    branch: 'master',
    required: true,
  },
  {
    name: 'agents-sms',
    repository: 'https://github.com/gonchasobaka/agents-sms.git',
    branch: 'main',
    required: true,
    build: [
      ['npm', ['install', '--ignore-scripts']],
      ['node', ['node_modules/esbuild/bin/esbuild', 'src/index.ts', '--bundle', '--platform=node', '--outfile=dist/index.js', '--format=cjs']],
    ],
  },
  {
    name: 'signal-cli-mcp',
    repository: 'https://github.com/jiridudekusy/signal-cli-mcp.git',
    branch: 'main',
    required: true,
    build: [
      ['npm', ['install']],
      ['npm', ['run', 'build']],
    ],
  },
];

function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
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

    if (vendor.build) {
      console.log(`Building ${vendor.name}...`);
      for (const [command, args] of vendor.build) {
        await run(command, args, target);
      }
    }
  } catch (error) {
    console.error(`Failed to install ${vendor.name}:`, error instanceof Error ? error.message : error);
    if (vendor.required) process.exitCode = 1;
  }
}

console.log('\nMCP vendor setup complete.');
console.log('Telegram credentials must be stored in platform secrets, never committed.');
console.log('Run Telegram MCP with TELEGRAM_EXPOSED_TOOLS=all only when modify tools are intended and approved.');
console.log('5sim SMS API requires FIVESIM_API_KEY (or SMSACTIVATE_API_KEY / ONLINESIM_API_KEY) in environment variables.');
console.log('Signal CLI MCP requires SIGNAL_ACCOUNT and a running signal-cli-rest-api instance (see docker-compose in integrations/vendor/signal-cli-mcp).');
console.log('telegram-mcp-1 requires TELEGRAM_API_ID, TELEGRAM_API_HASH and TELEGRAM_SESSION_STRING (or TELEGRAM_SESSION_NAME) in environment variables.');
