import { Router, type IRouter } from "express";
import { CreateSnapshotBody } from "@workspace/api-zod";
import {
  createSnapshot,
  deleteSnapshot,
  getScenario,
  getSnapshot,
  listSnapshots,
} from "../lib/scenario-store";

const router: IRouter = Router();

router.get("/scenarios/:id/snapshots", async (req, res) => {
  const scenarioId = Number(req.params["id"]);
  res.json(listSnapshots(scenarioId));
});

router.post("/scenarios/:id/snapshots", async (req, res): Promise<void> => {
  const scenarioId = Number(req.params["id"]);
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  const body = CreateSnapshotBody.parse(req.body);
  const row = createSnapshot({ scenarioId, ...body });
  res.status(201).json(row);
});

router.get(
  "/scenarios/:id/snapshots/:snapshotId",
  async (req, res): Promise<void> => {
    const scenarioId = Number(req.params["id"]);
    const snapshotId = Number(req.params["snapshotId"]);
    const row = getSnapshot(scenarioId, snapshotId);
    if (!row) {
      res.status(404).json({ message: "Snapshot not found" });
      return;
    }
    res.json(row);
  },
);

router.delete(
  "/scenarios/:id/snapshots/:snapshotId",
  async (req, res): Promise<void> => {
    const scenarioId = Number(req.params["id"]);
    const snapshotId = Number(req.params["snapshotId"]);
    if (!deleteSnapshot(scenarioId, snapshotId)) {
      res.status(404).json({ message: "Snapshot not found" });
      return;
    }
    res.status(204).send();
  },
);

export default router;
