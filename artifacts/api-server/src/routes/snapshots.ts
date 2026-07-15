import { Router, type IRouter } from "express";
import { and, db, eq, scenarioSnapshotsTable, scenariosTable } from "@workspace/db";
import { CreateSnapshotBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/scenarios/:id/snapshots", async (req, res) => {
  const scenarioId = Number(req.params["id"]);
  const rows = await db
    .select({
      id: scenarioSnapshotsTable.id,
      scenarioId: scenarioSnapshotsTable.scenarioId,
      label: scenarioSnapshotsTable.label,
      createdAt: scenarioSnapshotsTable.createdAt,
    })
    .from(scenarioSnapshotsTable)
    .where(eq(scenarioSnapshotsTable.scenarioId, scenarioId))
    .orderBy(scenarioSnapshotsTable.createdAt);
  res.json(rows);
});

router.post("/scenarios/:id/snapshots", async (req, res): Promise<void> => {
  const scenarioId = Number(req.params["id"]);
  const [scenario] = await db
    .select({ id: scenariosTable.id })
    .from(scenariosTable)
    .where(eq(scenariosTable.id, scenarioId));
  if (!scenario) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  const body = CreateSnapshotBody.parse(req.body);
  const [row] = await db
    .insert(scenarioSnapshotsTable)
    .values({ scenarioId, label: body.label, board: body.board })
    .returning();
  res.status(201).json(row);
});

router.get("/scenarios/:id/snapshots/:snapshotId", async (req, res): Promise<void> => {
  const scenarioId = Number(req.params["id"]);
  const snapshotId = Number(req.params["snapshotId"]);
  const [row] = await db
    .select()
    .from(scenarioSnapshotsTable)
    .where(
      and(
        eq(scenarioSnapshotsTable.id, snapshotId),
        eq(scenarioSnapshotsTable.scenarioId, scenarioId),
      ),
    );
  if (!row) {
    res.status(404).json({ message: "Snapshot not found" });
    return;
  }
  res.json(row);
});

router.delete("/scenarios/:id/snapshots/:snapshotId", async (req, res): Promise<void> => {
  const scenarioId = Number(req.params["id"]);
  const snapshotId = Number(req.params["snapshotId"]);
  const [row] = await db
    .delete(scenarioSnapshotsTable)
    .where(
      and(
        eq(scenarioSnapshotsTable.id, snapshotId),
        eq(scenarioSnapshotsTable.scenarioId, scenarioId),
      ),
    )
    .returning({ id: scenarioSnapshotsTable.id });
  if (!row) {
    res.status(404).json({ message: "Snapshot not found" });
    return;
  }
  res.status(204).send();
});

export default router;
