import { Router, type IRouter } from "express";
import { MAP_TEMPLATES } from "../data/mapTemplates";
import { buildTutorialScenarioBoard } from "../data/tutorialScenario";

const router: IRouter = Router();

router.get("/map-templates", (_req, res) => {
  res.json(MAP_TEMPLATES);
});

router.get("/tutorial-scenario", (_req, res) => {
  res.json({
    id: 0,
    name: "Nørrebro Tutorial Investigation",
    description:
      "A guided fictional scenario showing zones, phases, evidence, and units already in place.",
    mapTemplateId: "norrebro",
    board: buildTutorialScenarioBoard(),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
});

export default router;
