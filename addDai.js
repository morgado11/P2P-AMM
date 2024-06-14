const Dai = artifacts.require('DAI.sol');

module.exports = async function (callback) {
    try {
      const dai = await Dai.deployed();
      const mintAccount = '0x21598727F688caafED046CeA731Ad09667e0C8A6';
      const amount = web3.utils.toWei('500', 'ether');
  
      console.log(`Minting 500 DAI to ${mintAccount}`);
      await dai.mint(mintAccount, amount, { gas: 500000 });  // Increased gas limit
  
      const balance = await dai.balanceOf(mintAccount);
      console.log(`Balance of ${mintAccount} is ${web3.utils.fromWei(balance, 'ether')} DAI`);
    } catch (error) {
      console.error("Error minting DAI:", error);
    }
    callback();
  };
  