import { access, lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  buildRepositoryMap,
  type RepositoryFileSummary,
  type RepositoryMap,
} from "@workspace/coding-agent";

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".cache",
  ".local",
  ".next",
  ".turbo",
  ".venv",
  "__pycache__",
  "coverage",
  "data",
  "dist",
  "node_modules",
  "out-tsc",
  "tmp",
  "work",
]);

const GENERATED_SUFFIXES = [".map", ".min.js", ".min.css", ".d.ts"];
const TEST_PATTERN = /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/i;
const MAX_FILES = 50_000;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;

export async function buildCurrentRepositoryMap(): Promise<RepositoryMap> {
  const root = await findWorkspaceRoot();
  const baseCommit = configuredBaseCommit();
  const files: RepositoryFileSummary[] = [];
  const manifests: Array<{ path: string; content: string }> = [];
  let codeowners = "";

  await walk(root, root, files, manifests, value => { codeowners = value; });
  return buildRepositoryMap({
    baseCommit,
    files,
    manifests,
    ...(codeowners ? { codeowners } : {}),
  });
}

export function configuredBaseCommit(): string {
  const value = (
    process.env.CODING_AGENT_BASE_COMMIT
    ?? process.env.SOURCE_COMMIT_SHA
    ?? process.env.GITHUB_SHA
    ?? process.env.REPLIT_GIT_COMMIT_SHA
    ?? ""
  ).trim();
  if (!/^[a-fA-F0-9]{7,64}$/.test(value)) {
    throw new Error("A concrete Git commit SHA is required in CODING_AGENT_BASE_COMMIT or the deployment commit environment.");
  }
  return value.toLowerCase();
}

export async function findWorkspaceRoot(start = process.cwd()): Promise<string> {
  const configured = process.env.CODING_AGENT_REPOSITORY_ROOT?.trim();
  if (configured) {
    const root = path.resolve(configured);
    await access(path.join(root, "pnpm-workspace.yaml"));
    return root;
  }

  let current = path.resolve(start);
  for (let depth = 0; depth < 10; depth += 1) {
    try {
      await access(path.join(current, "pnpm-workspace.yaml"));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error("Could not locate repository root containing pnpm-workspace.yaml.");
}

async function walk(
  root: string,
  directory: string,
  files: RepositoryFileSummary[],
  manifests: Array<{ path: string; content: string }>,
  setCodeowners: (content: string) => void,
): Promise<void> {
  if (files.length >= MAX_FILES) throw new Error(`Repository map exceeds the ${MAX_FILES}-file limit.`);
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (files.length >= MAX_FILES) throw new Error(`Repository map exceeds the ${MAX_FILES}-file limit.`);
    const absolute = path.join(directory, entry.name);
    const relative = normalizeRelative(root, absolute);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name) || relative === "rag/inbox" || relative === "rag/google-drive") continue;
      await walk(root, absolute, files, manifests, setCodeowners);
      continue;
    }
    if (!entry.isFile()) continue;

    const stat = await lstat(absolute);
    const protectedFile = isSensitiveRepositoryFile(relative);
    files.push({
      path: relative,
      ...(languageFor(relative) ? { language: languageFor(relative) } : {}),
      bytes: stat.size,
      protected: protectedFile,
      generated: GENERATED_SUFFIXES.some(suffix => relative.toLowerCase().endsWith(suffix)),
      test: TEST_PATTERN.test(relative),
      summary: protectedFile
        ? "Protected metadata entry; content is not included in agent context."
        : summarizePath(relative, stat.size),
    });

    if (relative.endsWith("package.json") && stat.size <= MAX_MANIFEST_BYTES && !protectedFile) {
      manifests.push({ path: relative, content: await readFile(absolute, "utf8") });
    }
    if ((relative === ".github/CODEOWNERS" || relative === "CODEOWNERS") && stat.size <= MAX_MANIFEST_BYTES) {
      setCodeowners(await readFile(absolute, "utf8"));
    }
  }
}

function normalizeRelative(root: string, absolute: string): string {
  const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
  if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("Repository traversal escaped the configured root.");
  }
  return relative;
}

function isSensitiveRepositoryFile(relative: string): boolean {
  const lower = relative.toLowerCase();
  return lower === ".env"
    || lower.startsWith(".env.")
    || lower.includes("/secrets/")
    || lower.includes("/credentials/")
    || /(?:^|\/)(?:id_rsa|id_ed25519|.*\.pem|.*\.key)$/.test(lower);
}

function summarizePath(relative: string, bytes: number): string {
  const segments = relative.split("/");
  const module = segments.length >= 2 ? `${segments[0]}/${segments[1]}` : "repository root";
  return `${languageFor(relative) ?? "file"} in ${module}; ${bytes} bytes. Source content is fetched only for task-relevant allowlisted files by the external sandbox worker.`;
}

function languageFor(relative: string): string | undefined {
  const extension = path.extname(relative).toLowerCase();
  const languages: Record<string, string> = {
    ".css": "CSS",
    ".html": "HTML",
    ".js": "JavaScript",
    ".json": "JSON",
    ".md": "Markdown",
    ".mjs": "JavaScript",
    ".py": "Python",
    ".sh": "Shell",
    ".sql": "SQL",
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".yaml": "YAML",
    ".yml": "YAML",
  };
  if (relative.endsWith("Dockerfile")) return "Dockerfile";
  return languages[extension];
}
