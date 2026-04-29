const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MilestoneChallenge", () => {
  let admin, creator, fanA, fanB, oracle;
  let badge, ms;
  const Yes = 1, No = 2;

  beforeEach(async () => {
    [admin, creator, fanA, fanB, oracle] = await ethers.getSigners();
    const Badge = await ethers.getContractFactory("ChannelBadgeNFT");
    badge = await Badge.connect(admin).deploy();
    await badge.waitForDeployment();

    const MS = await ethers.getContractFactory("MilestoneChallenge");
    ms = await MS.connect(admin).deploy(oracle.address, await badge.getAddress());
    await ms.waitForDeployment();

    const role = await badge.MINTER_ROLE();
    await badge.connect(admin).grantRole(role, await ms.getAddress());
  });

  it("full happy path: create → join → resolve → claim", async () => {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;
    await ms.connect(creator).createChallenge(
      "UC_abc", "subscribers", 50000, deadline, "ipfs://badge.json"
    );

    await ms.connect(fanA).join(1, Yes);
    await ms.connect(fanB).join(1, No);

    // fast-forward past deadline
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine");

    // oracle reports actual value = 55000 → YES wins
    await ms.connect(oracle).resolve(1, 55000);

    await ms.connect(fanA).claimBadge(1);
    expect(await badge.balanceOf(fanA.address)).to.equal(1n);

    // fanB predicted NO → should revert
    await expect(ms.connect(fanB).claimBadge(1)).to.be.revertedWith("wrong prediction");
  });

  it("cannot resolve before deadline", async () => {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await ms.connect(creator).createChallenge(
      "UC_abc", "subs", 100, deadline, "ipfs://b"
    );
    await expect(ms.connect(oracle).resolve(1, 200)).to.be.revertedWith("too early");
  });

  it("non-oracle cannot resolve", async () => {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 10;
    await ms.connect(creator).createChallenge("UC", "subs", 1, deadline, "u");
    await ethers.provider.send("evm_increaseTime", [20]);
    await ethers.provider.send("evm_mine");
    await expect(ms.connect(fanA).resolve(1, 2)).to.be.revertedWith("not oracle");
  });
});
