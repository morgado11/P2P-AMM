const { ethers } = require('ethers');
const fs = require('fs');
const csv = require('csv-parser');
const BigNumber = require('bignumber.js');
BigNumber.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

// Connect to your local Ethereum node
const provider = new ethers.providers.JsonRpcProvider('http://localhost:7545');
const signer = provider.getSigner();

// Load Uniswap Router and ERC-20 ABIs
const routerABI = require('/Users/miguelmorgado/Desktop/dex/PeripheryV3/build/contracts/SwapRouter.json').abi;
const daiABI = require('/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/Dai.json').abi;
const etkABI = require('/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/EnergyToken.json').abi;
const poolABI = require('/Users/miguelmorgado/Desktop/dex/CoreV3/build/contracts/UniswapV3Pool.json').abi;

// Uniswap Router and Token Addresses
const routerAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const etkAddress = '0xD008c39f5B5d357b6006590F0E0aabD0adBa8D24';
const daiAddress = '0x0C81CF334Ed577821D03894fDe62d6e279965849';
const poolAddress = '0xC9Dd3B1071996b8fFc40EEF125A677CFF99C2516';
const accountAddress = '0xE803D41C31261Ca0AAb13Fb2cC59B452d322fDD6';

const router = new ethers.Contract(routerAddress, routerABI, signer);
const daiToken = new ethers.Contract(daiAddress, daiABI, signer);
const etkToken = new ethers.Contract(etkAddress, etkABI, signer);
const poolContract = new ethers.Contract(poolAddress, poolABI, provider);

// Function to set token allowance for the Uniswap contract
async function setAllowance(tokenContract, amount) {
    const allowanceAmount = ethers.utils.parseUnits(amount, 18);
    const tx = await tokenContract.approve(routerAddress, allowanceAmount);
    await tx.wait();
    console.log(`Allowance set for ${tokenContract.address} to ${amount}`);
}

// Function to check the allowance of the account for a token
async function checkAllowance(tokenContract, owner, spender) {
    const allowance = await tokenContract.allowance(owner, spender);
    return ethers.utils.formatUnits(allowance, 18);
}

// Function to get the current price of ETK in DAI
async function getPrice() {
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const price = sqrtPriceX96/2**96;
    const price1 = price**2;
    const formattedPrice = price1.toFixed(18);  // Adjust the number of decimals as needed
    return { priceOfETK: formattedPrice };
}

// Function to perform a trade on Uniswap
async function trade(amount, tradeType) {
    const amountIn = ethers.utils.parseUnits(amount.toString(), 18);
    const amountOutMin = 0;
    const path = tradeType === 'GC' ? [etkAddress, daiAddress] : [daiAddress, etkAddress];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current time

    const params = {
        tokenIn: path[0],
        tokenOut: path[1],
        fee: 3000,
        recipient: accountAddress,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0,
    };

    try {
        const tx = await router.exactInputSingle(params, {
            gasLimit: 6000000,
            gasPrice: ethers.utils.parseUnits('10', 'gwei')
        });
        await tx.wait();
        console.log(`Trade successful for ${tradeType} with amount ${amount}`);
        return true;
    } catch (error) {
        console.error(`Trade error for ${tradeType} with amount ${amount}:`, error);
        return false;
    }
}

// Function to process CSV file and initiate trades
async function processTrades() {
    const allowanceAmount = '1000'; 
    await setAllowance(daiToken, allowanceAmount);
    await setAllowance(etkToken, allowanceAmount);

    let timeData = {};
    let successfulTrades = 0;
    let unsuccessfulTrades = 0;

    fs.createReadStream('/Users/miguelmorgado/Desktop/dataToTrade_fixed.csv')
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
                const { priceOfETK: initialPrice } = await getPrice();
                priceUpdates.push({ time, initialPrice: initialPrice });

                console.log(`Initial price of 1 ETK in DAI at ${time}: ${initialPrice}`);
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
                                const success = await trade(entry.value, entry.type);
                                if (success) {
                                    successfulTrades++;
                                } else {
                                    unsuccessfulTrades++;
                                }
                                
                            } else if (entry.type === 'GG' && parseFloat(etkAllowance) >= entry.value) {
                                const success = await trade(entry.value, entry.type);
                                if (success) {
                                    successfulTrades++;
                                } else {
                                    unsuccessfulTrades++;
                                }

                            } else {
                                console.error(`Insufficient allowance for trade: Time=${time}, Type=${entry.type}, Value=${entry.value}`);
                                unsuccessfulTrades++;
                            }

                        } catch (error) {
                            console.error(`Trade error at time ${time} for ${entry.type} with amount ${entry.value}:`, error);
                        }
                    }
                }

                const { priceOfETK: finalPrice } = await getPrice();
                priceUpdates.push({ time, finalPrice: finalPrice });

                console.log(`Final price of 1 ETK in DAI at ${time}: ${finalPrice}`);
            }
            console.log('Finished processing all trades.');
            console.log('Price updates:', priceUpdates);
            console.log('Successful trades:', successfulTrades);
            console.log('Unsuccessful trades:', unsuccessfulTrades);
        })
        .on('error', (err) => {
            console.error("Error reading the file:", err);
        });
}

// Execute the trading process
processTrades();
