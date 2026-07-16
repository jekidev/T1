import fs from "node:fs/promises";
import path from "node:path";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
const knowledgeRoot = path.resolve(process.cwd(), "knowledge");

interface Chunk {
  chunk_id: string;
  canonical_chunk_id?: string;
  document_sha256: string;
  source_name: string;
  page: number;
  risk_tier: string;
  retrieval_default: boolean;
  tags?: string[];
  text: string;
}

interface QueryRequest {
  query?: unknown;
  topK?: unknown;
  tag?: unknown;
  includeQuarantine?: unknown;
  canonicalOnly?: unknown;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function tokenize(input: string): string[] {
  return (input.match(/[\wæøåÆØÅ-]+/g) ?? [])
    .filter((t) => t.length > 1)
    .map((t) => t.toLowerCase());
}

async function readIndex(name: string): Promise<Chunk[]> {
  const filePath = path.join(knowledgeRoot, "rag", name);
  const text = await fs.readFile(filePath, "utf8");
  const rows: Chunk[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as Chunk);
    } catch {
      // skip malformed lines
    }
  }
  return rows;
}

function scoreRow(row: Chunk, terms: string[]): number {
  const hayParts: string[] = [row.source_name, row.text, ...(row.tags ?? [])];
  const hay = hayParts.join(" ").toLowerCase();
  let score = 0;
  for (const term of terms) {
    const inSource = (row.source_name ?? "").toLowerCase().includes(term);
    const inTags = (row.tags ?? []).some((t) => t.toLowerCase().includes(term));
    const multiplier = inSource ? 3 : inTags ? 2 : 1;
    const count = hay.split(term).length - 1;
    score += count * multiplier;
  }
  return score;
}

router.post("/knowledge/query", async (req, res): Promise<void> => {
  const body = req.body as QueryRequest;
  const rawQuery = isString(body.query) ? body.query.trim() : "";
  const topK = typeof body.topK === "number" ? Math.max(1, Math.min(50, body.topK)) : 10;
  const tag = isString(body.tag) ? body.tag.trim().toLowerCase() : "";
  const includeQuarantine = body.includeQuarantine === true;
  const canonicalOnly = body.canonicalOnly !== false;

  if (!rawQuery) {
    res.status(422).json({ message: "query is required" });
    return;
  }

  const terms = tokenize(rawQuery);
  if (terms.length === 0) {
    res.status(422).json({ message: "query must contain searchable terms" });
    return;
  }

  try {
    const indexes = [canonicalOnly ? "safe-index-canonical.jsonl" : "safe-index.jsonl"];
    if (includeQuarantine) {
      indexes.push(canonicalOnly ? "quarantine-index-canonical.jsonl" : "quarantine-index.jsonl");
    }

    const chunks: Chunk[] = [];
    for (const name of indexes) {
      chunks.push(...(await readIndex(name)));
    }

    const scored = chunks
      .filter((row) => {
        if (!tag) return true;
        return (row.tags ?? []).some((t) => t.toLowerCase() === tag);
      })
      .map((row) => ({ row, score: scoreRow(row, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.row.source_name.localeCompare(b.row.source_name) || a.row.page - b.row.page;
      })
      .slice(0, topK);

    const results = scored.map(({ row, score }) => ({
      chunk_id: row.chunk_id,
      canonical_chunk_id: row.canonical_chunk_id ?? row.chunk_id,
      source_name: row.source_name,
      page: row.page,
      risk_tier: row.risk_tier,
      tags: row.tags ?? [],
      score,
      provenance: {
        document_sha256: row.document_sha256,
        source_name: row.source_name,
        page: row.page,
        chunk_id: row.chunk_id,
      },
      text: row.text.slice(0, 700),
    }));

    res.json({
      query: rawQuery,
      terms,
      topK,
      tag: tag || undefined,
      includeQuarantine,
      canonicalOnly,
      total: results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message: "Failed to query knowledge index", error: message });
  }
});

router.get("/knowledge/indexes", async (_req, res): Promise<void> => {
  try {
    const ragDir = path.join(knowledgeRoot, "rag");
    const files = await fs.readdir(ragDir);
    const jsonl = files.filter((f) => f.endsWith(".jsonl"));
    res.json({ indexes: jsonl, knowledge_root: knowledgeRoot });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message: "Failed to list indexes", error: message });
  }
});

export default router;
