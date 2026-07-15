import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectRoot } from "./project-root";

const execFileAsync = promisify(execFile);
const directTextExtensions = new Set([".md", ".txt", ".text", ".json", ".csv", ".yaml", ".yml"]);
const extractableDocumentExtensions = new Set([".pdf", ".doc", ".docx"]);

export const wisdomDocumentExtensions = new Set([
  ...directTextExtensions,
  ...extractableDocumentExtensions,
]);

export interface ExtractedDocumentText {
  content: string;
  extraction: "direct" | "python" | "companion" | "unavailable";
  warning?: string;
}

async function companionText(file: string): Promise<string | null> {
  for (const candidate of [`${file}.md`, `${file}.txt`, file.replace(/\.[^.]+$/, ".md"), file.replace(/\.[^.]+$/, ".txt")]) {
    try {
      const value = (await fs.readFile(candidate, "utf8")).trim();
      if (value) return value;
    } catch {
      // Try the next companion representation.
    }
  }
  return null;
}

export async function extractDocumentText(file: string, maxCharacters = 120_000): Promise<ExtractedDocumentText> {
  const extension = path.extname(file).toLowerCase();
  if (directTextExtensions.has(extension)) {
    return {
      content: (await fs.readFile(file, "utf8")).slice(0, maxCharacters),
      extraction: "direct",
    };
  }

  if (!extractableDocumentExtensions.has(extension)) {
    return { content: "", extraction: "unavailable", warning: `Unsupported document extension: ${extension || "none"}` };
  }

  const helper = path.resolve(projectRoot, "scripts/extract_document.py");
  const pythonCommands = [process.env.PYTHON_BIN?.trim(), "python3", "python"].filter((value): value is string => Boolean(value));
  const failures: string[] = [];

  for (const command of [...new Set(pythonCommands)]) {
    try {
      const { stdout } = await execFileAsync(command, [helper, file, "--max-chars", String(maxCharacters)], {
        cwd: projectRoot,
        encoding: "utf8",
        timeout: 45_000,
        maxBuffer: Math.max(1_000_000, maxCharacters * 2),
      });
      const content = stdout.trim();
      if (content) return { content, extraction: "python" };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  const companion = await companionText(file);
  if (companion) {
    return {
      content: companion.slice(0, maxCharacters),
      extraction: "companion",
      warning: failures.at(-1),
    };
  }

  return {
    content: "",
    extraction: "unavailable",
    warning: failures.at(-1) ?? "No extractor was available.",
  };
}
