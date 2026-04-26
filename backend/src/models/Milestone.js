import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema(
  {
    challengeId: { type: Number, unique: true },
    creator: String,
    channelId: String,
    metric: String,                  // "subscribers" | "viewCount" | "videoCount"
    target: Number,
    deadline: Date,
    badgeUri: String,
    resolved: { type: Boolean, default: false },
    outcome: { type: String, enum: ["Pending", "Yes", "No"], default: "Pending" },
    actualValue: Number,
  },
  { timestamps: true }
);

export const Milestone = mongoose.model("Milestone", milestoneSchema);
