import cron from "node-cron";
import { ethers } from "ethers";
import { Milestone } from "../models/Milestone.js";
import { oracleWallet, MILESTONE_ABI } from "../services/chain.js";
import { getPublicMetrics } from "../services/youtube.js";

/**
 * Every hour: for each unresolved milestone whose deadline has passed,
 * fetch the real YouTube metric and call MilestoneChallenge.resolve()
 * from the oracle wallet.
 */
export function startMilestoneResolver() {
  const addr = process.env.MILESTONE_ADDRESS;
  if (!addr || !process.env.ORACLE_PRIVATE_KEY) {
    console.warn("milestone resolver disabled (missing env)");
    return;
  }
  const c = new ethers.Contract(addr, MILESTONE_ABI, oracleWallet());

  cron.schedule("0 * * * *", async () => {
    try {
      const due = await Milestone.find({
        resolved: false,
        deadline: { $lte: new Date() },
      });
      for (const m of due) {
        const metrics = await getPublicMetrics(m.channelId);
        if (!metrics) continue;
        const actual =
          m.metric === "subscribers" ? metrics.subscribers :
          m.metric === "views" ? metrics.views :
          metrics.videos;

        console.log(`[resolver] challenge=${m.challengeId} actual=${actual}`);
        const tx = await c.resolve(m.challengeId, actual);
        await tx.wait();

        m.resolved = true;
        m.outcome = actual >= m.target ? "Yes" : "No";
        m.actualValue = actual;
        await m.save();
      }
    } catch (e) {
      console.error("[resolver] error", e);
    }
  });
  console.log("milestone resolver scheduled (hourly)");
}
