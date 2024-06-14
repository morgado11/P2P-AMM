const ETK = artifacts.require('EnergyToken.sol');

module.exports = async function (callback) {
    try {
      const etk = await ETK.deployed();
      const mintAccount = '0x21598727F688caafED046CeA731Ad09667e0C8A6';
      const amount = web3.utils.toWei('650', 'ether');
  
      console.log(`Minting 650 ETK to ${mintAccount}`);
      await etk.mint(mintAccount, amount, { gas: 500000 });  // Increased gas limit
      
      
      const balance = await etk.balanceOf(mintAccount);
      console.log(`Balance of ${mintAccount} is ${web3.utils.fromWei(balance, 'ether')} etk`);
    } catch (error) {
      console.error("Error minting ETK:", error);
    }
    callback();
  };