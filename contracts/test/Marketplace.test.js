const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace end-to-end", function () {
  let creator, fan, platform;
  let token, market;

  beforeEach(async () => {
    [platform, creator, fan] = await ethers.getSigners();

    const Channel = await ethers.getContractFactory("ChannelToken");
    token = await Channel.connect(creator).deploy(
      "Creator Coin", "CC", "UC_test",
      creator.address,
      ethers.parseUnits("1000000", 18),
      ethers.parseUnits("10000", 18)
    );
    await token.waitForDeployment();

    const M = await ethers.getContractFactory("Marketplace");
    market = await M.connect(platform).deploy(200, 100); // 2% royalty, 1% platform
    await market.waitForDeployment();
  });

  it("lists, buys, distributes royalty + fee + seller proceeds correctly", async () => {
    // creator approves 100 tokens for marketplace
    const amount = ethers.parseUnits("100", 18);
    const pricePerToken = ethers.parseEther("0.01"); // 0.01 MATIC per token
    await token.connect(creator).approve(await market.getAddress(), amount);

    await market.connect(creator).listForSale(
      await token.getAddress(),
      creator.address,
      amount,
      pricePerToken
    );

    const listingId = 1;
    const buyAmt = ethers.parseUnits("10", 18);
    const total = (buyAmt * pricePerToken) / ethers.parseUnits("1", 18);

    const creatorBefore = await ethers.provider.getBalance(creator.address);
    const platformBefore = await ethers.provider.getBalance(platform.address);

    const tx = await market.connect(fan).buy(listingId, buyAmt, { value: total });
    await tx.wait();

    expect(await token.balanceOf(fan.address)).to.equal(buyAmt);

    const creatorAfter = await ethers.provider.getBalance(creator.address);
    const platformAfter = await ethers.provider.getBalance(platform.address);

    // creator is both seller AND royalty target here, so they get 99% of total.
    const expectedCreatorDelta = total - (total * 100n) / 10000n; // minus 1% platform
    expect(creatorAfter - creatorBefore).to.equal(expectedCreatorDelta);

    const expectedPlatformDelta = (total * 100n) / 10000n;
    expect(platformAfter - platformBefore).to.equal(expectedPlatformDelta);
  });

  it("rejects wrong msg.value", async () => {
    const amount = ethers.parseUnits("5", 18);
    const price = ethers.parseEther("0.02");
    await token.connect(creator).approve(await market.getAddress(), amount);
    await market.connect(creator).listForSale(
      await token.getAddress(), creator.address, amount, price
    );
    await expect(
      market.connect(fan).buy(1, amount, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("wrong payment");
  });

  it("only seller can cancel", async () => {
    const amount = ethers.parseUnits("5", 18);
    const price = ethers.parseEther("0.02");
    await token.connect(creator).approve(await market.getAddress(), amount);
    await market.connect(creator).listForSale(
      await token.getAddress(), creator.address, amount, price
    );
    await expect(market.connect(fan).cancel(1)).to.be.revertedWith("not seller");
    await expect(market.connect(creator).cancel(1)).to.emit(market, "Cancelled");
  });
});
