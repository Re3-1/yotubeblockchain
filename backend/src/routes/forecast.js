import { Router } from "express";
import axios from "axios";
import { Trade } from "../models/Trade.js";
import { getPublicMetrics } from "../services/youtube.js";

const router = Router();

/**
 * GET /forecast/:token?channelId=UC...&horizon=7
 * Fetches recent trade prices, pulls current YT metrics, and calls the
 * Python forecast service. Returns the forecast as-is.
 */
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { channelId, horizon = 7 } = req.query;

    const rows = await Trade.find({ tokenContract: token })
      .sort({ createdAt: 1 })
      .limit(200);

    const metrics = channelId ? await getPublicMetrics(channelId) : null;

    const buckets = new Map();
    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const price = Number(BigInt(r.total || "0") * 10n ** 18n / BigInt(r.amount || "1")) / 1e18;
      const b = buckets.get(day) || { sum: 0, n: 0 };
      b.sum += price; b.n += 1;
      buckets.set(day, b);
    }
    const series = [...buckets.entries()].map(([date, b]) => ({
      date,
      avgPrice: b.sum / b.n,
      subscribers: metrics?.subscribers || 0,
      views: metrics?.views || 0,
    }));

    const url = (process.env.FORECAST_URL || "http://localhost:8000") + "/predict";
    const { data } = await axios.post(url, { series, horizon: Number(horizon) });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
