import { Router } from "express";
import { Trade } from "../models/Trade.js";

const router = Router();

/**
 * GET /analytics/price-history?token=0x...&days=30
 * Buckets trades into daily average prices (wei per token).
 */
router.get("/price-history", async (req, res) => {
  const { token, days = 30 } = req.query;
  if (!token) return res.status(400).json({ error: "token required" });

  const since = new Date(Date.now() - Number(days) * 86400_000);
  const rows = await Trade.find({
    tokenContract: String(token).toLowerCase(),
    createdAt: { $gte: since },
  }).sort({ createdAt: 1 });

  const buckets = new Map();
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    const price = Number(BigInt(r.total || "0") * 10n ** 18n / BigInt(r.amount || "1")) / 1e18;
    const b = buckets.get(day) || { sum: 0, n: 0, volume: 0 };
    b.sum += price;
    b.n += 1;
    b.volume += Number(r.amount) / 1e18;
    buckets.set(day, b);
  }

  const series = [...buckets.entries()].map(([date, b]) => ({
    date,
    avgPrice: b.sum / b.n,
    volume: b.volume,
  }));
  res.json({ token, days: Number(days), series });
});

/**
 * GET /analytics/volume/:token — total tokens traded + total MATIC wei.
 */
router.get("/volume/:token", async (req, res) => {
  const token = req.params.token.toLowerCase();
  const rows = await Trade.find({ tokenContract: token });
  const tokens = rows.reduce((s, r) => s + Number(r.amount) / 1e18, 0);
  const wei = rows.reduce((s, r) => s + BigInt(r.total || "0"), 0n);
  res.json({ token, trades: rows.length, tokens, totalWei: wei.toString() });
});

export default router;
