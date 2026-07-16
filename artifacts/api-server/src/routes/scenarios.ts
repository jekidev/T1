import { Router, type IRouter } from "express";
import { db, eq, scenariosTable } from "@workspace/db";
import {
  CreateScenarioBody,
  UpdateScenarioBody,
} from "@workspace/api-zod";
import type { BoardState } from "@workspace/command-sim/lib/game/types";
import {
  simulateTurn,
  type PlayerTurnAction,
} from "@workspace/command-sim/lib/game/simulationEngine";

const router: IRouter = Router();
const ALLOWED_ACTIONS = [
  "invest",
  "gather_intelligence",
  "reduce_pressure",
  "expand_influence",
  "train",
  "wait",
];

function isValidAction(body: unknown): body is PlayerTurnAction {
  if (!body || typeof body !== "object") return false;
  const action = body as Record<string, unknown>;
  if (typeof action.type !== "string" || !ALLOWED_ACTIONS.includes(action.type)) return false;
  if (action.factionId !== undefined && typeof action.factionId !== "string") return false;
  if (action.skillId !== undefined && typeof action.skillId !== "string") return false;
  if (action.amount !== undefined && typeof action.amount !== "number") return false;
  return true;
}

// Simple in-memory rate limiter for turn resolution per scenario.
// Production deployments should use Redis or another shared store.
const RESOLVE_COOLDOWN_MS = 5000;
const resolveLastUsed = new Map<number, number>();

function canResolveTurn(scenarioId: number): boolean {
  const now = Date.now();
  const last = resolveLastUsed.get(scenarioId) ?? 0;
  if (now - last < RESOLVE_COOLDOWN_MS) return false;
  resolveLastUsed.set(scenarioId, now);
  return true;
}

router.get("/scenarios", async (req, res) => {
  const rows = await db
    .select({
      id: scenariosTable.id,
      name: scenariosTable.name,
      description: scenariosTable.description,
      mapTemplateId: scenariosTable.mapTemplateId,
      updatedAt: scenariosTable.updatedAt,
      createdAt: scenariosTable.createdAt,
    })
    .from(scenariosTable)
    .orderBy(scenariosTable.updatedAt);
  req.log.info({ count: rows.length }, "Listed scenarios");
  res.json(rows);
});

router.post("/scenarios", async (req, res) => {
  const body = CreateScenarioBody.parse(req.body);
  const [row] = await db
    .insert(scenariosTable)
    .values({
      name: body.name,
      description: body.description ?? null,
      mapTemplateId: body.mapTemplateId,
      board: body.board,
    })
    .returning();
  res.status(201).json(row);
});

router.get("/scenarios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const [row] = await db
    .select()
    .from(scenariosTable)
    .where(eq(scenariosTable.id, id));
  if (!row) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  res.json(row);
});

router.patch("/scenarios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const body = UpdateScenarioBody.parse(req.body);
  const [row] = await db
    .update(scenariosTable)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.mapTemplateId !== undefined ? { mapTemplateId: body.mapTemplateId } : {}),
      ...(body.board !== undefined ? { board: body.board } : {}),
    })
    .where(eq(scenariosTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  res.json(row);
});

router.post("/scenarios/:id/resolve", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!canResolveTurn(id)) {
    res.status(429).json({ message: "Turn resolution rate limit exceeded; please wait before resolving again" });
    return;
  }
  const [row] = await db
    .select()
    .from(scenariosTable)
    .where(eq(scenariosTable.id, id));
  if (!row) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  const action = isValidAction(req.body) ? req.body : undefined;
  const board = row.board as BoardState;
  const resolution = simulateTurn(board, action);
  const [updated] = await db
    .update(scenariosTable)
    .set({
      board: resolution.board,
      updatedAt: new Date(),
    })
    .where(eq(scenariosTable.id, id))
    .returning();
  res.json({ ...resolution, scenario: updated });
});

router.delete("/scenarios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const [row] = await db
    .delete(scenariosTable)
    .where(eq(scenariosTable.id, id))
    .returning({ id: scenariosTable.id });
  if (!row) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  res.status(204).send();
});

export default router;
