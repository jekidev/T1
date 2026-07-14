import { Router, type IRouter, type Request, type Response } from "express";
import {
  listObservabilityEvents,
  recordObservabilityEvent,
  subscribeToObservability,
  type ObservabilityEvent,
} from "../lib/observability";
import { sessionReplayStorage } from "../lib/session-replay-storage";
import { withSpan } from "../lib/telemetry";

const router: IRouter = Router();

function normalizeEvent(input: unknown): Omit<ObservabilityEvent, "id" | "timestamp"> | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const source = value.source;
  const level = value.level;
  const type = value.type;
  const message = value.message;

  if (!["browser", "server", "game", "system"].includes(String(source))) return null;
  if (!["debug", "info", "warn", "error"].includes(String(level))) return null;
  if (typeof type !== "string" || typeof message !== "string") return null;

  return {
    source: source as ObservabilityEvent["source"],
    level: level as ObservabilityEvent["level"],
    type: type.slice(0, 120),
    message: redactText(message).slice(0, 4000),
    data: redactTelemetryValue(value.data),
  };
}

router.post("/observability/events", (req, res): void => {
  const incoming = Array.isArray(req.body) ? req.body : [req.body];
  const accepted = incoming
    .map(normalizeEvent)
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .slice(0, 100)
    .map(recordObservabilityEvent);

  res.status(202).json({ accepted: accepted.length });
});

router.get("/observability/events", (req, res): void => {
  const requestedLimit = Number(req.query.limit ?? 100);
  res.json({ events: listObservabilityEvents(requestedLimit) });
});

router.get("/observability/stream", (req, res): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`event: snapshot\ndata: ${JSON.stringify(listObservabilityEvents(50))}\n\n`);
  const unsubscribe = subscribeToObservability((event) => {
    res.write(`event: telemetry\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

router.post("/observability/replay/:sessionId", async (req, res): Promise<void> => {
  try {
    const body = req.body as { provider?: unknown; path?: unknown; events?: unknown };
    if (body.provider !== "rrweb" || typeof body.path !== "string" || !Array.isArray(body.events)) {
      res.status(400).json({ error: "Invalid rrweb replay batch." });
      return;
    }
    await withSpan("observability.replay.ingest", {
      "replay.provider": "rrweb",
      "replay.session.id": req.params.sessionId,
      "replay.event.count": body.events.length,
    }, () => sessionReplayStorage.append(req.params.sessionId, {
      provider: "rrweb",
      path: body.path,
      events: body.events,
    }));
    res.status(202).json({ accepted: body.events.length });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/observability/replay", requireReplayAdmin, async (_req, res): Promise<void> => {
  try {
    res.json({ sessions: await sessionReplayStorage.list() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/observability/replay/:sessionId", requireReplayAdmin, async (req, res): Promise<void> => {
  try {
    res.json({
      sessionId: req.params.sessionId,
      batches: await sessionReplayStorage.read(req.params.sessionId),
    });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

function requireReplayAdmin(req: Request, res: Response, next: () => void): void {
  const expected = process.env.OBSERVABILITY_REPLAY_ADMIN_TOKEN;
  if (!expected || expected.length < 24) {
    res.status(503).json({ error: "Replay administration is disabled until OBSERVABILITY_REPLAY_ADMIN_TOKEN is configured." });
    return;
  }
  const header = req.headers["x-observability-admin-token"];
  const headerToken = Array.isArray(header) ? header[0] : header;
  const authorization = req.headers.authorization;
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!constantTimeEqual(expected, headerToken ?? bearer ?? "")) {
    res.status(401).json({ error: "Invalid replay administrator credential." });
    return;
  }
  next();
}

function constantTimeEqual(expected: string, supplied: string): boolean {
  if (expected.length !== supplied.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return mismatch === 0;
}

function redactTelemetryValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (value === undefined || value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactText(value).slice(0, 10_000);
  if (Array.isArray(value)) return value.slice(0, 1_000).map(item => redactTelemetryValue(item, depth + 1));
  if (typeof value !== "object") return String(value);
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = /(password|secret|token|authorization|cookie|api[-_.]?key|\.env|private[-_.]?key)/i.test(key)
      ? "[REDACTED]"
      : redactTelemetryValue(entry, depth + 1);
  }
  return output;
}

function redactText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|pk)[-_][A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]");
}

export default router;
