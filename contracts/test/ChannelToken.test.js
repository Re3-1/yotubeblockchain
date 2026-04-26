const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChannelToken", () => {
  it("enforces cap and only-owner mint", async () => {
    const [creator, fan] = await ethers.getSigners();
    const F = await ethers.getContractFactory("ChannelToken");
    const t = await F.deploy(
      "Name", "NM", "UC_1", creator.address,
      ethers.parseUnits("1000", 18),
      ethers.parseUnits("100", 18)
    );
    await t.waitForDeployment();

    expect(await t.totalSupply()).to.equal(ethers.parseUnits("100", 18));

    // non-owner cannot mint
    await expect(
      t.connect(fan).mint(fan.address, ethers.parseUnits("1", 18))
    ).to.be.reverted;

    // cap enforced
    await expect(
      t.connect(creator).mint(creator.address, ethers.parseUnits("10000", 18))
    ).to.be.revertedWith("cap reached");

    // within cap works
    await t.connect(creator).mint(fan.address, ethers.parseUnits("10", 18));
    expect(await t.balanceOf(fan.address)).to.equal(ethers.parseUnits("10", 18));
  });
});
