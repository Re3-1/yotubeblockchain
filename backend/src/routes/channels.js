import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listMyChannels, getPublicMetrics } from "../services/youtube.js";
import { computePrice } from "../services/pricing.js";

const router = Router();

/**
 * Called from the creator dashboard AFTER Google OAuth login.
 * Returns the YouTube channels the logged-in Google account owns.
 */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    if (!req.user.ytAccessToken) {
      return res.status(400).json({ error: "re-auth with YouTube scope" });
    }
    const channels = await listMyChannels(req.user.ytAccessToken);
    res.json({ channels });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "youtube api failed" });
  }
});

/**
 * User claims a channel that their Google account owns, then binds it to
 * their wallet address.  Returns a short-lived "mint-permit" JWT-style
 * claim the frontend can show when calling ChannelToken.mint on-chain.
 */
router.post("/verify", requireAuth, async (req, res) => {
  const { channelId, wallet } = req.body;
  if (!channelId || !wallet) return res.status(400).json({ error: "missing" });

  const mine = await listMyChannels(req.user.ytAccessToken);
  const match = mine.find((c) => c.channelId === channelId);
  if (!match) return res.status(403).json({ error: "not your channel" });

  // bind wallet + save channel
  req.user.wallet = wallet.toLowerCase();
  const already = req.user.verifiedChannels.find((c) => c.channelId === channelId);
  if (!already) {
    req.user.verifiedChannels.push({
      channelId,
      title: match.title,
      thumbnail: match.thumbnail,
    });
  }
  await req.user.save();

  res.json({ ok: true, channel: match });
});

/**
 * Store the deployed ChannelToken address after the creator mints.
 */
router.post("/:channelId/token-contract", requireAuth, async (req, res) => {
  const { channelId } = req.params;
  const { address } = req.body;
  const ch = req.user.verifiedChannels.find((c) => c.channelId === channelId);
  if (!ch) return res.status(404).json({ error: "no such channel" });
  ch.tokenContract = address;
  await req.user.save();
  res.json({ ok: true });
});

/**
 * Public — anyone can look up live metrics for any channel. Used by
 * marketplace UI and pricing engine.
 */
router.get("/:channelId/metrics", async (req, res) => {
  try {
    const m = await getPublicMetrics(req.params.channelId);
    if (!m) return res.status(404).json({ error: "not found" });
    res.json(m);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "youtube api failed" });
  }
});

/**
 * Public — current dynamic price (in MATIC) for the channel.
 */
router.get("/:channelId/price", async (req, res) => {
  try {
    const m = await getPublicMetrics(req.params.channelId);
    if (!m) return res.status(404).json({ error: "not found" });
    // lightweight estimate for likes/video
    const likesPerVideo = m.videos > 0 ? m.views / m.videos / 50 : 0;
    const price = computePrice({
      subscribers: m.subscribers,
      views: m.views,
      likesPerVideo,
      buys24h: 0,
      sells24h: 0,
      totalSupply: 1,
    });
    res.json({ channelId: m.channelId, priceMatic: price, metrics: m });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
