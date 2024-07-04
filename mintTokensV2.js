const { ethers } = require('ethers');

// Connect to your local Ethereum node
const provider = new ethers.providers.JsonRpcProvider('http://localhost:7545');
const acc = '0xBFCc51D2aeBcFe96ADa4ABd8B07965a9F6A95eA9';
const signer = provider.getSigner(acc);

// Addresses of the deployed contracts
const etkAddress = '0xE99Ae7aF114FE98b4E50e7aB5E081563Da9Dc2fE';
const daiAddress = '0x0a64DfBb654a54036081B64E670d896Ad898790c';

// ABI of the contracts (assuming they have a mint function)
const etkAbi = require('/Users/miguelmorgado/Desktop/dex/UniCoreForkV2/build/contracts/EnergyToken.json').abi;
const daiAbi = require('/Users/miguelmorgado/Desktop/dex/UniCoreForkV2/build/contracts/Dai.json').abi

async function mintTokens(contractAddress, abi, recipient, amount, tokenName) {
    const contract = new ethers.Contract(contractAddress, abi, signer);
    const tx = await contract.mint(recipient, ethers.utils.parseUnits(amount, 18));
    await tx.wait();
    console.log(`Minted ${amount} ${tokenName} to ${recipient}`);
}

async function main() {
    const recipient = await signer.getAddress();
    const mintAmount = '700'; // Amount to mint

    // Mint DAI tokens
    await mintTokens(daiAddress, daiAbi, recipient, mintAmount, 'DAI');

    // Mint ETK tokens
    await mintTokens(etkAddress, etkAbi, recipient, mintAmount, 'ETK');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
