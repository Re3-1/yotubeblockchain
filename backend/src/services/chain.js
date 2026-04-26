import { ethers } from "ethers";

export function provider() {
  return new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
}

export function oracleWallet() {
  return new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, provider());
}

// Minimal ABI for the one call the oracle job needs.
export const MILESTONE_ABI = [
  "function resolve(uint256 id, uint256 actualValue) external",
  "function challenges(uint256) view returns (address creator,string channelId,string metric,uint256 target,uint64 deadline,uint8 outcome,string badgeUri,bool resolved)",
];
