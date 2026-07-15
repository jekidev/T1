import { createReadStream } from "node:fs";
import { Router, type IRouter } from "express";
import { assetGenerationManager } from "../lib/asset-generation";

const router: IRouter = Router();

router.get("/asset-generation/sources/:id", async (req, res): Promise<void> => {
  try {
    const source = await assetGenerationManager.storage.getSource(req.params.id);
    res.setHeader("Content-Type", source.mimeType);
    res.setHeader("Content-Length", String(source.byteLength));
    res.setHeader("X-Content-SHA256", source.sha256);
    res.setHeader("Cache-Control", "private, max-age=300");
    const stream = createReadStream(source.path);
    stream.on("error", error => {
      if (!res.headersSent) res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
