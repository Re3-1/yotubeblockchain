import mongoose from "mongoose";

const tradeSchema = new mongoose.Schema(
  {
    listingId: Number,
    tokenContract: String,
    buyer: String,
    seller: String,
    creator: String,
    amount: String,          // 1e18 units
    pricePerToken: String,   // wei
    total: String,           // wei
    royalty: String,
    platformFee: String,
    txHash: String,
    blockNumber: Number,
  },
  { timestamps: true }
);

export const Trade = mongoose.model("Trade", tradeSchema);
