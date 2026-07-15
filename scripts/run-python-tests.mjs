import { spawnSync } from 'node:child_process';

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
  console.error('Python was not found on PATH. Install Python to run the tests.');
  process.exit(1);
}

const result = spawnSync(
  python,
  ['-m', 'unittest', 'discover', '-s', 'scripts/tests', '-p', 'test_*.py', '-v'],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
