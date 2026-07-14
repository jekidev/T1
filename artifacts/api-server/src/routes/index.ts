import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scenariosRouter from "./scenarios";
import snapshotsRouter from "./snapshots";
import referenceRouter from "./reference";
import advisorRouter from "./advisor";
import observabilityRouter from "./observability";
import mcpRouter from "./mcp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scenariosRouter);
router.use(snapshotsRouter);
router.use(referenceRouter);
router.use(observabilityRouter);
router.use(mcpRouter);
router.use(advisorRouter);

export default router;
