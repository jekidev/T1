import { Router, type IRouter } from "express";
import { CreateScenarioBody, UpdateScenarioBody } from "@workspace/api-zod";
import {
  createScenario,
  deleteScenario,
  getScenario,
  listScenarios,
  updateScenario,
} from "../lib/scenario-store";

const router: IRouter = Router();

router.get("/scenarios", async (req, res) => {
  const rows = listScenarios();
  req.log.info({ count: rows.length }, "Listed scenarios");
  res.json(rows);
});

router.post("/scenarios", async (req, res) => {
  const body = CreateScenarioBody.parse(req.body);
  const row = createScenario(body);
  res.status(201).json(row);
});

router.get("/scenarios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const row = getScenario(id);
  if (!row) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  res.json(row);
});

router.patch("/scenarios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const body = UpdateScenarioBody.parse(req.body);
  const row = updateScenario(id, body);
  if (!row) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  res.json(row);
});

router.delete("/scenarios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!deleteScenario(id)) {
    res.status(404).json({ message: "Scenario not found" });
    return;
  }
  res.status(204).send();
});

export default router;
