import { Router } from "express";
import { isAddress } from "ethers";
import { Trade } from "../models/Trade.js";

const router = Router();

/** Record a trade after the frontend confirms the on-chain tx. */
router.post("/", async (req, res) => {
  try {
    const {
      listingId,
      tokenContract,
      buyer,
      seller,
      creator,
      amount,
      pricePerToken,
      total,
      royalty,
      platformFee,
      txHash,
      blockNumber,
    } = req.body;

    for (const value of [tokenContract, buyer, seller, creator]) {
      if (!isAddress(value)) {
        return res.status(400).json({ error: "invalid trade address" });
      }
    }

    const t = await Trade.create({
      listingId,
      tokenContract: tokenContract.toLowerCase(),
      buyer: buyer.toLowerCase(),
      seller: seller.toLowerCase(),
      creator: creator.toLowerCase(),
      amount: String(amount),
      pricePerToken: String(pricePerToken),
      total: String(total),
      royalty: String(royalty || "0"),
      platformFee: String(platformFee || "0"),
      txHash,
      blockNumber,
    });
    res.json(t);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

/** List recent trades, optionally filtered by token contract. */
router.get("/", async (req, res) => {
  const q = {};
  if (req.query.token) q.tokenContract = String(req.query.token).toLowerCase();
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
