// Minimal ABIs — only the functions we call from the UI.

export const ChannelTokenABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function channelId() view returns (string)",
  "function owner() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
];

export const MarketplaceABI = [
  "function royaltyBps() view returns (uint16)",
  "function platformFeeBps() view returns (uint16)",
  "function nextListingId() view returns (uint256)",
  "function listings(uint256) view returns (address seller,address token,address creator,uint256 amount,uint256 pricePerToken,bool active)",
  "function listForSale(address token,address creator,uint256 amount,uint256 pricePerToken) returns (uint256)",
  "function buy(uint256 id,uint256 amount) payable",
  "function cancel(uint256 id)",
  "event Listed(uint256 indexed id,address indexed seller,address indexed token,uint256 amount,uint256 pricePerToken)",
  "event Purchased(uint256 indexed id,address indexed buyer,uint256 amount,uint256 totalPaid,uint256 royaltyPaid,uint256 platformFeePaid)",
];

export const MilestoneABI = [
  "function createChallenge(string channelId,string metric,uint256 target,uint64 deadline,string badgeUri) returns (uint256)",
  "function join(uint256 id,uint8 prediction)",
  "function claimBadge(uint256 id)",
  "function challenges(uint256) view returns (address creator,string channelId,string metric,uint256 target,uint64 deadline,uint8 outcome,string badgeUri,bool resolved)",
  "event ChallengeCreated(uint256 indexed id,address indexed creator,string channelId,string metric,uint256 target,uint64 deadline)",
  "event Joined(uint256 indexed id,address indexed user,uint8 prediction)",
  "event Resolved(uint256 indexed id,uint8 outcome,uint256 actual)",
  "event BadgeClaimed(uint256 indexed id,address indexed user,uint256 badgeId)",
];

export const BadgeABI = [
  "function balanceOf(address) view returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
];

// Factory bytecode deploy is out of scope for the UI — creators
// deploy their ChannelToken from Hardhat.  UI just reads it.
