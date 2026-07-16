import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";
import * as schema from "./schema";
import type { PgDatabase } from "drizzle-orm/pg-core/db";

const { Pool } = pg;

const DEFAULT_PGLITE_PATH = "./data/t1-pglite";

function isPgliteUrl(url: string | undefined): boolean {
  if (!url) return true; // dev fallback
  return url.startsWith("pglite:") || url === ":memory:";
}

function normalizePgliteUrl(url: string): string | undefined {
  if (url.startsWith("pglite:")) {
    const path = url.slice(7);
    return path || undefined;
  }
  if (url === ":memory:") return undefined;
  return url;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  console.warn(
    `[db] DATABASE_URL not set; falling back to pglite file database at ${DEFAULT_PGLITE_PATH}`,
  );
  return `pglite:${DEFAULT_PGLITE_PATH}`;
}

async function ensureTables(db: PgDatabase<any, typeof schema>) {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      map_template_id TEXT NOT NULL,
      board JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS scenario_snapshots (
      id SERIAL PRIMARY KEY,
      scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      board JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `));
}

async function initDatabase(): Promise<PgDatabase<any, typeof schema>> {
  const url = getDatabaseUrl();

  if (isPgliteUrl(url)) {
    const pgliteUrl = normalizePgliteUrl(url);
    if (pgliteUrl) {
      await mkdir(dirname(pgliteUrl), { recursive: true });
    }
    const pgliteDb = (
      pgliteUrl
        ? drizzlePglite(pgliteUrl, { schema })
        : drizzlePglite({ schema })
    ) as PgDatabase<any, typeof schema>;
    await ensureTables(pgliteDb);
    return pgliteDb;
  }

  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema }) as PgDatabase<any, typeof schema>;
}

export const db = await initDatabase();
export const pool = undefined;
export * from "./schema";
export { eq, and } from "drizzle-orm";
