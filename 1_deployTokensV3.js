const ETKToken = artifacts.require("EnergyToken.sol");
const DAIToken = artifacts.require("DAI.sol");

module.exports = async function (deployer) {
  await deployer.deploy(ETKToken);
  const energytoken = await ETKToken.deployed();
  const etkAddress = energytoken.address;
  console.log('ETK address:', etkAddress);

  await deployer.deploy(DAIToken,1);
  const dai = await DAIToken.deployed();
  const daiAddress = dai.address;
  console.log('DAI address:', daiAddress);
};
