const bn = require('bignumber.js');
const ethers = require('ethers');
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const artifacts = {
  UniswapV3Factory: require("/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/UniswapV3Factory.json"),
  NonfungiblePositionManager: require("/Users/miguelmorgado/Desktop/dex/PeripheryV3/build/contracts/NonfungiblePositionManager.json"),
};

const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const POSITION_MANAGER_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const ETK_ADDRESS = '0xD008c39f5B5d357b6006590F0E0aabD0adBa8D24';
const DAI_ADDRESS = '0x0C81CF334Ed577821D03894fDe62d6e279965849';
const owner = '0xE803D41C31261Ca0AAb13Fb2cC59B452d322fDD6';

const FEE = 3000;

const provider = new ethers.providers.JsonRpcProvider('HTTP://127.0.0.1:7545');
const signer = provider.getSigner(owner);

function encodePriceSqrt(reserve1, reserve0) {
  return ethers.BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

const nonfungiblePositionManager = new ethers.Contract(
  POSITION_MANAGER_ADDRESS,
  artifacts.NonfungiblePositionManager.abi,
  signer
);
const factory = new ethers.Contract(
  FACTORY_ADDRESS,
  artifacts.UniswapV3Factory.abi,
  signer
);

async function deployPool(token0, token1, fee, price) {
  try {
    console.log(`Deploying pool with tokens ${token0} and ${token1}`);
    const tx = await nonfungiblePositionManager.createAndInitializePoolIfNecessary(
      token0,
      token1,
      fee,
      price,
      { gasLimit: 6721975 }
    );
    console.log(`Transaction hash: ${tx.hash}`);

    const poolAddress = await factory.getPool(token0, token1, fee);
    console.log(`Pool deployed at address: ${poolAddress}`);
    return poolAddress;
  } catch (error) {
    console.error('Error deploying pool:', error);
  }
}

async function main() {
  try {
    const price = encodePriceSqrt(0.15, 1);
    console.log(`Encoded price: ${price.toString()}`);
    const daiEtkPool = await deployPool(DAI_ADDRESS, ETK_ADDRESS, FEE, price);
    console.log('DAI_ETK_POOL=', `'${daiEtkPool}'`);
  } catch (error) {
    console.error('Error in main execution:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
