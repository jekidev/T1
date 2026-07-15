import { timingSafeEqual } from "node:crypto";
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
  confirmation: z.literal("ENABLE ULTRA"),
});

router.post("/network/sessions", (req, res): void => {
  try {
    const body = z.object({
      mode: ModeSchema.default("ask_first"),
      ttlMinutes: z.coerce.number().int().min(5).max(480).default(120),
      ultraApproval: UltraApprovalSchema.optional(),
    }).parse(req.body ?? {});
    const ultraApproval = body.mode === "ultra"
      ? authorizedUltraApproval(req, body.ultraApproval)
      : undefined;
    res.status(201).json(createNetworkSession({
      mode: body.mode,
      ttlMinutes: body.ttlMinutes,
      ultraApproval,
    }));
  } catch (error) {
    respondError(res, error);
  }
});

router.get("/network/sessions/:id", (req, res): void => {
  try {
    res.json({ session: getNetworkSession(req.params.id, networkToken(req)) });
  } catch (error) {
    respondError(res, error, 401);
  }
});

router.patch("/network/sessions/:id", (req, res): void => {
  try {
    const body = z.object({
      mode: ModeSchema,
      ultraApproval: UltraApprovalSchema.optional(),
    }).parse(req.body);
    const ultraApproval = body.mode === "ultra"
      ? authorizedUltraApproval(req, body.ultraApproval)
      : undefined;
    res.json({
      session: updateNetworkSession({
        sessionId: req.params.id,
        token: networkToken(req),
        mode: body.mode,
        ultraApproval,
      }),
    });
  } catch (error) {
    respondError(res, error);
  }
});

router.get("/network/sessions/:id/approvals", (req, res): void => {
  try {
    res.json({ approvals: listNetworkApprovals(req.params.id, networkToken(req)) });
  } catch (error) {
    respondError(res, error, 401);
  }
});

router.post("/network/sessions/:id/approvals/:approvalId", (req, res): void => {
  try {
    const body = z.object({ decision: z.enum(["approved", "denied"]) }).parse(req.body);
    if (body.decision === "approved") requirePermissionAdmin(req);
    res.json({ approval: decideNetworkApproval({
      sessionId: req.params.id,
      token: networkToken(req),
      approvalId: req.params.approvalId,
      decision: body.decision,
    }) });
  } catch (error) {
    respondError(res, error);
  }
});

function authorizedUltraApproval(
  req: Request,
  approval: z.infer<typeof UltraApprovalSchema> | undefined,
): { approvedBy: string; confirmation: "ENABLE ULTRA" } {
  requirePermissionAdmin(req);
  if (!approval || approval.confirmation !== "ENABLE ULTRA") {
    throw new HttpRouteError(400, "Ultra requires the exact confirmation phrase ENABLE ULTRA.");
  }
  return {
    approvedBy: permissionActor(req),
    confirmation: "ENABLE ULTRA",
  };
}

function requirePermissionAdmin(req: Request): void {
  const expected = process.env.NETWORK_PERMISSION_ADMIN_TOKEN?.trim() ?? "";
  if (expected.length < 24) {
    throw new HttpRouteError(503, "Network approval is disabled until NETWORK_PERMISSION_ADMIN_TOKEN contains at least 24 characters.");
  }
  const supplied = headerValue(req, "x-network-permission-token");
  if (!supplied) throw new HttpRouteError(401, "X-Network-Permission-Token is required for approval or Ultra.");
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw new HttpRouteError(403, "Invalid network permission administrator token.");
  }
}

function permissionActor(req: Request): string {
  const actor = headerValue(req, "x-network-permission-actor")?.trim().slice(0, 240);
  return actor || "authenticated-network-admin";
}

function networkToken(req: Request): string {
  const value = headerValue(req, "x-network-session-token");
  if (!value) throw new HttpRouteError(401, "X-Network-Session-Token is required.");
  return value;
}

function headerValue(req: Request, name: string): string | undefined {
  const header = req.headers[name];
  return Array.isArray(header) ? header[0] : header;
}

function respondError(res: Parameters<IRouter["use"]>[0] extends never ? never : any, error: unknown, fallbackStatus = 400): void {
  const status = error instanceof HttpRouteError ? error.status : fallbackStatus;
  res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
}

class HttpRouteError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpRouteError";
  }
}

export default router;
