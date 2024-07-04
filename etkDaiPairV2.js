const EnergyToken = artifacts.require("EnergyToken.sol");
const {Web3} = require("web3");
const UniswapV2FactoryABI = require("/Users/miguelmorgado/Desktop/dex/UniCoreForkV2/build/contracts/UniswapV2Factory.json").abi; // Uniswap V2 Factory ABI

module.exports = async function (deployer, network, addresses) {

const factoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'; // Uniswap V2 Factory on Ethereum mainnet
const etkAddress = '0xE99Ae7aF114FE98b4E50e7aB5E081563Da9Dc2fE'; // Deployed ETK locally
const daiAddress = '0x0a64DfBb654a54036081B64E670d896Ad898790c'; // Deployed DAI locally
const deployerAddress = '0xBFCc51D2aeBcFe96ADa4ABd8B07965a9F6A95eA9'; //Test account

const web3 = new Web3('HTTP://127.0.0.1:7545');
const factory = new web3.eth.Contract(UniswapV2FactoryABI, factoryAddress);

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