const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const WETH9 = await hre.ethers.getContractFactory("WETH9");
  const V2Factory = await hre.ethers.getContractFactory("V2Factory");
  const V2Router = await hre.ethers.getContractFactory("V2Router");

  const tokenA = await MockERC20.deploy(
    "Demo USD",
    "dUSD",
    hre.ethers.parseEther("1000000")
  );
  await tokenA.waitForDeployment();

  const tokenB = await MockERC20.deploy(
    "Demo EUR",
    "dEUR",
    hre.ethers.parseEther("1000000")
  );
  await tokenB.waitForDeployment();

  const weth = await WETH9.deploy();
  await weth.waitForDeployment();

  const factory = await V2Factory.deploy();
  await factory.waitForDeployment();

  const router = await V2Router.deploy(
    await factory.getAddress(),
    await weth.getAddress()
  );
  await router.waitForDeployment();

  // Wrap ETH for the deployer so the local demo has WETH liquidity.
  await (await weth.deposit({ value: hre.ethers.parseEther("30") })).wait();

  const max = hre.ethers.MaxUint256;
  await (await tokenA.approve(await router.getAddress(), max)).wait();
  await (await tokenB.approve(await router.getAddress(), max)).wait();
  await (await weth.approve(await router.getAddress(), max)).wait();

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const amountToken = hre.ethers.parseEther("10000");
  const amountWeth = hre.ethers.parseEther("10");

  await (
    await router.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      amountToken,
      amountToken,
      0,
      0,
      deployer.address,
      deadline
    )
  ).wait();

  await (
    await router.addLiquidity(
      await tokenA.getAddress(),
      await weth.getAddress(),
      amountToken,
      amountWeth,
      0,
      0,
      deployer.address,
      deadline
    )
  ).wait();

  await (
    await router.addLiquidity(
      await tokenB.getAddress(),
      await weth.getAddress(),
      amountToken,
      amountWeth,
      0,
      0,
      deployer.address,
      deadline
    )
  ).wait();

  const output = {
    deployer: deployer.address,
    tokenA: await tokenA.getAddress(),
    tokenB: await tokenB.getAddress(),
    weth: await weth.getAddress(),
    factory: await factory.getAddress(),
    router: await router.getAddress()
  };

  console.log(JSON.stringify(output, null, 2));
  console.log("\nCopy these addresses into frontend/.env.local");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});