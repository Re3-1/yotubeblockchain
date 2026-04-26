import axios from "axios";
import NodeCache from "node-cache";
import { PlatformAdapter } from "./PlatformAdapter.js";

const cache = new NodeCache({ stdTTL: 15 * 60 });

/**
 * Minimal Twitch Helix adapter. Requires TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET.
 * Falls back to a clear error if creds are missing — plug your keys in when
 * expanding to Twitch per the future-scope section.
 */
export class TwitchAdapter extends PlatformAdapter {
  get platform() { return "twitch"; }

  async _appToken() {
    const cached = cache.get("twitch_token");
    if (cached) return cached;
    const { data } = await axios.post(
      "https://id.twitch.tv/oauth2/token",
      null,
      {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          grant_type: "client_credentials",
        },
      }
    );
    cache.set("twitch_token", data.access_token, data.expires_in - 60);
    return data.access_token;
  }

  async listMyChannels(userAccessToken) {
    if (!process.env.TWITCH_CLIENT_ID) {
      throw new Error("TWITCH_CLIENT_ID not set — adapter is a stub");
    }
    const { data } = await axios.get("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
      },
    });
    return (data.data || []).map((u) => ({
      platform: "twitch",
      channelId: u.id,
      title: u.display_name,
      thumbnail: u.profile_image_url,
      subscribers: 0, // Helix /subscriptions needs the broadcaster scope
      views: u.view_count,
      videos: 0,
    }));
  }

  async getPublicMetrics(channelId) {
    if (!process.env.TWITCH_CLIENT_ID) return null;
    const key = `twitch:${channelId}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const token = await this._appToken();
    const { data } = await axios.get("https://api.twitch.tv/helix/users", {
      params: { id: channelId },
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
      },
    });
    const u = data.data?.[0];
    if (!u) return null;
    const out = {
      platform: "twitch",
      channelId,
      title: u.display_name,
      thumbnail: u.profile_image_url,
      subscribers: 0,
      views: u.view_count,
      videos: 0,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(key, out);
    return out;
  }
}
