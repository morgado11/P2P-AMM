const EnergyToken = artifacts.require("EnergyToken.sol");
const {Web3} = require("web3");
const UniswapV2FactoryABI = require("/Users/miguelmorgado/Desktop/dex/UniCoreForkV2/build/contracts/UniswapV2Factory.json").abi; // Uniswap V2 Factory ABI

module.exports = async function (deployer, network, addresses) {

const factoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'; // Uniswap V2 Factory on Ethereum mainnet
const daiAddress = '0x194b111d5be9a103a4e865F935366B7197A0536b'; // Deployed DAI locally
const etkAddress = '0x90cbA0C02d6a52Da6e85E4dfA450f1003a5100CB'; // Deployed ETK locally

const web3 = new Web3('HTTP://127.0.0.1:7545');
const factory = new web3.eth.Contract(UniswapV2FactoryABI, factoryAddress);
const deployerAddress = '0x21598727F688caafED046CeA731Ad09667e0C8A6'; //Test account

 // Check if the DAI and Energy Token pair already exists
 const DaiEtkPair = await factory.methods.getPair(etkAddress, daiAddress).call();
 if (DaiEtkPair !== "0x0000000000000000000000000000000000000000") {
   console.log("Pair already exists:", DaiEtkPair);
   return;
 }

 try {
  const tx = await factory.methods.createPair(etkAddress, daiAddress)
      .send({ from: deployerAddress, gas: 6721975 });

  if (tx.events && tx.events.PairCreated && tx.events.PairCreated.returnValues) {
      console.log("Pair created successfully:", tx.events.PairCreated.returnValues.pair);
  } else {
      console.log("Pair created, but no event received in the receipt.");
  }
} catch (error) {
  console.error("Failed to create pair:", error);
}
}