import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();

function findPython() {
  for (const command of ['python3', 'python']) {
    const result = spawnSync(command, ['--version'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    if (result.status === 0) return command;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error(
    'Python was not found on PATH. Install Python and run the Telegram API fetcher with:\n' +
      '  TELEGRAM_FETCH_PHONE=+4512345678 TELEGRAM_FETCH_CODE=12345 python scripts/fetch_telegram_api.py',
  );
  process.exit(1);
}

const result = spawnSync(
  python,
  [path.join(root, 'scripts', 'fetch_telegram_api.py')],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
