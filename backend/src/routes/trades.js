import { Router } from "express";
import { Trade } from "../models/Trade.js";

const router = Router();

/** Record a trade after the frontend confirms the on-chain tx. */
router.post("/", async (req, res) => {
  try {
    const t = await Trade.create(req.body);
    res.json(t);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

/** List recent trades, optionally filtered by token contract. */
router.get("/", async (req, res) => {
  const q = {};
  if (req.query.token) q.tokenContract = req.query.token;
  const rows = await Trade.find(q).sort({ createdAt: -1 }).limit(200);
  res.json(rows);
});

/** Per-creator royalty earnings summary (wei). */
router.get("/royalties/:creator", async (req, res) => {
  const rows = await Trade.find({ creator: req.params.creator.toLowerCase() });
  const total = rows.reduce((s, r) => s + BigInt(r.royalty || "0"), 0n);
  res.json({ creator: req.params.creator, totalRoyaltyWei: total.toString() });
});

export default router;
