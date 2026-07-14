import { Router, type IRouter } from "express";
import {
  listObservabilityEvents,
  recordObservabilityEvent,
  subscribeToObservability,
  type ObservabilityEvent,
} from "../lib/observability";

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
    message: message.slice(0, 4000),
    data: value.data,
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

export default router;
