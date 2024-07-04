const DAI = artifacts.require("DAI.sol");
const {Web3} = require("web3");
const EnergyToken = artifacts.require('EnergyToken.sol');

module.exports = async function (deployer, network, addresses) {
  await deployer.deploy(DAI, 1);
  const dai = await DAI.deployed();
  const daiAddress = dai.address;
  console.log('DAI address:', daiAddress);

  await deployer.deploy(EnergyToken);
  const energytoken = await EnergyToken.deployed();
  const etkAddress = energytoken.address;
  console.log('ETK address:', etkAddress);
};
