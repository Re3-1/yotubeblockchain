import { ethers } from "ethers";

export function provider() {
  const rpcUrl =
    process.env.CHAIN_RPC_URL ||
    process.env.SEPOLIA_RPC ||
    process.env.POLYGON_RPC_URL;
  return new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: ethers.Network.from(11155111),
  });
}

export function oracleWallet() {
  return new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, provider());
}

// Minimal ABI for the one call the oracle job needs.
export const MILESTONE_ABI = [
  "function resolve(uint256 id, uint256 actualValue) external",
  "function challenges(uint256) view returns (address creator,string channelId,string metric,uint256 target,uint64 deadline,uint8 outcome,string badgeUri,bool resolved)",
];
