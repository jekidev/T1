import fs from "node:fs";
import path from "node:path";

function containsWorkspaceMarker(directory: string): boolean {
  return fs.existsSync(path.join(directory, "pnpm-workspace.yaml")) && fs.existsSync(path.join(directory, "package.json"));
}

export function findProjectRoot(startDirectory = process.cwd()): string {
  let current = path.resolve(startDirectory);
  while (true) {
    if (containsWorkspaceMarker(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(startDirectory);
    current = parent;
  }
}

export const projectRoot = findProjectRoot();
