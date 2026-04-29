import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true, required: true },
    email: String,
    displayName: String,
    wallet: String,                  // their MetaMask address (lowercased)
    ytAccessToken: String,           // last OAuth access token
    ytRefreshToken: String,
    verifiedChannels: [
      {
        channelId: String,           // "UCxxxxxxxx"
        title: String,
        thumbnail: String,
        tokenContract: String,       // ChannelToken address after minting
      },
    ],
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
