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
const pairABI = require('/Users/miguelmorgado/Desktop/dex/UniCoreForkV2/build/contracts/UniswapV2Pair.json').abi;

// Uniswap Router and Token Addresses
const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const etkAddress = '0xbBBb39d7a40D9C10455A243968071845Fb23EFb1';
const daiAddress = '0x1b88324F60bC26385d53262601B406E4ebec88C3';
const pairAddress = '0xec39d28083cAD5516a67cbDAFc99FB0e8a72dF75';
const accountAddress = '0x31c291c9e547866F1BE8Bf76559Ad0c6d6276825';

const router = new ethers.Contract(routerAddress, routerABI, signer);
const daiToken = new ethers.Contract(daiAddress, daiABI, signer);
const etkToken = new ethers.Contract(etkAddress, etkABI, signer);

// Function to get the current price and reserves of ETK in DAI
async function getPrice() {
    const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
    const reserves = await pairContract.getReserves();
    const reserveDAI = ethers.utils.formatEther(reserves[0]);
    const reserveETK = ethers.utils.formatEther(reserves[1]);
    const priceOfETK = parseFloat(reserveDAI) / parseFloat(reserveETK);
    return { priceOfETK, reserveDAI, reserveETK };
}

// Function to set token allowance for the Uniswap contract
async function setAllowance(tokenContract, tokenAddress, amount) {
    const allowanceAmount = ethers.utils.parseEther(amount);
    const tx = await tokenContract.approve(routerAddress, allowanceAmount);
    await tx.wait();
    console.log(`Allowance set for ${tokenAddress} to ${amount}`);
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
        return true;
    } catch (error) {
        console.error(`Trade error for ${tradeType} with amount ${tokenAmount}:`, error);
        return false;
    }
}

// Function to process CSV file and initiate trades
async function processTrades() {
    const allowanceAmount = '700';
    await setAllowance(daiToken, daiAddress, allowanceAmount);
    await setAllowance(etkToken, etkAddress, allowanceAmount);

    let results = [];
    let timeData = {};

    let successfulTrades = 0;
    let unsuccessfulTrades = 0;

    fs.createReadStream('/Users/miguelmorgado/Desktop/dataToTrade_fixed2.csv')
        .pipe(csv({ separator: ';' }))
        .on('data', (data) => {
            for (let i = 2; i < 50; i++) {
                const time = Object.keys(data)[i];
                if (!timeData[time]) {
                    timeData[time] = [];
                }
                const rawValue = data[time].replace(',', '.');
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

                            let tradeResult;
                            if (entry.type === 'GC' && parseFloat(daiAllowance) >= entry.value) {
                                tradeResult = await trade(entry.value, entry.type);
                            } else if (entry.type === 'GG' && parseFloat(etkAllowance) >= entry.value) {
                                tradeResult = await trade(entry.value, entry.type);
                            } else {
                                console.error(`Insufficient allowance for trade: Time=${time}, Type=${entry.type}, Value=${entry.value}`);
                                tradeResult = false;
                            }

                            if (tradeResult) {
                                successfulTrades++;
                            } else {
                                unsuccessfulTrades++;
                            }

                            // Log reserves after the trade
                            const { reserveDAI: finalReserveDAI, reserveETK: finalReserveETK } = await getPrice();
                            console.log(`Final DAI reserve: ${finalReserveDAI}, ETK reserve: ${finalReserveETK}`);
                        } catch (error) {
                            console.error(`Trade error at time ${time} for ${entry.type} with amount ${entry.value}:`, error);
                            unsuccessfulTrades++;
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
            console.log(`Total successful trades: ${successfulTrades}`);
            console.log(`Total unsuccessful trades: ${unsuccessfulTrades}`);
        })
        .on('error', (err) => {
            console.error("Error reading the file:", err);
        });
}

processTrades();
