import { NPCMemoryRecordSchema, type NPCMemoryRecord } from "./types";

export interface NPCMemoryQuery {
  tick: number;
  entityIds?: readonly string[];
  tags?: readonly string[];
  text?: string;
  limit?: number;
}

export interface RankedNPCMemory {
  memory: NPCMemoryRecord;
  score: number;
  recencyScore: number;
  relevanceScore: number;
  importanceScore: number;
}

export function appendNpcMemory(
  current: readonly NPCMemoryRecord[],
  input: NPCMemoryRecord,
  maximumRecords = 500,
): NPCMemoryRecord[] {
  const memory = NPCMemoryRecordSchema.parse(input);
  if (!Number.isInteger(maximumRecords) || maximumRecords < 1) throw new Error("maximumRecords must be a positive integer.");
  const byId = new Map(current.map(record => [record.id, NPCMemoryRecordSchema.parse(record)]));
  byId.set(memory.id, memory);
  return [...byId.values()]
    .filter(record => record.expiresAtTick === undefined || record.expiresAtTick > memory.tick)
    .sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id))
    .slice(-maximumRecords);
}

export function retrieveNpcMemories(
  records: readonly NPCMemoryRecord[],
  query: NPCMemoryQuery,
): RankedNPCMemory[] {
  if (!Number.isInteger(query.tick) || query.tick < 0) throw new Error("query.tick must be a non-negative integer.");
  const limit = Math.max(1, Math.min(query.limit ?? 12, 100));
  const entityIds = new Set(query.entityIds ?? []);
  const tags = new Set((query.tags ?? []).map(normalize));
  const terms = tokenize(query.text ?? "");

  return records
    .map(record => NPCMemoryRecordSchema.parse(record))
    .filter(record => record.tick <= query.tick)
    .filter(record => record.expiresAtTick === undefined || record.expiresAtTick > query.tick)
    .map(memory => rankMemory(memory, query.tick, entityIds, tags, terms))
    .sort((a, b) => b.score - a.score || b.memory.tick - a.memory.tick || a.memory.id.localeCompare(b.memory.id))
    .slice(0, limit);
}

export function selectReflectionCandidates(
  records: readonly NPCMemoryRecord[],
  tick: number,
  minimumImportanceSum = 2.5,
): NPCMemoryRecord[] {
  const candidates = records
    .map(record => NPCMemoryRecordSchema.parse(record))
    .filter(record => record.tick <= tick)
    .filter(record => record.type !== "reflection")
    .filter(record => record.expiresAtTick === undefined || record.expiresAtTick > tick)
    .sort((a, b) => b.importance - a.importance || b.tick - a.tick || a.id.localeCompare(b.id));

  const selected: NPCMemoryRecord[] = [];
  let importance = 0;
  for (const candidate of candidates) {
    selected.push(candidate);
    importance += candidate.importance;
    if (importance >= minimumImportanceSum || selected.length >= 20) break;
  }
  return importance >= minimumImportanceSum ? selected : [];
}

function rankMemory(
  memory: NPCMemoryRecord,
  tick: number,
  entityIds: ReadonlySet<string>,
  tags: ReadonlySet<string>,
  terms: readonly string[],
): RankedNPCMemory {
  const age = Math.max(0, tick - memory.tick);
  const recencyScore = 1 / (1 + age / 200);
  const importanceScore = memory.importance;
  const entityMatches = memory.entityIds.filter(id => entityIds.has(id)).length;
  const normalizedTags = memory.tags.map(normalize);
  const tagMatches = normalizedTags.filter(tag => tags.has(tag)).length;
  const memoryTerms = new Set(tokenize(`${memory.summary} ${memory.tags.join(" ")}`));
  const textMatches = terms.filter(term => memoryTerms.has(term)).length;
  const relevanceScore = Math.min(1, entityMatches * 0.35 + tagMatches * 0.25 + textMatches * 0.1);
  const emotionalWeight = Math.abs(memory.emotionalValence) * 0.05;
  const score = recencyScore * 0.35 + importanceScore * 0.4 + relevanceScore * 0.25 + emotionalWeight;
  return { memory, score, recencyScore, relevanceScore, importanceScore };
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLocaleLowerCase("da-DK").split(/[^\p{L}\p{N}_-]+/u).map(normalize).filter(term => term.length >= 2))];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("da-DK").slice(0, 80);
}
