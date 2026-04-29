import { google } from "googleapis";
import NodeCache from "node-cache";

const metricsCache = new NodeCache({ stdTTL: 15 * 60 }); // 15 min

export class YouTubeAuthError extends Error {
  constructor(message = "re-auth with YouTube scope") {
    super(message);
    this.name = "YouTubeAuthError";
    this.code = "YOUTUBE_REAUTH_REQUIRED";
    this.status = 401;
  }
}

function createOAuthClient() {
  return new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_CALLBACK_URL,
    forceRefreshOnFailure: true,
  });
}

function isGoogleAuthError(error) {
  return (
    error instanceof YouTubeAuthError ||
    error?.status === 401 ||
    error?.code === 401 ||
    error?.response?.status === 401 ||
    error?.response?.data?.error === "invalid_grant" ||
    error?.errors?.some((item) => item.reason === "authError") ||
    error?.message === "No refresh token is set."
  );
}

async function refreshAccessToken(auth, onTokens) {
  try {
    const { credentials } = await auth.refreshAccessToken();
    if (credentials?.access_token) await onTokens?.(credentials);
  } catch (error) {
    if (isGoogleAuthError(error)) throw new YouTubeAuthError();
    throw error;
  }
}

/**
 * Returns the channels owned by the currently-signed-in Google account.
 * Uses the OAuth access token so mine=true works.
 */
export async function listMyChannels(accessToken, refreshToken, onTokens) {
  if (!accessToken && !refreshToken) throw new YouTubeAuthError();

  const auth = createOAuthClient();
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (refreshToken) await refreshAccessToken(auth, onTokens);

  let res;
  try {
    const yt = google.youtube({ version: "v3", auth });
    res = await yt.channels.list({
      part: ["id", "snippet", "statistics"],
      mine: true,
    });
  } catch (error) {
    if (isGoogleAuthError(error)) throw new YouTubeAuthError();
    throw error;
  }

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
