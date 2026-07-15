import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "artifacts/command-sim/dist/public");
const output = path.join(root, ".vercel-static");

const result = spawnSync("pnpm", ["--filter", "@workspace/command-sim", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, NODE_ENV: "production" },
});
if (result.status !== 0) process.exit(result.status ?? 1);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
console.log(`Vercel static output prepared at ${output}`);
