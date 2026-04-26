// npx hardhat run scripts/verify.js --network mumbai
const fs = require("fs");
const path = require("path");
const { run, network } = require("hardhat");

async function verify(address, args) {
  try {
    await run("verify:verify", { address, constructorArguments: args });
    console.log("verified:", address);
  } catch (e) {
    console.warn("skip:", address, String(e).slice(0, 120));
  }
}

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error("no deployments for " + network.name);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  await verify(d.ChannelBadgeNFT, []);
  await verify(d.Marketplace, [200, 100]);
  await verify(d.MilestoneChallenge, [d.deployer, d.ChannelBadgeNFT]);
}
main().catch((e) => { console.error(e); process.exit(1); });
