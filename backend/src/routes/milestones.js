import { Router } from "express";
import { Milestone } from "../models/Milestone.js";

const router = Router();

/** Mirror an on-chain challenge creation into Mongo (UI analytics). */
router.post("/", async (req, res) => {
  try {
    const m = await Milestone.create(req.body);
    res.json(m);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

router.get("/", async (_req, res) => {
  res.json(await Milestone.find().sort({ deadline: 1 }).limit(200));
});

router.get("/:challengeId", async (req, res) => {
  const m = await Milestone.findOne({ challengeId: req.params.challengeId });
  if (!m) return res.status(404).json({ error: "not found" });
  res.json(m);
});

export default router;
