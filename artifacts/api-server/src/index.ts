import { logger } from "./lib/logger";
import { startHeadsUpScheduler } from "./lib/llm-heads-up";
import { installModelNetworkGuard } from "./lib/model-network-guard";
import { initializeTelemetry, shutdownTelemetry } from "./lib/telemetry";
import { syncRagIntoPersistentMemory } from "./lib/rag-memory";

installModelNetworkGuard();
await initializeTelemetry();
const { default: app } = await import("./app");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

void syncRagIntoPersistentMemory().then(() => {
  startHeadsUpScheduler();
}).catch((error) => {
  logger.error({ error }, "RAG startup sync failed");
  startHeadsUpScheduler();
});

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Server shutdown requested");
  server.close(async error => {
    if (error) logger.error({ error }, "Server shutdown failed");
    try {
      await shutdownTelemetry();
    } finally {
      process.exit(error ? 1 : 0);
    }
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
