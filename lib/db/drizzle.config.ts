import { defineConfig } from "drizzle-kit";
import path from "path";

const DEFAULT_PGLITE_PATH = "./data/t1-pglite";

function resolveDatabaseConfig() {
  let url = process.env.DATABASE_URL;
  if (!url) {
    url = `pglite:${DEFAULT_PGLITE_PATH}`;
  }

  if (url.startsWith("pglite:")) {
    return {
      driver: "pglite" as const,
      dbCredentials: { url: url.slice(7) || DEFAULT_PGLITE_PATH },
    };
  }

  if (url === ":memory:") {
    return {
      driver: "pglite" as const,
      dbCredentials: { url: ":memory:" },
    };
  }

  return {
    dbCredentials: { url },
  };
}

const dbConfig = resolveDatabaseConfig();

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  ...dbConfig,
});
