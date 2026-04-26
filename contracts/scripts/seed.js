/**
 * End-to-end demo seed script.
 *
 * Run against a local hardhat node so you can click through the DApp with
 * pre-populated data:
 *
 *   npx hardhat node
 *   npx hardhat run scripts/seed.js --network localhost
 *
 * Steps: deploy 4 contracts, mint a demo channel token, list on marketplace,
 * simulate 3 buys (rotating through fan signers), create + resolve a
 * milestone challenge so a badge is claimable.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const signers = await ethers.getSigners();
  const [deployer, creator, fanA, fanB, fanC] = signers;
  console.log("deployer:", deployer.address);
  console.log("creator :", creator.address);

  // 1. Deploy all four
  const Badge = await ethers.getContractFactory("ChannelBadgeNFT");
  const badge = await Badge.deploy(); await badge.waitForDeployment();

  const Market = await ethers.getContractFactory("Marketplace");
  const mkt = await Market.deploy(200, 100); await mkt.waitForDeployment();

  const MS = await ethers.getContractFactory("MilestoneChallenge");
  const ms = await MS.deploy(deployer.address, await badge.getAddress());
  await ms.waitForDeployment();

  await badge.grantRole(await badge.MINTER_ROLE(), await ms.getAddress());

  const Channel = await ethers.getContractFactory("ChannelToken");
  const tok = await Channel.connect(creator).deploy(
    "Demo Creator Coin", "DCC", "UC_demo",
    creator.address,
    ethers.parseUnits("1000000", 18),
    ethers.parseUnits("10000", 18)
  );
  await tok.waitForDeployment();

  // 2. Creator lists 500 tokens at 0.01 MATIC / token
  const listingAmt = ethers.parseUnits("500", 18);
  const price = ethers.parseEther("0.01");
  await tok.connect(creator).approve(await mkt.getAddress(), listingAmt);
  await mkt.connect(creator).listForSale(
    await tok.getAddress(), creator.address, listingAmt, price
  );
  console.log("listed 500 DCC @ 0.01 MATIC each");

  // 3. Fans A/B/C buy 50/30/20
  for (const [fan, units] of [[fanA, 50], [fanB, 30], [fanC, 20]]) {
    const amt = ethers.parseUnits(String(units), 18);
    const total = (amt * price) / ethers.parseUnits("1", 18);
    await mkt.connect(fan).buy(1, amt, { value: total });
    console.log(`fan ${fan.address.slice(0,6)} bought ${units}`);
  }

  // 4. Milestone challenge with short deadline so it resolves in this script
  const deadline = (await ethers.provider.getBlock("latest")).timestamp + 10;
  await ms.connect(creator).createChallenge(
    "UC_demo", "subscribers", 50000, deadline, "ipfs://demo-badge.json"
  );
  await ms.connect(fanA).join(1, 1); // YES
  await ms.connect(fanB).join(1, 2); // NO
  await ethers.provider.send("evm_increaseTime", [20]);
  await ethers.provider.send("evm_mine");
  await ms.connect(deployer).resolve(1, 55000); // YES wins
  await ms.connect(fanA).claimBadge(1);
  console.log("milestone resolved, fanA claimed badge");

  // 5. Dump addresses
  const out = {
    network: network.name,
    ChannelBadgeNFT: await badge.getAddress(),
    Marketplace: await mkt.getAddress(),
    MilestoneChallenge: await ms.getAddress(),
    DemoChannelToken: await tok.getAddress(),
    creator: creator.address,
    fans: [fanA.address, fanB.address, fanC.address],
  };
  const file = path.join(__dirname, "..", "deployments", `${network.name}-seed.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("wrote", file);
  console.log("\nPaste into frontend/.env:");
  console.log(`VITE_MARKETPLACE_ADDRESS=${out.Marketplace}`);
  console.log(`VITE_MILESTONE_ADDRESS=${out.MilestoneChallenge}`);
  console.log(`VITE_BADGE_ADDRESS=${out.ChannelBadgeNFT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
