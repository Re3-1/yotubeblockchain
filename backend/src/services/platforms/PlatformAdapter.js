/**
 * Generic interface every platform adapter (YouTube, Twitch, Instagram,
 * TikTok, Spotify) must implement. Keeps the rest of the backend platform-
 * agnostic so the system maps onto the "future scope — multi-platform
 * expansion" section of the report.
 *
 * All adapters return the same normalized shape:
 *   {
 *     platform: "youtube" | "twitch" | ...
 *     channelId: string,
 *     title: string,
 *     thumbnail: string,
 *     subscribers: number,
 *     views: number,
 *     videos: number,
 *   }
 */

export class PlatformAdapter {
  /** @returns {string} lower-case platform identifier */
  get platform() {
    throw new Error("platform getter not implemented");
  }

  /**
   * Channels owned by the currently-authenticated user.
   * @param {string} accessToken — OAuth access token
   * @returns {Promise<object[]>}
   */
  async listMyChannels(_accessToken) {
    throw new Error("listMyChannels not implemented");
  }

  /**
   * Public metrics for any channel — used by the pricing + forecast
   * services.
   * @param {string} channelId
   * @returns {Promise<object|null>}
   */
  async getPublicMetrics(_channelId) {
    throw new Error("getPublicMetrics not implemented");
  }
}
