#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const base = process.env.RAG_PRESERVATION_BASE ?? resolveBase();
const output = execFileSync("git", ["diff", "--name-status", "--find-renames", `${base}...HEAD`, "--", "rag"], { encoding: "utf8" }).trim();
const violations = [];

for (const line of output.split(/\r?\n/).filter(Boolean)) {
  const [status, ...paths] = line.split("\t");
  if (status === "A") continue;
  violations.push({ status, paths });
}

if (violations.length > 0) {
  console.error("RAG preservation violation: existing rag/** files are immutable. Only additions are permitted.");
  for (const violation of violations) console.error(`- ${violation.status}: ${violation.paths.join(" -> ")}`);
  process.exit(1);
}

console.log(`RAG preservation check passed against ${base}. Existing files were not modified, deleted or renamed.`);

function resolveBase() {
  const candidates = [
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "",
    "origin/main",
    "main",
    "HEAD^",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync("git", ["rev-parse", "--verify", candidate], { stdio: "ignore" });
      return candidate;
    } catch {
      // Try the next available base.
    }
  }
  throw new Error("Could not resolve a Git base for the RAG preservation check.");
}
