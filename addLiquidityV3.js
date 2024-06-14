const { ethers } = require('ethers');
const { Token } = require('@uniswap/sdk-core');
const { Pool, Position, nearestUsableTick, TickMath, maxLiquidityForAmounts } = require('@uniswap/v3-sdk');
const bn = require('bignumber.js');
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const artifacts = {
  NonfungiblePositionManager: require("/Users/miguelmorgado/Desktop/dex/PeripheryV3/build/contracts/NonfungiblePositionManager.json"),
  UniswapV3Pool: require("/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/UniswapV3Pool.json"),
};

const POSITION_MANAGER_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const ETK_ADDRESS = '0xD008c39f5B5d357b6006590F0E0aabD0adBa8D24';
const DAI_ADDRESS = '0x0C81CF334Ed577821D03894fDe62d6e279965849';
const DAI_ETK_POOL = '0xC9Dd3B1071996b8fFc40EEF125A677CFF99C2516';

const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:7545'); // Change the provider if necessary

async function getPoolData(poolContract) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity.toString(),
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    tick: slot0.tick
  };
}

async function main() {
  const owner = '0xE803D41C31261Ca0AAb13Fb2cC59B452d322fDD6';

  const daiToken = new ethers.Contract(DAI_ADDRESS, require('/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/Dai.json').abi, provider.getSigner(owner));
  const etkToken = new ethers.Contract(ETK_ADDRESS, require('/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/EnergyToken.json').abi, provider.getSigner(owner));

  const amountETK = ethers.utils.parseUnits('250', 18);
  const amountDAI = ethers.utils.parseUnits('37.5', 18);

  // Check balances
  const daiBalance = await daiToken.balanceOf(owner);
  const etkBalance = await etkToken.balanceOf(owner);
  console.log(`DAI Balance: ${ethers.utils.formatUnits(daiBalance, 18)}`);
  console.log(`ETK Balance: ${ethers.utils.formatUnits(etkBalance, 18)}`);

  // Ensure sufficient balances
  if (daiBalance.lt(amountDAI)) {
    throw new Error('Insufficient DAI balance');
  }
  if (etkBalance.lt(amountETK)) {
    throw new Error('Insufficient ETK balance');
  }

  // Approve tokens
  await daiToken.approve(POSITION_MANAGER_ADDRESS, amountDAI);
  await etkToken.approve(POSITION_MANAGER_ADDRESS, amountETK);

  // Verify approvals
  const daiAllowance = await daiToken.allowance(owner, POSITION_MANAGER_ADDRESS);
  const etkAllowance = await etkToken.allowance(owner, POSITION_MANAGER_ADDRESS);
  console.log(`DAI Allowance: ${ethers.utils.formatUnits(daiAllowance, 18)}`);
  console.log(`ETK Allowance: ${ethers.utils.formatUnits(etkAllowance, 18)}`);

  if (daiAllowance.lt(amountDAI)) {
    throw new Error('DAI allowance not sufficient');
  }
  if (etkAllowance.lt(amountETK)) {
    throw new Error('ETK allowance not sufficient');
  }

  const poolContract = new ethers.Contract(DAI_ETK_POOL, artifacts.UniswapV3Pool.abi, provider);
  const poolData = await getPoolData(poolContract);

  const DAIToken = new Token(1, DAI_ADDRESS, 18, 'DAI', 'Dai Stablecoin');
  const ETKToken = new Token(1, ETK_ADDRESS, 18, 'ETK', 'Energy Token');

  const pool = new Pool(
    DAIToken,
    ETKToken,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  );

  // Correct calculation of sqrtPriceX96 values
  const priceLower = 0.09;
  const priceUpper = 0.21;

  const sqrtPriceX96Lower = TickMath.getSqrtRatioAtTick(Math.floor(Math.log(priceLower) / Math.log(1.0001)));
  const sqrtPriceX96Upper = TickMath.getSqrtRatioAtTick(Math.floor(Math.log(priceUpper) / Math.log(1.0001)));

  console.log(`sqrtPriceX96Lower: ${sqrtPriceX96Lower}`);
  console.log(`sqrtPriceX96Upper: ${sqrtPriceX96Upper}`);

  // Calculate the nearest usable ticks
  const tickLower = nearestUsableTick(TickMath.getTickAtSqrtRatio(sqrtPriceX96Lower), poolData.tickSpacing);
  const tickUpper = nearestUsableTick(TickMath.getTickAtSqrtRatio(sqrtPriceX96Upper), poolData.tickSpacing);

  console.log(`tickLower: ${tickLower}, tickUpper: ${tickUpper}`);

  // Calculate liquidity based on desired amounts
  const liquidity = Position.fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0: amountDAI.toString(),
    amount1: amountETK.toString(),
    useFullRange: true,
  }).liquidity;

  console.log(`Calculated Liquidity: ${liquidity.toString()}`);

  const position = new Position({
    pool: pool,
    liquidity: liquidity,
    tickLower: tickLower,
    tickUpper: tickUpper,
  });

  let { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts;
  console.log(`amount0Desired: ${amount0Desired.toString()}, amount1Desired: ${amount1Desired.toString()}`);

  // Convert amount0Desired and amount1Desired to BigNumber for comparison
  amount0Desired = new bn(amount0Desired.toString());
  amount1Desired = new bn(amount1Desired.toString());

  // Ensure desired amounts do not exceed balances
  if (amount0Desired.gt(new bn(amountDAI.toString()))) {
    console.warn('amount0Desired exceeds DAI balance, scaling down...');
    amount0Desired = new bn(amountDAI.toString());
  }
  if (amount1Desired.gt(new bn(amountETK.toString()))) {
    console.warn('amount1Desired exceeds ETK balance, scaling down...');
    amount1Desired = new bn(amountETK.toString());
  }

  const params = {
    token0: DAI_ADDRESS,
    token1: ETK_ADDRESS,
    fee: poolData.fee,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0Desired: amount0Desired.toFixed(0),
    amount1Desired: amount1Desired.toFixed(0),
    amount0Min: 0,
    amount1Min: 0,
    recipient: owner,
    deadline: Math.floor(Date.now() / 1000) + (60 * 10),
  };

  // ** Log parameters passed to the mint function **
  console.log('Mint Parameters:', params);

  const nonfungiblePositionManager = new ethers.Contract(
    POSITION_MANAGER_ADDRESS,
    artifacts.NonfungiblePositionManager.abi,
    provider.getSigner(owner)
  );

  try {
    const tx = await nonfungiblePositionManager.mint(params, { gasLimit: 1000000 });
    const receipt = await tx.wait();
    console.log('Liquidity added:', receipt.transactionHash);
  } catch (error) {
    console.error('Error adding liquidity:', error);
    // ** Log mint parameters on error **
    console.error('Mint Parameters:', params);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
