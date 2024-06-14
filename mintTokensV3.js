const {Web3} = require('web3');
const daiABI = require('/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/Dai.json').abi;
const etkABI = require('/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/EnergyToken.json').abi;

// Connect to your local Ethereum node
const web3 = new Web3('http://127.0.0.1:7545');

// Define the addresses
const etkAddress = '0xD008c39f5B5d357b6006590F0E0aabD0adBa8D24'; // Replace with your deployed ETK token address
const daiAddress = '0x0C81CF334Ed577821D03894fDe62d6e279965849'; // Replace with your deployed DAI token address
const accountAddress = '0xE803D41C31261Ca0AAb13Fb2cC59B452d322fDD6'; // Replace with your account address

// Create contract instances
const daiToken = new web3.eth.Contract(daiABI, daiAddress);
const etkToken = new web3.eth.Contract(etkABI, etkAddress);

// Function to mint tokens
async function mintTokens() {
  // Amounts to mint
  const amountETK = web3.utils.toWei('650', 'ether'); // Replace with the desired amount of ETK
  const amountDAI = web3.utils.toWei('650', 'ether'); // Replace with the desired amount of DAI

  // Mint ETK tokens
  try {
    const mintETK = await etkToken.methods.mint(accountAddress, amountETK).send({ from: accountAddress, gas: 500000 });
    console.log('Minted ETK:', mintETK);
    const balance = await etkToken.methods.balanceOf(accountAddress).call();
    console.log(`Balance of ${accountAddress} is ${web3.utils.fromWei(balance, 'ether')} ETK`);
  } catch (error) {
    console.error('Error minting ETK:', error);
  }

  // Mint DAI tokens
  try {
    const mintDAI = await daiToken.methods.mint(accountAddress, amountDAI).send({ from: accountAddress, gas: 500000 });
    console.log('Minted DAI:', mintDAI);
    const balance1 = await daiToken.methods.balanceOf(accountAddress).call();
    console.log(`Balance of ${accountAddress} is ${web3.utils.fromWei(balance1, 'ether')} DAI`);
  } catch (error) {
    console.error('Error minting DAI:', error);
  }
}

// Execute the minting function
mintTokens().catch(console.error);
