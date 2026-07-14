import { Router, type IRouter } from "express";
import { planGridPath, type PathPlanningRequest } from "../lib/path-planning";
import { recordObservabilityEvent } from "../lib/observability";

const router: IRouter = Router();

router.post("/path-planning/plan", (req, res): void => {
  try {
    const request = req.body as PathPlanningRequest;
    if (!request || !request.start || !request.goal || !Number.isFinite(request.width) || !Number.isFinite(request.height)) {
      res.status(422).json({ message: "width, height, start and goal are required" });
      return;
    }
    const result = planGridPath(request);
    recordObservabilityEvent({
      source: "game",
      level: result.found ? "info" : "warn",
      type: "path-planning.completed",
      message: result.found ? `Path found using ${result.algorithm}` : `No path found using ${result.algorithm}`,
      data: { algorithm: result.algorithm, cost: result.cost, visited: result.visited.length, pathLength: result.path.length },
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
