import { google } from "googleapis";
import NodeCache from "node-cache";

const metricsCache = new NodeCache({ stdTTL: 15 * 60 }); // 15 min

/**
 * Returns the channels owned by the currently-signed-in Google account.
 * Uses the OAuth access token so mine=true works.
 */
export async function listMyChannels(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const yt = google.youtube({ version: "v3", auth });
  const res = await yt.channels.list({
    part: ["id", "snippet", "statistics"],
    mine: true,
  });
  return (res.data.items || []).map((c) => ({
    channelId: c.id,
    title: c.snippet.title,
    thumbnail: c.snippet.thumbnails?.default?.url,
    subscribers: Number(c.statistics.subscriberCount || 0),
    views: Number(c.statistics.viewCount || 0),
    videos: Number(c.statistics.videoCount || 0),
  }));
}

/**
 * Public metrics read (no OAuth). Uses API key. Cached 15 min to respect
 * the 10k units/day quota.
 */
export async function getPublicMetrics(channelId) {
  const cached = metricsCache.get(channelId);
  if (cached) return cached;
  const yt = google.youtube({ version: "v3", auth: process.env.YT_API_KEY });
  const res = await yt.channels.list({
    part: ["statistics", "snippet"],
    id: [channelId],
  });
  const item = res.data.items?.[0];
  if (!item) return null;
  const data = {
    channelId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.default?.url,
    subscribers: Number(item.statistics.subscriberCount || 0),
    views: Number(item.statistics.viewCount || 0),
    videos: Number(item.statistics.videoCount || 0),
    fetchedAt: new Date().toISOString(),
  };
  metricsCache.set(channelId, data);
  return data;
}
