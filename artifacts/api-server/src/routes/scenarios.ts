import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, scenariosTable } from "@workspace/db";
import {
  CreateScenarioBody,
  UpdateScenarioBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

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
