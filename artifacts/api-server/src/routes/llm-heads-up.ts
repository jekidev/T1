import { Router, type IRouter } from "express";
import {
  generateBehaviorCommentary,
  generateWisdomHeadsUp,
  getLatestHeadsUp,
  LLM_MODE_DEFINITIONS,
  subscribeHeadsUp,
} from "../lib/llm-heads-up";

const router: IRouter = Router();

router.get("/llm/modes", (_req, res): void => {
  res.json({ modes: LLM_MODE_DEFINITIONS });
});

router.get("/llm/headsup/current", async (_req, res): Promise<void> => {
  res.json({ notification: await getLatestHeadsUp() });
});

router.post("/llm/headsup/refresh", async (req, res): Promise<void> => {
  const notification = await generateWisdomHeadsUp(req.body?.mode);
  res.status(201).json({ notification });
});

router.post("/llm/copilot/commentary", async (req, res): Promise<void> => {
  const notification = await generateBehaviorCommentary({
    mode: req.body?.mode,
    board: req.body?.board,
    behavior: req.body?.behavior,
  });
  res.status(notification ? 201 : 204);
  if (notification) res.json({ notification });
  else res.end();
});

router.get("/llm/headsup/stream", async (req, res): Promise<void> => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const current = await getLatestHeadsUp();
  if (current) res.write(`event: heads-up\ndata: ${JSON.stringify(current)}\n\n`);

  const unsubscribe = subscribeHeadsUp((notification) => {
    res.write(`event: heads-up\ndata: ${JSON.stringify(notification)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

export default router;
