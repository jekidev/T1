import { Router, type IRouter } from "express";

const router: IRouter = Router();

function authBaseUrl(): string {
  const value = process.env.TELEGRAM_AUTH_API_URL?.trim();
  if (!value) throw new Error("TELEGRAM_AUTH_API_URL is not configured");
  return value.replace(/\/$/, "");
}

async function proxyAuth(path: string, init: RequestInit = {}) {
  const response = await fetch(`${authBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(process.env.TELEGRAM_AUTH_API_TOKEN ? { Authorization: `Bearer ${process.env.TELEGRAM_AUTH_API_TOKEN}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : {}; } catch { /* keep text */ }
  return { status: response.status, body };
}

router.get("/telegram/auth/status", async (_req, res): Promise<void> => {
  try {
    const result = await proxyAuth("/status");
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(503).json({ configured: Boolean(process.env.TELEGRAM_AUTH_API_URL), authenticated: false, message: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/telegram/auth/start", async (req, res): Promise<void> => {
  try {
    const result = await proxyAuth("/start", { method: "POST", body: JSON.stringify({ method: req.body?.method ?? "qr", phone: req.body?.phone }) });
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(503).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/telegram/auth/verify", async (req, res): Promise<void> => {
  try {
    const result = await proxyAuth("/verify", { method: "POST", body: JSON.stringify({ code: req.body?.code, password: req.body?.password, requestId: req.body?.requestId }) });
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(503).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/telegram/auth/logout", async (_req, res): Promise<void> => {
  try {
    const result = await proxyAuth("/logout", { method: "POST", body: "{}" });
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(503).json({ message: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
