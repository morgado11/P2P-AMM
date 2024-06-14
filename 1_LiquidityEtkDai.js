// Import the required contracts
const UniswapV2Router02ABI = require("/Users/miguelmorgado/Desktop/dex/UniPeripheryForkV2/build/contracts/UniswapV2Router02.json").abi;
const DAI = artifacts.require("DAI.sol");
const ETK = artifacts.require('EnergyToken.sol');
const {Web3} = require("web3");

module.exports = async function (deployer, network, accounts) {
  const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; //mainnet address
  const daiAddress = '0x194b111d5be9a103a4e865F935366B7197A0536b';  //locally deployed
  const etkAddress = '0x90cbA0C02d6a52Da6e85E4dfA450f1003a5100CB';  //locally deployed

  // Create a new instance of the UniswapV2Router02 contract
  const web3 = new Web3('HTTP://127.0.0.1:7545');
  const router = new web3.eth.Contract(UniswapV2Router02ABI, routerAddress);

  // Get the WETH and DAI contracts
  const dai = await DAI.at(daiAddress);
  const etk = await ETK.at(etkAddress);

  const liquidityProvider = '0x21598727F688caafED046CeA731Ad09667e0C8A6';
  const amountDAI = web3.utils.toWei('37.5', 'ether');
  const amountETK = web3.utils.toWei('250', 'ether');

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
