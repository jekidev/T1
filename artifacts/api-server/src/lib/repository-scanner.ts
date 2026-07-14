import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  buildRepositoryMap,
  isProtectedPath,
  type RepositoryAnalysisInput,
  type RepositoryFileSummary,
  type RepositoryMap,
} from "@workspace/coding-agent";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".local",
  "data",
  "tmp",
  ".venv",
  "__pycache__",
]);

const IGNORED_FILE_PATTERNS = [
  /^\.env(?:\.|$)/,
  /(?:^|\/)(?:secret|credential|token|cookie)s?\.(?:json|ya?ml|txt|pem|key)$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
];

export async function scanRepositoryForCodingAgent(rootInput = process.env.CODING_AGENT_REPOSITORY_ROOT ?? process.cwd()): Promise<RepositoryMap> {
  const root = await realpath(rootInput);
  const rootStats = await stat(root);
  if (!rootStats.isDirectory()) throw new Error("CODING_AGENT_REPOSITORY_ROOT must be a directory.");

  const maximumFiles = positiveInteger(process.env.CODING_AGENT_MAX_REPOSITORY_FILES, 30_000);
  const maximumHashBytes = positiveInteger(process.env.CODING_AGENT_MAX_HASH_BYTES, 2 * 1024 * 1024);
  const files: RepositoryFileSummary[] = [];
  const manifests: Array<{ path: string; content: string }> = [];
  let codeowners = "";

  const queue = [root];
  while (queue.length > 0) {
    const directory = queue.shift()!;
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = toRepoPath(path.relative(root, absolute));
      if (!relative) continue;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name) && !isProtectedRuntimeDirectory(relative)) queue.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (shouldIgnoreFile(relative)) continue;
      const entryStats = await lstat(absolute);
      if (entryStats.isSymbolicLink()) continue;
      if (files.length >= maximumFiles) throw new Error(`Repository scan exceeded ${maximumFiles} files.`);

      const file: RepositoryFileSummary = {
        path: relative,
        language: detectLanguage(relative),
        bytes: entryStats.size,
        protected: isProtectedPath(relative),
        generated: isGeneratedFile(relative),
        test: isTestFile(relative),
      };
      if (entryStats.size <= maximumHashBytes) {
        const content = await readFile(absolute);
        file.sha256 = createHash("sha256").update(content).digest("hex");
        if (isManifest(relative) && entryStats.size <= 512 * 1024) {
          manifests.push({ path: relative, content: content.toString("utf8") });
        }
        if (relative === ".github/CODEOWNERS" || relative === "CODEOWNERS") {
          codeowners = content.toString("utf8").slice(0, 2 * 1024 * 1024);
        }
      }
      files.push(file);
    }
  }

  const input: RepositoryAnalysisInput = {
    baseCommit: await resolveBaseCommit(root),
    files,
    manifests,
    codeowners,
  };
  return buildRepositoryMap(input);
}

async function resolveBaseCommit(root: string): Promise<string> {
  const environment = process.env.GIT_COMMIT_SHA
    ?? process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.REPLIT_GIT_COMMIT_SHA;
  if (environment && /^[a-f0-9]{7,80}$/i.test(environment)) return environment;
  try {
    const head = (await readFile(path.join(root, ".git/HEAD"), "utf8")).trim();
    if (/^[a-f0-9]{40}$/i.test(head)) return head;
    const match = head.match(/^ref:\s+(.+)$/);
    if (match?.[1]) {
      const value = (await readFile(path.join(root, ".git", match[1]), "utf8")).trim();
      if (/^[a-f0-9]{40}$/i.test(value)) return value;
    }
  } catch {
    // Packaged deployments may not contain Git metadata.
  }
  return "unavailable0000000000000000000000000000000000";
}

function shouldIgnoreFile(relative: string): boolean {
  const basename = relative.split("/").at(-1) ?? relative;
  return IGNORED_FILE_PATTERNS.some(pattern => pattern.test(basename) || pattern.test(relative));
}

function isProtectedRuntimeDirectory(relative: string): boolean {
  return relative === "data" || relative.startsWith("data/") || relative === "secrets" || relative.startsWith("secrets/");
}

function isManifest(relative: string): boolean {
  return relative.endsWith("package.json")
    || relative.endsWith("pyproject.toml")
    || relative.endsWith("requirements.txt")
    || relative.endsWith("Cargo.toml");
}

function isGeneratedFile(relative: string): boolean {
  return /(?:^|\/)(?:generated|dist|build|coverage)(?:\/|$)/i.test(relative)
    || /\.(?:min\.js|map|d\.ts)$/i.test(relative)
    || /pnpm-lock\.yaml$/.test(relative);
}

function isTestFile(relative: string): boolean {
  return /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)/i.test(relative)
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(relative)
    || /_test\.py$/i.test(relative);
}

function detectLanguage(relative: string): string | undefined {
  const extension = path.extname(relative).toLowerCase();
  return ({
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".rs": "Rust",
    ".go": "Go",
    ".java": "Java",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".md": "Markdown",
    ".css": "CSS",
    ".html": "HTML",
  } as Record<string, string>)[extension];
}

function toRepoPath(value: string): string {
  return value.replaceAll(path.sep, "/").replace(/^\.\//, "");
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
