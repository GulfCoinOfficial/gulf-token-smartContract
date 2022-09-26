require('dotenv').config();
const {name, symbol, TVK_CONTRACT, MAX_TOKENS, IPFS_HIDDEN, TOTAL_RESERVE, IPFS_BASE_PATH,PROVENANCE_HASH } = process.env;
const axios = require('axios').default;
async function estimateDeploymentPrice() {
  try {
    const contractFactory  = await ethers.getContractFactory('Token');
    const contractInstance = await contractFactory.deploy()
    console.log(`Contract deployed to "${contractInstance.address}"`);
    const deployTx = contractFactory.getDeployTransaction();
    const estimatedGas = await contractFactory.signer.estimateGas(deployTx);
    console.log("Deployment estimated gas", estimatedGas);
    const gasPrice = await contractFactory.signer.getGasPrice();
    console.log("Current Gas Price", gasPrice);
    const deploymentPriceWei = gasPrice.mul(estimatedGas);
    console.log("Developement Price is Wei", deploymentPriceWei);
    const deploymentPriceRBTC = ethers.utils.formatEther(deploymentPriceWei);
    console.log("Development Price in Eth", deploymentPriceRBTC);
    const USDRate = (
      await axios.get('https://api.coingecko.com/api/v3/coins/rootstock')
    ).data.market_data.current_price.usd;
    console.log("USD Current rate", USDRate)
    const deploymentPriceUSD = (deploymentPriceRBTC * USDRate).toFixed(2);
    console.log(
      `Deployment price on ${hre.network.name} is $${deploymentPriceUSD}`,
    );
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
estimateDeploymentPrice();