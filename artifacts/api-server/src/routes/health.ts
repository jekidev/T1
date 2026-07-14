import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getLlmRouterStatus } from "../lib/openrouter";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/llm", (_req, res) => {
  const status = getLlmRouterStatus();
  res.status(status.configured ? 200 : 503).json({
    status: status.configured ? "configured" : "not_configured",
    ...status,
  });
});

export default router;
