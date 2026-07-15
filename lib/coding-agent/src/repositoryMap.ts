import {
  RepositoryMapSchema,
  type DependencyRecord,
  type OwnershipRule,
  type RepositoryAnalysisInput,
  type RepositoryMap,
  type RepositoryModule,
} from "./types";
import { DEFAULT_PROTECTED_PATHS, isProtectedPath, normalizeRepoPath } from "./policy";

const ENTRYPOINT_NAMES = new Set([
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "main.ts",
  "main.tsx",
  "server.ts",
  "app.tsx",
  "worker.py",
  "package.json",
  "dockerfile",
]);

export function buildRepositoryMap(input: RepositoryAnalysisInput): RepositoryMap {
  const files = input.files
    .map(file => ({
      ...file,
      path: normalizeRepoPath(file.path),
      protected: file.protected || isProtectedPath(file.path),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const modules = buildModules(files.map(file => file.path), input.manifests ?? []);
  const dependencies = parseDependencies(input.manifests ?? []);
  const scripts = parseScripts(input.manifests ?? []);
  const ownershipRules = parseCodeowners(input.codeowners ?? "");
  const protectedPaths = [...new Set([
    ...DEFAULT_PROTECTED_PATHS,
    ...files.filter(file => file.protected).map(file => file.path),
  ])].sort();

  return RepositoryMapSchema.parse({
    baseCommit: input.baseCommit,
    files,
    modules,
    dependencies,
    entryPoints: files.filter(file => ENTRYPOINT_NAMES.has(file.path.split("/").at(-1)?.toLowerCase() ?? "")).map(file => file.path),
    protectedPaths,
    testCommands: scripts.testCommands,
    buildCommands: scripts.buildCommands,
    ownershipRules,
    generatedAt: new Date().toISOString(),
  });
}

function buildModules(paths: readonly string[], manifests: readonly { path: string; content: string }[]): RepositoryModule[] {
  const manifestRoots = new Map<string, { dependencies: string[]; kind: RepositoryModule["kind"] }>();
  for (const manifest of manifests) {
    const path = normalizeRepoPath(manifest.path);
    const root = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
    const parsed = parseJson(manifest.content);
    const dependencies = parsed && typeof parsed === "object"
      ? [...new Set(Object.keys(asRecord((parsed as Record<string, unknown>).dependencies)).concat(Object.keys(asRecord((parsed as Record<string, unknown>).devDependencies))))].sort()
      : [];
    manifestRoots.set(root, { dependencies, kind: inferModuleKind(root) });
  }

  const roots = new Set<string>(manifestRoots.keys());
  for (const path of paths) {
    const segments = path.split("/");
    if (segments[0] && ["artifacts", "lib", "services", "scripts", "docs", "deployment", "integrations"].includes(segments[0])) {
      roots.add(segments.length >= 2 ? `${segments[0]}/${segments[1]}` : segments[0]);
    }
  }

  return [...roots].sort().map(root => {
    const prefix = root === "." ? "" : `${root}/`;
    const files = paths.filter(path => root === "." ? !path.includes("/") : path === root || path.startsWith(prefix));
    const metadata = manifestRoots.get(root);
    return {
      id: root === "." ? "root" : root.replaceAll("/", ":"),
      root,
      kind: metadata?.kind ?? inferModuleKind(root),
      files,
      dependencies: metadata?.dependencies ?? [],
    };
  }).filter(module => module.files.length > 0);
}

function parseDependencies(manifests: readonly { path: string; content: string }[]): DependencyRecord[] {
  const output: DependencyRecord[] = [];
  for (const manifest of manifests) {
    const parsed = parseJson(manifest.content);
    if (!parsed || typeof parsed !== "object") continue;
    const record = parsed as Record<string, unknown>;
    addDependencies(output, manifest.path, asRecord(record.dependencies), "runtime");
    addDependencies(output, manifest.path, asRecord(record.devDependencies), "development");
    addDependencies(output, manifest.path, asRecord(record.optionalDependencies), "optional");
    addDependencies(output, manifest.path, asRecord(record.peerDependencies), "peer");
  }
  return output.sort((a, b) => a.name.localeCompare(b.name) || a.manifestPath.localeCompare(b.manifestPath));
}

function addDependencies(
  output: DependencyRecord[],
  manifestPath: string,
  dependencies: Record<string, unknown>,
  scope: DependencyRecord["scope"],
): void {
  for (const [name, value] of Object.entries(dependencies)) {
    if (typeof value !== "string") continue;
    output.push({ name, version: value, scope, manifestPath: normalizeRepoPath(manifestPath) });
  }
}

function parseScripts(manifests: readonly { path: string; content: string }[]): { testCommands: string[]; buildCommands: string[] } {
  const testCommands = new Set<string>();
  const buildCommands = new Set<string>();
  for (const manifest of manifests) {
    const parsed = parseJson(manifest.content);
    if (!parsed || typeof parsed !== "object") continue;
    const scripts = asRecord((parsed as Record<string, unknown>).scripts);
    for (const [name, value] of Object.entries(scripts)) {
      if (typeof value !== "string") continue;
      const command = `pnpm --dir ${shellQuote(directoryOf(manifest.path))} run ${name}`;
      if (/^(test|lint|typecheck|check|smoke|audit)/.test(name)) testCommands.add(command);
      if (/^(build|compile|bundle)/.test(name)) buildCommands.add(command);
    }
  }
  return { testCommands: [...testCommands].sort(), buildCommands: [...buildCommands].sort() };
}

function parseCodeowners(content: string): OwnershipRule[] {
  const rules: OwnershipRule[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    if (!pattern || owners.length === 0) continue;
    rules.push({
      pattern,
      owners,
      requiresExternalReview: /coding-agent|agent-policy|security|auth|billing|deployment/i.test(pattern),
    });
  }
  return rules;
}

function inferModuleKind(root: string): RepositoryModule["kind"] {
  if (root.startsWith("artifacts/")) return "application";
  if (root.startsWith("lib/")) return "library";
  if (root.startsWith("services/")) return "service";
  if (root.startsWith("scripts/")) return "script";
  if (root.startsWith("docs/")) return "documentation";
  if (root.startsWith("deployment/") || root.startsWith("integrations/")) return "configuration";
  return "unknown";
}

function parseJson(content: string): unknown {
  try { return JSON.parse(content); } catch { return undefined; }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function directoryOf(pathInput: string): string {
  const path = normalizeRepoPath(pathInput);
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
