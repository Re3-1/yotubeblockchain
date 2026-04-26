// Deploys all 4 contracts and writes addresses to deployments/<network>.json
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Badge NFT
  const Badge = await ethers.getContractFactory("ChannelBadgeNFT");
  const badge = await Badge.deploy();
  await badge.waitForDeployment();
  const badgeAddr = await badge.getAddress();
  console.log("ChannelBadgeNFT:", badgeAddr);

  // 2. Marketplace (2% royalty, 1% platform)
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(200, 100);
  await marketplace.waitForDeployment();
  const mktAddr = await marketplace.getAddress();
  console.log("Marketplace:", mktAddr);

  // 3. MilestoneChallenge (oracle = deployer for now)
  const Milestone = await ethers.getContractFactory("MilestoneChallenge");
  const milestone = await Milestone.deploy(deployer.address, badgeAddr);
  await milestone.waitForDeployment();
  const msAddr = await milestone.getAddress();
  console.log("MilestoneChallenge:", msAddr);

  // 4. Give MilestoneChallenge minter role on the badge
  const MINTER_ROLE = await badge.MINTER_ROLE();
  const tx = await badge.grantRole(MINTER_ROLE, msAddr);
  await tx.wait();
  console.log("Granted MINTER_ROLE to MilestoneChallenge");

  // Sample ChannelToken (optional — handy for local testing)
  const Channel = await ethers.getContractFactory("ChannelToken");
  const sample = await Channel.deploy(
    "Demo Creator Token",
    "DEMO",
    "UC_demo_channel",
    deployer.address,
    ethers.parseUnits("1000000", 18),
    ethers.parseUnits("10000", 18)
  );
  await sample.waitForDeployment();
  const sampleAddr = await sample.getAddress();
  console.log("Sample ChannelToken:", sampleAddr);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    ChannelBadgeNFT: badgeAddr,
    Marketplace: mktAddr,
    MilestoneChallenge: msAddr,
    SampleChannelToken: sampleAddr,
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${network.name}.json`),
    JSON.stringify(out, null, 2)
  );
  console.log("Wrote deployments/" + network.name + ".json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
