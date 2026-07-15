import test from "node:test";
import assert from "node:assert/strict";
import { buildRepositoryMap } from "./repositoryMap";

void test("repository map extracts modules dependencies and commands", () => {
  const map = buildRepositoryMap({
    baseCommit: "abcdef1234567890",
    files: [
      { path: "package.json", bytes: 200, protected: false, generated: false, test: false },
      { path: "lib/example/package.json", bytes: 100, protected: false, generated: false, test: false },
      { path: "lib/example/src/index.ts", bytes: 80, protected: false, generated: false, test: false },
      { path: "deployment/secret.ts", bytes: 20, protected: false, generated: false, test: false },
    ],
    manifests: [
      { path: "package.json", content: JSON.stringify({ scripts: { build: "tsc", test: "tsx --test" }, dependencies: { zod: "1.0.0" } }) },
      { path: "lib/example/package.json", content: JSON.stringify({ dependencies: { miniplex: "2.0.0" } }) },
    ],
    codeowners: "/lib/coding-agent/ @security\n/lib/example/ @team-example",
  });

  assert.ok(map.modules.some(module => module.root === "lib/example"));
  assert.ok(map.dependencies.some(dependency => dependency.name === "zod"));
  assert.ok(map.testCommands.some(command => command.includes("run test")));
  assert.ok(map.buildCommands.some(command => command.includes("run build")));
  assert.ok(map.protectedPaths.some(path => path === "deployment/secret.ts"));
  assert.ok(map.ownershipRules.some(rule => rule.owners.includes("@security")));
});
