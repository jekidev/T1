import { Router, type IRouter } from "express";
import { z } from "zod";
import { findWorkspaceSession } from "../lib/workspace-session";

const router: IRouter = Router();

router.get("/workspace/maps/embed", (req, res): void => {
  try {
    const session = findWorkspaceSession(req);
    if (!session?.tests.googleMaps || !session.googleMapsApiKey) {
      res.status(401).type("text/html").send(errorPage("Google Maps preflight is not complete."));
      return;
    }
    const query = z.object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      zoom: z.coerce.number().int().min(1).max(20).default(11),
    }).parse(req.query);
    const source = new URL("https://www.google.com/maps/embed/v1/view");
    source.searchParams.set("key", session.googleMapsApiKey);
    source.searchParams.set("center", `${query.lat},${query.lng}`);
    source.searchParams.set("zoom", String(query.zoom));
    source.searchParams.set("maptype", "roadmap");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-src https://www.google.com https://maps.google.com; style-src 'unsafe-inline'; img-src data:");
    res.type("text/html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:#111}</style></head><body><iframe title="Google Maps board" src="${escapeHtml(source.toString())}" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></body></html>`);
  } catch (error) {
    res.status(400).type("text/html").send(errorPage(error instanceof Error ? error.message : String(error)));
  }
});

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function errorPage(message: string): string {
  return `<!doctype html><html><body style="margin:0;background:#111;color:#ddd;font:14px system-ui;display:grid;place-items:center"><div>${escapeHtml(message)}</div></body></html>`;
}

export default router;
