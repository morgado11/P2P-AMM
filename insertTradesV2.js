const { ethers } = require('ethers');
const fs = require('fs');
const csv = require('csv-parser');

// Connect to your local Ethereum node
const provider = new ethers.providers.JsonRpcProvider('http://localhost:7545');
const signer = provider.getSigner();

// Load Uniswap Router and ERC-20 ABIs
const routerABI = require('/Users/miguelmorgado/Desktop/dex/UniPeripheryForkV2/build/contracts/UniswapV2Router02.json').abi;
const daiABI = require('/Users/miguelmorgado/Desktop/dex/UniPeripheryForkV2/build/contracts/Dai.json').abi;
const etkABI = require('/Users/miguelmorgado/Desktop/dex/UniPeripheryForkV2/build/contracts/EnergyToken.json').abi;
//const ERC20ABI = require('/Users/miguelmorgado/Desktop/dex/UniPeripheryForkV2/build/contracts/ERC20.json').abi;
const pairABI = require('/Users/miguelmorgado/Desktop/dex/UniCoreForkV2/build/contracts/UniswapV2Pair.json').abi;

// Uniswap Router and Token Addresses
const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const daiAddress = '0x194b111d5be9a103a4e865F935366B7197A0536b';
const etkAddress = '0x90cbA0C02d6a52Da6e85E4dfA450f1003a5100CB';
const accountAddress = '0x21598727F688caafED046CeA731Ad09667e0C8A6';
const pairAddress = '0xd8211fCCF6cf18d027d112a0cd8E53DFd52f3681';

const router = new ethers.Contract(routerAddress, routerABI, signer);
const daiToken = new ethers.Contract(daiAddress, daiABI, signer);
const etkToken = new ethers.Contract(etkAddress, etkABI, signer);

// Function to get the current price and reserves of ETK in DAI
async function getPrice() {
    const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
    const reserves = await pairContract.getReserves();
    const reserveDAI = ethers.utils.formatEther(reserves[0]);
    const reserveETK = ethers.utils.formatEther(reserves[1]);
    const priceOfETK = reserveDAI / reserveETK;
    return { priceOfETK, reserveDAI, reserveETK };
}

// Function to set token allowance for the Uniswap contract
async function setAllowance(tokenContract, tokenAddress, amount) {
    const allowanceAmount = ethers.utils.parseEther(amount);
    const tx = await tokenContract.approve(routerAddress, allowanceAmount);
    console.log(`Allowance set for ${tokenAddress} to ${amount}`);
    const allowance = await tokenContract.allowance(accountAddress, routerAddress);
    console.log(`Confirmed allowance for ${tokenAddress}: ${ethers.utils.formatEther(allowance)}`);
}

// Function to check the allowance of the account for a token
async function checkAllowance(tokenContract, owner, spender) {
    const allowance = await tokenContract.allowance(owner, spender);
    return ethers.utils.formatEther(allowance);
}

// Function to perform a trade on Uniswap
async function trade(tokenAmount, tradeType) {
    const path = tradeType === 'GC' ? [daiAddress, etkAddress] : [etkAddress, daiAddress];
    const amountIn = ethers.utils.parseEther(tokenAmount.toString());
    const amountOutMin = 0;

    try {
        const tx = await router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            accountAddress,
            Math.floor(Date.now() / 1000) + 60 * 10,
            {
                gasLimit: 6000000,
                gasPrice: ethers.utils.parseUnits('10', 'gwei')
            }
        );
        await tx.wait();
        console.log(`Trade successful for ${tradeType} with amount ${tokenAmount}`);
    } catch (error) {
        console.error(`Trade error for ${tradeType} with amount ${tokenAmount}:`, error);
        throw error;
    }
}

// Function to process CSV file and initiate trades
async function processTrades() {
    const allowanceAmount1 = '450'; // Set a specific large allowance amount
    const allowanceAmount2 = '400';
    await setAllowance(daiToken, daiAddress, allowanceAmount1);
    await setAllowance(etkToken, etkAddress, allowanceAmount2);

    let results = [];
    let timeData = {};

    fs.createReadStream('/Users/miguelmorgado/Desktop/dataToTrade_fixed.csv')
        .pipe(csv({ separator: ';' }))
        .on('data', (data) => {
            for (let i = 2; i < 50; i++) {
                const time = Object.keys(data)[i];
                if (!timeData[time]) {
                    timeData[time] = [];
                }
                const rawValue = data[time].replace(',', '.');
                console.log(`Raw value for ${time}: ${rawValue}`);
                const value = parseFloat(rawValue);
                if (!isNaN(value) && value !== 0) {
                    timeData[time].push({ value, type: data['Consumption Category'] });
                }
            }
        })
        .on('end', async () => {
            console.log('Starting trade processing by time intervals...');
            const priceUpdates = [];

            for (let time in timeData) {
                const { priceOfETK: initialPrice, reserveDAI: initialReserveDAI, reserveETK: initialReserveETK } = await getPrice();
                priceUpdates.push({ time, initialPrice });

                console.log(`Initial price of 1 ETK in DAI at ${time}: ${initialPrice}`);
                console.log(`Initial DAI reserve: ${initialReserveDAI}, ETK reserve: ${initialReserveETK}`);
                console.log(`Trades for ${time}: ${JSON.stringify(timeData[time])}`);

                for (let entry of timeData[time]) {
                    if (entry.value > 0) {
                        console.log(`Processing trade: Time=${time}, Type=${entry.type}, Value=${entry.value}`);
                        try {
                            // Check allowances before the trade
                            const daiAllowance = await checkAllowance(daiToken, accountAddress, routerAddress);
                            const etkAllowance = await checkAllowance(etkToken, accountAddress, routerAddress);
                            console.log(`DAI Allowance: ${daiAllowance}, ETK Allowance: ${etkAllowance}`);

                            if (entry.type === 'GC' && parseFloat(daiAllowance) >= entry.value) {
                                await trade(entry.value, entry.type);
                            } else if (entry.type === 'GG' && parseFloat(etkAllowance) >= entry.value) {
                                await trade(entry.value, entry.type);
                            } else {
                                console.error(`Insufficient allowance for trade: Time=${time}, Type=${entry.type}, Value=${entry.value}`);
                            }

                            // Log reserves after the trade
                            const { reserveDAI: finalReserveDAI, reserveETK: finalReserveETK } = await getPrice();
                            console.log(`Final DAI reserve: ${finalReserveDAI}, ETK reserve: ${finalReserveETK}`);
                        } catch (error) {
                            console.error(`Trade error at time ${time} for ${entry.type} with amount ${entry.value}:`, error);
                        }
                    }
                }

                const { priceOfETK: finalPrice, reserveDAI: finalReserveDAI, reserveETK: finalReserveETK } = await getPrice();
                priceUpdates.push({ time, finalPrice });

                console.log(`Final price of 1 ETK in DAI at ${time}: ${finalPrice}`);
                console.log(`Final DAI reserve: ${finalReserveDAI}, ETK reserve: ${finalReserveETK}`);
            }
            console.log('Finished processing all trades.');
            console.log('Price updates:', priceUpdates);
        })
        .on('error', (err) => {
            console.error("Error reading the file:", err);
        });
}

processTrades();
