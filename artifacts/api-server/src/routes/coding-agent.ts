import { randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { AgentTaskSchema } from "@workspace/coding-agent";
import { z } from "zod";
import { codingAgentService } from "../lib/coding-agent-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

void codingAgentService.initialize().catch(error => {
  logger.error({ error }, "Coding-agent service initialization failed");
});

router.get("/coding-agent/capabilities", requireCodingAgentAdmin, (_req, res): void => {
  res.json(codingAgentService.capabilities());
});

router.post("/coding-agent/repository-map", requireCodingAgentAdmin, async (req, res): Promise<void> => {
  try {
    const force = z.boolean().default(false).parse(req.body?.force);
    res.json({ repositoryMap: await codingAgentService.repositoryMap(force) });
  } catch (error) {
    sendError(res, error, 503);
  }
});

router.post("/coding-agent/runs", requireCodingAgentAdmin, async (req, res): Promise<void> => {
  try {
    const source = req.body?.task && typeof req.body.task === "object" ? req.body.task : req.body;
    const task = AgentTaskSchema.parse({
      ...source,
      id: typeof source?.id === "string" && source.id.trim()
        ? source.id
        : `task-${randomUUID()}`,
      requestedBy: typeof source?.requestedBy === "string" && source.requestedBy.trim()
        ? source.requestedBy
        : "coding-agent-admin",
    });
    const run = await codingAgentService.createRun(task);
    res.status(201).json({ run });
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.get("/coding-agent/runs", requireCodingAgentAdmin, async (req, res): Promise<void> => {
  try {
    const limit = z.coerce.number().int().min(1).max(500).default(100).parse(req.query.limit);
    res.json({ runs: await codingAgentService.listRuns(limit) });
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.get("/coding-agent/runs/:id", requireCodingAgentAdmin, async (req, res): Promise<void> => {
  try {
    res.json({ run: await codingAgentService.getRun(req.params.id) });
  } catch (error) {
    sendError(res, error, 404);
  }
});

router.post("/coding-agent/runs/:id/execute", requireCodingAgentAdmin, async (req, res): Promise<void> => {
  try {
    const run = await codingAgentService.startRun(req.params.id);
    res.status(202).json({
      run,
      message: "Run accepted. Execution occurs in the configured external sandbox worker and remains subject to deterministic policy validation and human PR review.",
    });
  } catch (error) {
    sendError(res, error, 409);
  }
});

router.post("/coding-agent/runs/:id/stop", requireCodingAgentAdmin, async (req, res): Promise<void> => {
  try {
    res.json({ run: await codingAgentService.stopRun(req.params.id) });
  } catch (error) {
    sendError(res, error, 409);
  }
});

function requireCodingAgentAdmin(req: Request, res: Response, next: () => void): void {
  const expected = process.env.CODING_AGENT_ADMIN_TOKEN?.trim() ?? "";
  if (expected.length < 24) {
    res.status(503).json({ error: "Coding-agent administration is disabled until CODING_AGENT_ADMIN_TOKEN contains at least 24 characters." });
    return;
  }
  const authorization = firstHeader(req, "authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = firstHeader(req, "x-coding-agent-admin-token") ?? bearer ?? "";
  if (!constantTimeEqual(expected, supplied)) {
    res.status(401).json({ error: "Invalid coding-agent administrator credential." });
    return;
  }
  next();
}

function constantTimeEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function firstHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function sendError(res: Response, error: unknown, status: number): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation failed.",
      issues: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  logger.warn({ status, message }, "Coding-agent request failed");
  res.status(status).json({ error: message });
}

export default router;
