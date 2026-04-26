import { YouTubeAdapter } from "./YouTubeAdapter.js";
import { TwitchAdapter } from "./TwitchAdapter.js";

const registry = {
  youtube: new YouTubeAdapter(),
  twitch: new TwitchAdapter(),
};

export function getAdapter(platform = "youtube") {
  const a = registry[platform.toLowerCase()];
  if (!a) throw new Error("unknown platform: " + platform);
  return a;
}

export function listPlatforms() {
  return Object.keys(registry);
}
