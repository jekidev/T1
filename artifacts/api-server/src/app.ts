import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { recordObservabilityEvent } from "./lib/observability";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  const startedAt = performance.now();
  res.on("finish", () => {
    if (req.path === "/api/observability/events" || req.path === "/api/observability/stream") return;

    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
    recordObservabilityEvent({
      source: "server",
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      type: "http.request.completed",
      message: `${req.method} ${req.path} -> ${res.statusCode}`,
      data: {
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      },
    });
  });
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendDir = path.resolve(currentDir, "../../command-sim/dist/public");

  app.use(express.static(frontendDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

export default app;
