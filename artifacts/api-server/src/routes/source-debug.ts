import fs from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter } from "express";
import { recordObservabilityEvent } from "../lib/observability";

const router: IRouter = Router();
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css", ".html", ".yml", ".yaml"]);
const excluded = new Set([".git", "node_modules", ".runtime", "dist", "build", ".next", "coverage", "integrations/vendor"]);

async function walk(directory: string, output: string[] = []): Promise<string[]> {
  const relative = path.relative(process.cwd(), directory).replaceAll(path.sep, "/");
  if ([...excluded].some((entry) => relative === entry || relative.startsWith(`${entry}/`))) return output;
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full, output);
    else if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) output.push(full);
  }
  return output;
}

async function sourceBundle(maxCharacters = 180_000): Promise<{ content: string; files: number; truncated: boolean }> {
  const files = await walk(process.cwd());
  const blocks: string[] = [];
  let used = 0;
  let included = 0;
  for (const file of files) {
    const stat = await fs.stat(file);
    if (stat.size > 300_000) continue;
    const text = await fs.readFile(file, "utf8");
    const relative = path.relative(process.cwd(), file).replaceAll(path.sep, "/");
    const block = `\n\n===== FILE: ${relative} =====\n${text}`;
    if (used + block.length > maxCharacters) break;
    blocks.push(block);
    used += block.length;
    included += 1;
  }
  return { content: blocks.join(""), files: included, truncated: included < files.length };
}

async function freeCodingModels(apiKey: string): Promise<string[]> {
  const configured = (process.env.OPENROUTER_CODE_MODELS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (configured.length) return configured;
  const response = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) return [];
  const body = await response.json() as { data?: Array<{ id: string; pricing?: Record<string, string | number> }> };
  return (body.data ?? [])
    .filter((model) => /coder|code/i.test(model.id))
    .filter((model) => [model.pricing?.prompt, model.pricing?.completion, model.pricing?.request].every((value) => Number(value ?? 0) === 0))
    .sort((a, b) => Number(/qwen/i.test(b.id)) - Number(/qwen/i.test(a.id)))
    .map((model) => model.id)
    .slice(0, 8);
}

async function debugWithModel(messages: unknown[], model: string, apiKey: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Urban Strategy Source Debugger" },
    body: JSON.stringify({ model, messages, temperature: 0.15, max_tokens: 5000 }),
  });
  if (!response.ok) throw new Error(`${model}: HTTP ${response.status} ${(await response.text()).slice(0, 400)}`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`${model}: empty response`);
  return content;
}

router.post("/source-debug/run", async (req, res): Promise<void> => {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || (process.env.OPENROUTER_API_KEYS ?? "").split(",")[0]?.trim();
  if (!apiKey) {
    res.status(503).json({ message: "OpenRouter key is not configured" });
    return;
  }

  const bundle = await sourceBundle(Number(process.env.SOURCE_DEBUG_MAX_CHARS ?? 180_000));
  const request = typeof req.body?.request === "string" ? req.body.request.slice(0, 4000) : "Debug the complete source code and prioritize build errors, runtime failures, data loss, security boundaries, and broken integrations.";
  const models = await freeCodingModels(apiKey);
  if (!models.length) {
    res.status(503).json({ message: "No free coding model is currently available from OpenRouter. Set OPENROUTER_CODE_MODELS to override." });
    return;
  }

  const messages = [
    { role: "system", content: "You are a senior TypeScript/React/Express code debugger. Review the supplied repository snapshot. Report concrete findings with file paths, severity, evidence, minimal fixes, and validation commands. Do not invent files or claim fixes were applied." },
    { role: "user", content: `${request}\n\nRepository snapshot (${bundle.files} files; truncated=${bundle.truncated}):${bundle.content}` },
  ];

  const failures: string[] = [];
  for (const model of models) {
    try {
      const report = await debugWithModel(messages, model, apiKey);
      recordObservabilityEvent({ source: "system", level: "info", type: "source-debug.completed", message: `Source debugging completed with ${model}`, data: { model, files: bundle.files, truncated: bundle.truncated } });
      res.json({ model, files: bundle.files, truncated: bundle.truncated, report });
      return;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  recordObservabilityEvent({ source: "system", level: "error", type: "source-debug.failed", message: "All free coding models failed", data: { failures } });
  res.status(502).json({ message: "All free coding models failed", failures });
});

export default router;
