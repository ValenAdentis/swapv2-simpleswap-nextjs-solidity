const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("V2 DEX", function () {
  async function deployFixture() {
    const [owner, trader] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const tokenA = await Token.deploy(
      "Demo USD",
      "dUSD",
      ethers.parseEther("1000000")
    );
    const tokenB = await Token.deploy(
      "Demo EUR",
      "dEUR",
      ethers.parseEther("1000000")
    );

    const WETH = await ethers.getContractFactory("WETH9");
    const weth = await WETH.deploy();

    const Factory = await ethers.getContractFactory("V2Factory");
    const factory = await Factory.deploy();

    const Router = await ethers.getContractFactory("V2Router");
    const router = await Router.deploy(
      await factory.getAddress(),
      await weth.getAddress()
    );

    await tokenA.transfer(trader.address, ethers.parseEther("1000"));
    await tokenB.transfer(trader.address, ethers.parseEther("1000"));

    const max = ethers.MaxUint256;
    await tokenA.approve(await router.getAddress(), max);
    await tokenB.approve(await router.getAddress(), max);
    await weth.approve(await router.getAddress(), max);

    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await router.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      ethers.parseEther("10000"),
      ethers.parseEther("10000"),
      0,
      0,
      owner.address,
      deadline
    );

    return { owner, trader, tokenA, tokenB, weth, factory, router };
  }

  it("quotes and executes an exact-input token swap", async function () {
    const { trader, tokenA, tokenB, router } = await deployFixture();

    await tokenA.connect(trader).approve(
      await router.getAddress(),
      ethers.MaxUint256
    );

    const amountIn = ethers.parseEther("100");
    const path = [await tokenA.getAddress(), await tokenB.getAddress()];
    const amounts = await router.getAmountsOut(amountIn, path);

    const before = await tokenB.balanceOf(trader.address);

    await router.connect(trader).swapExactTokensForTokens(
      amountIn,
      0,
      path,
      trader.address,
      Math.floor(Date.now() / 1000) + 3600
    );

    const after = await tokenB.balanceOf(trader.address);
    expect(after - before).to.equal(amounts[1]);
  });

  it("rejects expired swaps", async function () {
    const { trader, tokenA, tokenB, router } = await deployFixture();

    await tokenA.connect(trader).approve(
      await router.getAddress(),
      ethers.MaxUint256
    );

    await expect(
      router.connect(trader).swapExactTokensForTokens(
        ethers.parseEther("1"),
        0,
        [await tokenA.getAddress(), await tokenB.getAddress()],
        trader.address,
        1
      )
    ).to.be.revertedWith("EXPIRED");
  });

  it("supports ETH -> token swaps through WETH", async function () {
    const { trader, tokenA, weth, router, factory } = await deployFixture();

    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await router.addLiquidityETH(
      await tokenA.getAddress(),
      ethers.parseEther("10000"),
      0,
      0,
      trader.address,
      deadline,
      { value: ethers.parseEther("10") }
    );

    const before = await tokenA.balanceOf(trader.address);

    await router.connect(trader).swapExactETHForTokens(
      0,
      [await weth.getAddress(), await tokenA.getAddress()],
      trader.address,
      deadline,
      { value: ethers.parseEther("1") }
    );

    const after = await tokenA.balanceOf(trader.address);
    expect(after).to.be.gt(before);

    expect(await factory.allPairsLength()).to.equal(2);
  });
});