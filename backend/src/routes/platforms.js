import { Router } from "express";
import { getAdapter, listPlatforms } from "../services/platforms/index.js";

const router = Router();

router.get("/", (_req, res) => res.json({ platforms: listPlatforms() }));

router.get("/:platform/:channelId/metrics", async (req, res) => {
  try {
    const a = getAdapter(req.params.platform);
    const m = await a.getPublicMetrics(req.params.channelId);
    if (!m) return res.status(404).json({ error: "not found" });
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
