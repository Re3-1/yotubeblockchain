const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

const DEFAULT_CAP = "1000000";
const DEFAULT_INITIAL_SUPPLY = "10000";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function tokenSymbolFromName(name) {
  return name
    .replace(/[^a-z0-9 ]/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 5)
    .toUpperCase() || "CHNL";
}

async function main() {
  const rpcUrl = requireEnv("SEPOLIA_RPC");
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  const channelId = requireEnv("CHANNEL_ID");
  const creator = requireEnv("CREATOR_WALLET");
  const name = process.env.TOKEN_NAME || "Creator Channel Token";
  const symbol = process.env.TOKEN_SYMBOL || tokenSymbolFromName(name);
  const cap = ethers.parseUnits(process.env.TOKEN_CAP || DEFAULT_CAP, 18);
  const initialSupply = ethers.parseUnits(
    process.env.TOKEN_INITIAL_SUPPLY || DEFAULT_INITIAL_SUPPLY,
    18
  );

  if (!ethers.isAddress(creator)) {
    throw new Error("CREATOR_WALLET must be a valid wallet address");
  }

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "ChannelToken.sol",
    "ChannelToken.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();

  console.log("Deploying ChannelToken with:", wallet.address);
  console.log("Network:", network.name, Number(network.chainId));
  console.log("Channel:", channelId);
  console.log("Creator:", creator);

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );
  const token = await factory.deploy(
    name,
    symbol,
    channelId,
    creator,
    cap,
    initialSupply
  );
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("ChannelToken:", address);

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const networkName = Number(network.chainId) === 11155111 ? "sepolia" : network.name;
  const file = path.join(deploymentsDir, `${networkName}.json`);
  const out = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : {
        network: networkName,
        chainId: Number(network.chainId),
      };

  out.ChannelTokens = out.ChannelTokens || {};
  out.ChannelTokens[channelId] = {
    address,
    name,
    symbol,
    creator,
    cap: process.env.TOKEN_CAP || DEFAULT_CAP,
    initialSupply: process.env.TOKEN_INITIAL_SUPPLY || DEFAULT_INITIAL_SUPPLY,
  };

  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Recorded ChannelToken in deployments/${networkName}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
