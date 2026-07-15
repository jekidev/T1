import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scenariosRouter from "./scenarios";
import snapshotsRouter from "./snapshots";
import referenceRouter from "./reference";
import advisorRouter from "./advisor";
import observabilityRouter from "./observability";
import mcpRouter from "./mcp";
import telegramAuthRouter from "./telegram-auth";
import pathPlanningRouter from "./path-planning";
import evolveRouter from "./evolve";
import ragRouter from "./rag";
import sourceDebugRouter from "./source-debug";
import llmHeadsUpRouter from "./llm-heads-up";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scenariosRouter);
router.use(snapshotsRouter);
router.use(referenceRouter);
router.use(observabilityRouter);
router.use(mcpRouter);
router.use(telegramAuthRouter);
router.use(pathPlanningRouter);
router.use(evolveRouter);
router.use(ragRouter);
router.use(sourceDebugRouter);
router.use(llmHeadsUpRouter);
router.use(advisorRouter);

export default router;
