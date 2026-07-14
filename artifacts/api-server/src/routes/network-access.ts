import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import {
  createNetworkSession,
  decideNetworkApproval,
  getNetworkSession,
  listNetworkApprovals,
  updateNetworkSession,
} from "../lib/network-access";

const router: IRouter = Router();
const ModeSchema = z.enum(["ask_first", "ultra"]);
const UltraApprovalSchema = z.object({
  approvedBy: z.string().trim().min(1).max(240),
  confirmation: z.literal("ENABLE ULTRA"),
});

router.post("/network/sessions", (req, res): void => {
  try {
    const body = z.object({
      mode: ModeSchema.default("ask_first"),
      ttlMinutes: z.coerce.number().int().min(5).max(480).default(120),
      ultraApproval: UltraApprovalSchema.optional(),
    }).parse(req.body ?? {});
    res.status(201).json(createNetworkSession(body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/network/sessions/:id", (req, res): void => {
  try {
    res.json({ session: getNetworkSession(req.params.id, networkToken(req)) });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.patch("/network/sessions/:id", (req, res): void => {
  try {
    const body = z.object({
      mode: ModeSchema,
      ultraApproval: UltraApprovalSchema.optional(),
    }).parse(req.body);
    res.json({
      session: updateNetworkSession({
        sessionId: req.params.id,
        token: networkToken(req),
        mode: body.mode,
        ultraApproval: body.ultraApproval,
      }),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/network/sessions/:id/approvals", (req, res): void => {
  try {
    res.json({ approvals: listNetworkApprovals(req.params.id, networkToken(req)) });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/network/sessions/:id/approvals/:approvalId", (req, res): void => {
  try {
    const body = z.object({ decision: z.enum(["approved", "denied"]) }).parse(req.body);
    res.json({ approval: decideNetworkApproval({
      sessionId: req.params.id,
      token: networkToken(req),
      approvalId: req.params.approvalId,
      decision: body.decision,
    }) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

function networkToken(req: Request): string {
  const header = req.headers["x-network-session-token"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error("X-Network-Session-Token is required.");
  return value;
}

export default router;
