import { PlatformAdapter } from "./PlatformAdapter.js";
import { listMyChannels, getPublicMetrics } from "../youtube.js";

export class YouTubeAdapter extends PlatformAdapter {
  get platform() { return "youtube"; }

  async listMyChannels(accessToken) {
    const rows = await listMyChannels(accessToken);
    return rows.map((r) => ({ platform: "youtube", ...r }));
  }

  async getPublicMetrics(channelId) {
    const r = await getPublicMetrics(channelId);
    return r ? { platform: "youtube", ...r } : null;
  }
}
