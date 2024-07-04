// Import the required contracts
const UniswapV2Router02ABI = require("/Users/miguelmorgado/Desktop/dex/UniPeripheryForkV2/build/contracts/UniswapV2Router02.json").abi;
const DAI = artifacts.require("DAI.sol");
const ETK = artifacts.require('EnergyToken.sol');
const {Web3} = require("web3");

module.exports = async function (deployer, network, accounts) {
  const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; //mainnet address
  const etkAddress = '0xE99Ae7aF114FE98b4E50e7aB5E081563Da9Dc2fE';  //locally deployed
  const daiAddress = '0x0a64DfBb654a54036081B64E670d896Ad898790c';  //locally deployed
  const liquidityProvider = '0xBFCc51D2aeBcFe96ADa4ABd8B07965a9F6A95eA9';

  // Create a new instance of the UniswapV2Router02 contract
  const web3 = new Web3('HTTP://127.0.0.1:7545');
  const router = new web3.eth.Contract(UniswapV2Router02ABI, routerAddress);

  // Get the WETH and DAI contracts
  const dai = await DAI.at(daiAddress);
  const etk = await ETK.at(etkAddress);

  const amountDAI = web3.utils.toWei('41.25', 'ether');
  const amountETK = web3.utils.toWei('275', 'ether');

  await dai.approve(routerAddress, amountDAI, { from: liquidityProvider });
  await etk.approve(routerAddress, amountETK, { from: liquidityProvider });

  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  try {
    const tx = await router.methods.addLiquidity(
      daiAddress,
      etkAddress,
      amountDAI,
      amountETK,
      0,
      0,
      liquidityProvider,
      deadline,
      { from: liquidityProvider, gas: 800000 }
    ).send({ from: liquidityProvider, gas: 800000 });;
    console.log("Liquidity added successfully", tx);
  } catch (error) {
    console.error("Failed to add liquidity:", error);
  }
};
